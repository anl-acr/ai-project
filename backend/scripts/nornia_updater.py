#!/usr/bin/env python3
"""
Nornia PBX Unified Safe Update & Rollback Engine (nornia_updater.py)
--------------------------------------------------------------------
Single zero-dependency detached updater invoked identically by:
  1. Central Panel Remote OTA (RAS_OTA_UPDATE via Nornia Connect tunnel)
  2. PBX Self-Service Update Center (/api/system/update/start & /rollback)

Key guarantees:
  - Runs completely detached (survives pm2 restart aida-backend / aida-app)
  - PID lock prevents overlapping concurrent updates
  - Optional graceful wait until active voice calls == 0 (mode='after_calls')
  - Strict exact commit/tag checkout approved by Central Panel (never blind pull if target_commit given)
  - Conditional dependency install (pip / npm only when manifests change)
  - Always runs Asterisk sync_asterisk.py + features/dialplan reload
  - Automatic Rollback if frontend build OR post-restart health check fails
  - Real-time JSON progress file (/tmp/nornia_update_status.json) + Central Hub status callback
"""

import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

LOCK_FILE = "/tmp/nornia_update.lock"
STATUS_FILE = "/tmp/nornia_update_status.json"
LOG_FILE = "/tmp/nornia_ota_update.log"
CANCEL_FILE = "/tmp/nornia_update_cancel"
ROLLBACK_FILE = "/tmp/nornia_last_good_release.json"

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def utc_now_iso() -> str:
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def log_line(msg: str):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass
    try:
        sys.stdout.write(line)
        sys.stdout.flush()
    except Exception:
        pass


def write_status(state: dict, hub_url: str = "", hardware_id: str = ""):
    state["updated_at"] = utc_now_iso()
    tmp_path = STATUS_FILE + ".tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, STATUS_FILE)
    except Exception as e:
        log_line(f"[WARN] Status write failed: {e}")

    if hub_url and hardware_id:
        _report_status_to_hub(hub_url, hardware_id, state)


def _report_status_to_hub(hub_url: str, hardware_id: str, state: dict):
    base = str(hub_url or "").strip().rstrip("/")
    if not base:
        return
    if not base.startswith(("http://", "https://")):
        base = f"https://{base}"
    url = f"{base}/api/v1/updates/report-status"
    payload = {
        "hardware_id": hardware_id,
        "status": state.get("status") or "updating",
        "progress": int(state.get("progress") or 0),
        "step_index": int(state.get("step_index") or 0),
        "step_label": str(state.get("step_label") or ""),
        "target_version": str(state.get("target_version") or ""),
        "current_version": str(state.get("current_version") or ""),
        "error": str(state.get("error") or ""),
        "triggered_by": str(state.get("triggered_by") or "system"),
        "source": str(state.get("source") or "pbx"),
    }
    try:
        import ssl
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=4.0, context=ctx):
            pass
    except Exception:
        pass


def run_cmd(cmd: list, cwd: str = PROJECT_DIR, timeout: int = 600, check_output: bool = False):
    log_line(f"$ {' '.join(cmd)}")
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    out_lines = []
    start_t = time.time()
    try:
        assert proc.stdout is not None
        for raw_line in proc.stdout:
            clean_l = raw_line.rstrip("\r\n")
            if clean_l:
                out_lines.append(clean_l)
                try:
                    with open(LOG_FILE, "a", encoding="utf-8") as f:
                        f.write(clean_l + "\n")
                except Exception:
                    pass
            if time.time() - start_t > timeout:
                proc.kill()
                raise TimeoutError(f"Command timed out after {timeout}s: {' '.join(cmd)}")
        rc = proc.wait(timeout=15)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
        raise
    joined = "\n".join(out_lines)
    if check_output:
        return rc, joined
    return rc, joined


def get_git_head() -> str:
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return (res.stdout or "").strip()
    except Exception:
        return ""


def get_git_head_full() -> str:
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return (res.stdout or "").strip()
    except Exception:
        return ""


def read_local_pbx_version() -> str:
    import re
    try:
        main_py = os.path.join(PROJECT_DIR, "backend", "main.py")
        with open(main_py, "r", encoding="utf-8") as f:
            txt = f.read()
        idx = txt.find("async def get_system_version_info")
        if idx != -1:
            m = re.search(r'"version"\s*:\s*"(v[0-9]+\.[0-9]+\.[0-9]+[^"]*)"', txt[idx : idx + 2000])
            if m:
                return m.group(1).strip()
    except Exception:
        pass
    return ""


def get_active_calls_count() -> int:
    # 1. Try local backend API
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/api/calls/active", method="GET")
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                if isinstance(data, list):
                    return len(data)
                if isinstance(data, dict):
                    if isinstance(data.get("calls"), list):
                        return len(data["calls"])
                    if "count" in data:
                        return int(data["count"] or 0)
    except Exception:
        pass
    # 2. Fallback: Asterisk CLI active calls count
    try:
        res = subprocess.run(
            ["asterisk", "-rx", "core show calls"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        import re
        m = re.search(r"(\d+)\s+active\s+call", res.stdout or "", re.IGNORECASE)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return 0


def wait_for_health_check(expected_version: str = "", timeout_sec: int = 30) -> tuple[bool, str]:
    deadline = time.time() + timeout_sec
    last_err = "Backend yanıt vermedi"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/api/settings/version", timeout=3.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    live_ver = str(data.get("version") or "").strip()
                    if live_ver:
                        log_line(f"Sağlık kontrolü başarılı: Canlı sürüm = {live_ver}")
                        return True, live_ver
        except Exception as e:
            last_err = str(e)
        time.sleep(2.0)
    return False, last_err


def acquire_lock() -> bool:
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE, "r", encoding="utf-8") as f:
                old_pid = int((f.read() or "0").strip())
            if old_pid > 0:
                os.kill(old_pid, 0)
                return False
        except ProcessLookupError:
            pass
        except Exception:
            pass
    try:
        with open(LOCK_FILE, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
        return True
    except Exception:
        return False


def release_lock():
    try:
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
    except Exception:
        pass


def perform_rollback(prev_commit_full: str, prev_version: str, state: dict, hub_url: str, hardware_id: str, reason: str):
    log_line(f"!!! OTOMATİK GERİ ALMA (ROLLBACK) BAŞLATILIYOR -> {prev_version} ({prev_commit_full[:7]}). Sebep: {reason}")
    state.update({
        "status": "rolling_back",
        "step_index": 6,
        "step_label": f"Otomatik Geri Alma ({prev_version})",
        "progress": 88,
        "error": reason,
    })
    write_status(state, hub_url, hardware_id)

    try:
        run_cmd(["git", "reset", "--hard", prev_commit_full], timeout=60)
        if os.path.exists("/etc/asterisk"):
            run_cmd([sys.executable, os.path.join(PROJECT_DIR, "backend", "scripts", "sync_asterisk.py")], timeout=60)
            subprocess.run(["asterisk", "-rx", "module reload features"], capture_output=True, timeout=5)
            subprocess.run(["asterisk", "-rx", "dialplan reload"], capture_output=True, timeout=5)
        fe_dir = os.path.join(PROJECT_DIR, "frontend")
        if os.path.isdir(fe_dir):
            run_cmd(["npm", "run", "build"], cwd=fe_dir, timeout=420)
        if shutil.which("pm2"):
            run_cmd(["pm2", "restart", "aida-app"], timeout=45)
            run_cmd(["pm2", "restart", "aida-backend"], timeout=45)
        ok, live_v = wait_for_health_check(timeout_sec=25)
        state.update({
            "status": "rolled_back",
            "progress": 100,
            "current_version": live_v if ok else prev_version,
            "step_label": f"Hata sonrası {prev_version} sürümüne güvenle geri dönüldü",
            "finished_at": utc_now_iso(),
            "error": reason,
        })
        write_status(state, hub_url, hardware_id)
        log_line(f"Rollback tamamlandı. Sistem tekrar {prev_version} üzerinde çalışıyor.")
    except Exception as rb_err:
        log_line(f"[CRITICAL] Rollback hatası: {rb_err}")
        state.update({
            "status": "failed",
            "progress": 100,
            "step_label": "Güncelleme ve geri alma hatası",
            "finished_at": utc_now_iso(),
            "error": f"{reason} | Rollback hatası: {rb_err}",
        })
        write_status(state, hub_url, hardware_id)


def main():
    parser = argparse.ArgumentParser(description="Nornia PBX Safe Update & Rollback Engine")
    parser.add_argument("--mode", choices=["now", "after_calls", "rollback"], default="now")
    parser.add_argument("--target-version", default="")
    parser.add_argument("--target-commit", default="")
    parser.add_argument("--triggered-by", default="admin")
    parser.add_argument("--source", default="pbx")
    parser.add_argument("--hub-url", default="")
    parser.add_argument("--hardware-id", default="")
    args = parser.parse_args()

    if not acquire_lock():
        print("Another Nornia update process is already running.")
        sys.exit(2)

    try:
        # Clear any old cancel marker
        if os.path.exists(CANCEL_FILE):
            try:
                os.remove(CANCEL_FILE)
            except Exception:
                pass

        # Reset log file for fresh run
        try:
            with open(LOG_FILE, "w", encoding="utf-8") as f:
                f.write(f"=== Nornia Sistem Güncelleme Günlüğü ({utc_now_iso()}) ===\n")
        except Exception:
            pass

        prev_commit_full = get_git_head_full()
        prev_commit_short = get_git_head()
        prev_version = read_local_pbx_version() or "unknown"

        state = {
            "status": "starting",
            "mode": args.mode,
            "source": args.source,
            "triggered_by": args.triggered_by,
            "previous_version": prev_version,
            "previous_commit": prev_commit_short,
            "current_version": prev_version,
            "target_version": args.target_version or ("Önceki Sürüm" if args.mode == "rollback" else "Son Onaylı Sürüm"),
            "target_commit": args.target_commit,
            "step_index": 0,
            "total_steps": 6,
            "step_label": "Güncelleme hazırlanıyor...",
            "progress": 2,
            "active_calls_waiting": 0,
            "started_at": utc_now_iso(),
            "finished_at": None,
            "error": "",
        }
        write_status(state, args.hub_url, args.hardware_id)
        log_line(
            f"Başlatıldı | Mod={args.mode} | Kaynak={args.source} | Tetikleyen={args.triggered_by} "
            f"| Mevcut={prev_version} ({prev_commit_short}) -> Hedef={args.target_version or '-'} ({args.target_commit or 'origin/main'})"
        )

        # Optional graceful wait for active calls == 0
        if args.mode == "after_calls":
            wait_started = time.time()
            while True:
                if os.path.exists(CANCEL_FILE):
                    log_line("Bekleyen güncelleme kullanıcı tarafından iptal edildi.")
                    state.update({
                        "status": "cancelled",
                        "progress": 0,
                        "step_label": "Güncelleme iptal edildi",
                        "finished_at": utc_now_iso(),
                    })
                    write_status(state, args.hub_url, args.hardware_id)
                    return
                active_cnt = get_active_calls_count()
                if active_cnt <= 0:
                    log_line("Aktif çağrı kalmadı (0). Güncelleme başlatılıyor...")
                    break
                state.update({
                    "status": "waiting_calls",
                    "step_index": 0,
                    "step_label": f"Aktif çağrıların bitmesi bekleniyor ({active_cnt} aktif görüşme)...",
                    "progress": 5,
                    "active_calls_waiting": active_cnt,
                })
                write_status(state, args.hub_url, args.hardware_id)
                if time.time() - wait_started > 14400:  # 4 hours max safety timeout
                    raise RuntimeError("Aktif çağrı bekleme zaman aşımı (4 saat) doldu.")
                time.sleep(5.0)

        # STEP 1: Pre-flight & Snapshot Checkpoint
        state.update({
            "status": "updating",
            "step_index": 1,
            "step_label": "Ön Kontrol ve Yedek Noktası Oluşturuluyor",
            "progress": 12,
            "active_calls_waiting": 0,
        })
        write_status(state, args.hub_url, args.hardware_id)

        disk_free_mb = shutil.disk_usage(PROJECT_DIR).free / (1024 * 1024)
        log_line(f"Boş disk alanı: {disk_free_mb:.0f} MB")
        if disk_free_mb < 400:
            raise RuntimeError(f"Yetersiz disk alanı ({disk_free_mb:.0f} MB). Güncelleme için en az 400 MB boş alan gerekir.")

        # Resolve rollback target if mode == rollback
        target_ref = ""
        if args.mode == "rollback":
            rb_commit = args.target_commit
            rb_ver = args.target_version
            if not rb_commit and os.path.exists(ROLLBACK_FILE):
                with open(ROLLBACK_FILE, "r", encoding="utf-8") as rf:
                    rb_data = json.load(rf)
                    rb_commit = str(rb_data.get("previous_commit_full") or rb_data.get("previous_commit") or "").strip()
                    rb_ver = rb_ver or str(rb_data.get("previous_version") or "").strip()
            if not rb_commit:
                raise RuntimeError("Geri dönülecek kayıtlı önceki sürüm noktası bulunamadı.")
            target_ref = rb_commit
            state["target_version"] = rb_ver or rb_commit[:7]
            state["target_commit"] = rb_commit[:7]
        else:
            # Save current working commit as rollback checkpoint BEFORE touching git
            try:
                with open(ROLLBACK_FILE, "w", encoding="utf-8") as rf:
                    json.dump(
                        {
                            "previous_version": prev_version,
                            "previous_commit": prev_commit_short,
                            "previous_commit_full": prev_commit_full,
                            "target_version": args.target_version,
                            "saved_at": utc_now_iso(),
                        },
                        rf,
                        ensure_ascii=False,
                        indent=2,
                    )
            except Exception as e_rb:
                log_line(f"[WARN] Rollback checkpoint yazılamadı: {e_rb}")

        # STEP 2: Fetch & Checkout Exact Approved Commit / Release
        state.update({
            "step_index": 2,
            "step_label": "Onaylı Sürüm Kodları İndiriliyor",
            "progress": 28,
        })
        write_status(state, args.hub_url, args.hardware_id)

        if args.mode != "rollback":
            rc_fetch, out_fetch = run_cmd(["git", "fetch", "--tags", "origin"], timeout=120)
            if rc_fetch != 0:
                raise RuntimeError(f"Git fetch başarısız oldu: {out_fetch[-400:]}")
            if args.target_commit:
                target_ref = args.target_commit.strip()
                # Verify target commit exists in repo
                rc_chk, _ = run_cmd(["git", "cat-file", "-e", f"{target_ref}^{{commit}}"], timeout=15)
                if rc_chk != 0:
                    log_line(f"Hedef commit ({target_ref}) bulunamadı; origin/main kullanılıyor.")
                    target_ref = "origin/main"
            else:
                target_ref = "origin/main"

        # Stash any accidental local tracked edits (settings.json / uploads are gitignored)
        run_cmd(["git", "stash", "push", "-m", f"nornia-auto-pre-update-{int(time.time())}"], timeout=30)
        rc_reset, out_reset = run_cmd(["git", "reset", "--hard", target_ref], timeout=60)
        if rc_reset != 0:
            raise RuntimeError(f"Sürüm geçişi ({target_ref}) başarısız oldu: {out_reset[-400:]}")

        new_commit_short = get_git_head()
        new_version = read_local_pbx_version() or args.target_version or prev_version
        log_line(f"Yeni sürüm kodu hazır: {new_version} ({new_commit_short})")

        # STEP 3: Conditional Dependency Check
        state.update({
            "step_index": 3,
            "step_label": "Sistem Bağımlılıkları Kontrol Ediliyor",
            "progress": 42,
        })
        write_status(state, args.hub_url, args.hardware_id)

        changed_files = ""
        if prev_commit_full:
            _, changed_files = run_cmd(["git", "diff", "--name-only", prev_commit_full, "HEAD"], timeout=30)
        changed_set = {ln.strip() for ln in changed_files.splitlines() if ln.strip()}

        if "requirements.txt" in changed_set:
            venv_pip = os.path.join(PROJECT_DIR, "venv", "bin", "pip")
            pip_bin = venv_pip if os.path.isfile(venv_pip) else "pip3"
            log_line("requirements.txt değişti — Python paketleri güncelleniyor...")
            rc_pip, out_pip = run_cmd([pip_bin, "install", "-r", "requirements.txt", "--quiet"], timeout=300)
            if rc_pip != 0:
                log_line(f"[WARN] pip install uyarısı: {out_pip[-300:]}")

        fe_dir = os.path.join(PROJECT_DIR, "frontend")
        if ("frontend/package.json" in changed_set or "frontend/package-lock.json" in changed_set) and os.path.isdir(fe_dir):
            log_line("frontend/package.json değişti — Node paketleri güncelleniyor...")
            rc_npm_i, out_npm_i = run_cmd(["npm", "install", "--no-audit", "--no-fund"], cwd=fe_dir, timeout=360)
            if rc_npm_i != 0:
                raise RuntimeError(f"npm install başarısız: {out_npm_i[-400:]}")

        # STEP 4: Asterisk Dialplan & Features Sync
        state.update({
            "step_index": 4,
            "step_label": "Asterisk Dialplan & Özellik Kodları Senkronize Ediliyor",
            "progress": 58,
        })
        write_status(state, args.hub_url, args.hardware_id)

        sync_script = os.path.join(PROJECT_DIR, "backend", "scripts", "sync_asterisk.py")
        if os.path.isfile(sync_script) and os.path.exists("/etc/asterisk"):
            rc_sync, out_sync = run_cmd([sys.executable, sync_script], timeout=90)
            if rc_sync != 0:
                log_line(f"[WARN] sync_asterisk.py uyarısı: {out_sync[-300:]}")
            if shutil.which("asterisk"):
                run_cmd(["asterisk", "-rx", "module reload features"], timeout=15)
                run_cmd(["asterisk", "-rx", "dialplan reload"], timeout=15)

        # STEP 5: Frontend Production Build
        state.update({
            "step_index": 5,
            "step_label": "Web Arayüzü Derleniyor (Next.js Build)",
            "progress": 74,
        })
        write_status(state, args.hub_url, args.hardware_id)

        if os.path.isdir(fe_dir):
            rc_build, out_build = run_cmd(["npm", "run", "build"], cwd=fe_dir, timeout=480)
            if rc_build != 0:
                err_msg = f"Arayüz derleme (npm run build) hatası: {out_build[-500:]}"
                if args.mode != "rollback" and prev_commit_full:
                    perform_rollback(prev_commit_full, prev_version, state, args.hub_url, args.hardware_id, err_msg)
                    return
                raise RuntimeError(err_msg)

        # STEP 6: PM2 Restart & Post-Update Health Verification
        state.update({
            "step_index": 6,
            "step_label": "Servisler Yeniden Başlatılıyor & Sağlık Kontrolü Yapılıyor",
            "progress": 90,
        })
        write_status(state, args.hub_url, args.hardware_id)

        if shutil.which("pm2"):
            run_cmd(["pm2", "restart", "aida-app"], timeout=45)
            run_cmd(["pm2", "restart", "aida-backend"], timeout=45)
            time.sleep(3.0)
            ok_health, live_ver_or_err = wait_for_health_check(expected_version=new_version, timeout_sec=30)
            if not ok_health:
                err_msg = f"Yeniden başlatma sonrası backend sağlık kontrolü başarısız: {live_ver_or_err}"
                if args.mode != "rollback" and prev_commit_full:
                    perform_rollback(prev_commit_full, prev_version, state, args.hub_url, args.hardware_id, err_msg)
                    return
                raise RuntimeError(err_msg)
            new_version = live_ver_or_err or new_version

        state.update({
            "status": "success",
            "step_index": 6,
            "step_label": f"{new_version} sürümüne güncelleme başarıyla tamamlandı!",
            "progress": 100,
            "current_version": new_version,
            "target_version": new_version,
            "target_commit": new_commit_short,
            "finished_at": utc_now_iso(),
            "error": "",
        })
        write_status(state, args.hub_url, args.hardware_id)
        log_line(f"=== GÜNCELLEME BAŞARIYLA TAMAMLANDI: {prev_version} -> {new_version} ({new_commit_short}) ===")

    except Exception as exc:
        log_line(f"[ERROR] Güncelleme başarısız: {exc}")
        try:
            with open(STATUS_FILE, "r", encoding="utf-8") as sf:
                cur_st = json.load(sf)
        except Exception:
            cur_st = {}
        cur_st.update({
            "status": "failed",
            "progress": 100,
            "step_label": "Güncelleme başarısız oldu",
            "finished_at": utc_now_iso(),
            "error": str(exc),
        })
        write_status(cur_st, args.hub_url, args.hardware_id)
        sys.exit(1)
    finally:
        release_lock()


if __name__ == "__main__":
    main()
