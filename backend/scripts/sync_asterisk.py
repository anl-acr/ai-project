import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from dotenv import load_dotenv
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
except ImportError:
    pass

def sync():
    try:
        from backend.main import (
            regenerate_pjsip_custom_conf,
            regenerate_queues_conf,
            regenerate_extensions_custom_conf
        )
        regenerate_pjsip_custom_conf()
        regenerate_queues_conf()
        regenerate_extensions_custom_conf()
        print("[Sync Script] Tüm Asterisk konfigürasyonları (PJSIP, Kuyruk, Dialplan) veritabanınızla tam senkronize edildi ve yenilendi.")
    except Exception as e:
        print(f"[Sync Script] Hata: {e}")
        print("[Sync Script] İpucu: Sanal ortamı aktif ederek çalıştırın: source venv/bin/activate && python3 backend/scripts/sync_asterisk.py")

if __name__ == "__main__":
    sync()
