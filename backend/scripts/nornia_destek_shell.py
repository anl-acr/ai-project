#!/usr/bin/env python3
"""
Nornia — Kısıtlı 'destek' Hesabı Etkileşimli Konsol Kabuğu (/usr/local/bin/nornia-destek-shell)
===============================================================================================
Bu dosya 'destek' kullanıcısının hem login shell'i hem de SSH ForceCommand hedefidir.
Kullanıcı asla ham bash/sh satırına erişemez; yalnızca ağ analizi, IP/Gateway/DNS
tanımlama, acil ağ geri alma (rollback) ve salt-okunur servis sağlık kontrolü yapabilir.
"""

import json
import os
import signal
import subprocess
import sys

OPS_BIN = "/usr/local/lib/nornia/nornia_destek_ops.py"
if not os.path.isfile(OPS_BIN):
    OPS_BIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nornia_destek_ops.py")


def _install_signal_guards():
    # Prevent dropping out to a shell on Ctrl+Z or Ctrl+\
    for sig in (signal.SIGTSTP, signal.SIGQUIT):
        try:
            signal.signal(sig, signal.SIG_IGN)
        except Exception:
            pass


def _build_ops_cmd(args):
    if os.geteuid() == 0:
        return [sys.executable, OPS_BIN] + args
    return ["sudo", "-n", OPS_BIN] + args


def _run_ops(args, capture=False):
    cmd = _build_ops_cmd(args)
    try:
        if capture:
            cp = subprocess.run(cmd, capture_output=True, text=True, timeout=15, check=False)
            return cp.returncode, cp.stdout
        cp = subprocess.run(cmd, check=False)
        return cp.returncode, ""
    except KeyboardInterrupt:
        print("\n[İPTAL] İşlem durduruldu, ana menüye dönülüyor.")
        return 130, ""
    except Exception as exc:
        print(f"\n[HATA] İşlem yürütülemedi: {exc}")
        return 1, ""


def _read_health_summary():
    rc, out = _run_ops(["health", "--json"], capture=True)
    if rc == 0 and out.strip():
        try:
            return json.loads(out.strip())
        except Exception:
            pass
    return {
        "ip": "-",
        "web_url": "-",
        "hardware_id": "-",
        "services": {},
    }


def _clear():
    if sys.stdout.isatty():
        sys.stdout.write("\033[2J\033[H")
        sys.stdout.flush()


def _pause():
    try:
        input("\nDevam etmek için [Enter] tuşuna basın...")
    except (EOFError, KeyboardInterrupt):
        pass


def _safe_input(prompt: str) -> str:
    try:
        return input(prompt).strip()
    except KeyboardInterrupt:
        print()
        return ""
    except EOFError:
        return "__EOF__"


def _render_menu():
    info = _read_health_summary()
    svcs = info.get("services") or {}
    def _led(k):
        return "●" if svcs.get(k) == "AKTİF" else "○"

    _clear()
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║                 NORNIA — DESTEK & AĞ TANI KONSOLU                ║")
    print("║              (Kısıtlı Hesap — Yalnızca Ağ & Durum)               ║")
    print("╠══════════════════════════════════════════════════════════════════╣")
    print(f"║  Sunucu IP       : {str(info.get('ip') or '-'):<45} ║")
    print(f"║  Web Erişim      : {str(info.get('web_url') or '-'):<45} ║")
    print(f"║  Donanım Kimliği : {str(info.get('hardware_id') or '-'):<45} ║")
    status_line = (
        f"[{_led('asterisk')}] AST  "
        f"[{_led('postgresql')}] PG16  "
        f"[{_led('backend_api_8000')}] API  "
        f"[{_led('frontend_ui_3000')}] UI  "
        f"[{_led('nginx')}] WEB  "
        f"[{_led('wireguard')}] WG"
    )
    print(f"║  Servisler       : {status_line:<45} ║")
    print("╠══════════════════════════════════════════════════════════════════╣")
    print("║  [1] Ağ Arayüzleri, IP, Route, DNS & Port Özeti                  ║")
    print("║  [2] IP / Subnet / Gateway / DNS Tanımla veya DHCP'ye Al         ║")
    print("║  [3] Son Çalışan Ağ Yedeğine Geri Dön (Acil Rollback)            ║")
    print("║  [4] Bağlantı Analizi (Ping / Traceroute / MTR / DNS)            ║")
    print("║  [5] Hedef IP & Port Erişim Testi (TCP / UDP)                    ║")
    print("║  [6] Canlı SIP / WSS Paket Özeti (5060 / 5061 / 8089)            ║")
    print("║  [7] Detaylı Servis Sağlık Durumu                                ║")
    print("║  [0] Oturumu Kapat                                               ║")
    print("╚══════════════════════════════════════════════════════════════════╝")


def _diagnostics_submenu():
    print("\n--- Bağlantı Analizi ---")
    print("  [1] Ping Testi")
    print("  [2] Traceroute (Yönlendirme İzleme)")
    print("  [3] MTR (Gecikme & Paket Kaybı Raporu)")
    print("  [4] DNS Sorgusu (A / SRV / NAPTR / MX)")
    print("  [0] Geri")
    sub = _safe_input("\nSeçiminiz [0-4]: ")
    if sub in ("", "0", "__EOF__"):
        return
    if sub == "1":
        host = _safe_input("Hedef IP veya alan adı (örn. 8.8.8.8): ")
        if not host or host == "__EOF__":
            return
        cnt = _safe_input("Paket sayısı [varsayılan 4, maks 20]: ") or "4"
        print()
        _run_ops(["ping", host, "--count", cnt])
        _pause()
    elif sub == "2":
        host = _safe_input("Hedef IP veya alan adı: ")
        if not host or host == "__EOF__":
            return
        print()
        _run_ops(["traceroute", host])
        _pause()
    elif sub == "3":
        host = _safe_input("Hedef IP veya alan adı: ")
        if not host or host == "__EOF__":
            return
        print()
        _run_ops(["mtr", host])
        _pause()
    elif sub == "4":
        dom = _safe_input("Alan adı (örn. app.nornia.com.tr): ")
        if not dom or dom == "__EOF__":
            return
        qtype = (_safe_input("Kayıt tipi [A / AAAA / SRV / NAPTR / MX, varsayılan A]: ") or "A").upper()
        print()
        _run_ops(["dns", dom, "--type", qtype])
        _pause()


def main():
    _install_signal_guards()
    # Ignore any SSH command attempts passed via `ssh destek@host "cat /etc/passwd"`
    if os.environ.get("SSH_ORIGINAL_COMMAND"):
        print("[ENGELLENDİ] Kısıtlı 'destek' hesabında doğrudan komut çalıştırılamaz.")
        print("Lütfen etkileşimli menü üzerinden devam edin.\n")

    while True:
        _render_menu()
        choice = _safe_input("\nSeçiminiz [0-7]: ")
        if choice in ("0", "q", "Q", "exit", "__EOF__"):
            print("\nOturum kapatılıyor. İyi çalışmalar!")
            sys.exit(0)
        elif choice == "1":
            _clear()
            _run_ops(["net-summary"])
            _pause()
        elif choice == "2":
            _clear()
            _run_ops(["net-recovery"])
            _pause()
        elif choice == "3":
            _clear()
            confirm = _safe_input("Son çalışan ağ yedeğine geri dönülsün mü? (e/H): ").lower()
            if confirm in ("e", "evet", "y", "yes"):
                _run_ops(["net-rollback"])
            else:
                print("İptal edildi.")
            _pause()
        elif choice == "4":
            _diagnostics_submenu()
        elif choice == "5":
            host = _safe_input("Hedef IP veya alan adı: ")
            if not host or host == "__EOF__":
                continue
            port = _safe_input("Port (örn. 5060, 443, 8089): ")
            if not port or port == "__EOF__":
                continue
            proto = (_safe_input("Protokol [tcp / udp, varsayılan tcp]: ") or "tcp").lower()
            print()
            _run_ops(["port-test", host, port, "--proto", proto])
            _pause()
        elif choice == "6":
            cnt = _safe_input("Yakalanacak paket sayısı [varsayılan 30, maks 100]: ") or "30"
            _clear()
            _run_ops(["sip-trace", "--packets", cnt])
            _pause()
        elif choice == "7":
            _clear()
            _run_ops(["health"])
            _pause()
        else:
            print("Geçersiz seçim.")


if __name__ == "__main__":
    main()
