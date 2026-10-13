import os
import httpx
from typing import Dict, Any
from backend.services.audit_logger import log_event

async def send_telegram_message(chat_id: str, text: str) -> Dict[str, Any]:
    """
    Sends an outbound Telegram message via Telegram Bot API sendMessage endpoint.
    """
    try:
        from backend.main import settings_db
        channels_cfg = settings_db.get("channels", {})
        telegram_token = channels_cfg.get("telegram_token", "").strip()

        if not telegram_token:
            print("[Telegram Service] Telegram Token bulunamadı. Mesaj gönderilemedi.")
            return {"status": "error", "message": "Telegram Token is not configured."}

        url = f"https://api.telegram.org/bot{telegram_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            res_data = response.json()

            if response.status_code == 200 and res_data.get("ok"):
                print(f"[Telegram Service] Telegram mesajı gönderildi -> ChatID: {chat_id}")
                log_event("TELEGRAM_SENT", "INFO", f"Telegram mesajı başarıyla yollandı: {chat_id}")
                return {"status": "success", "response": res_data}
            else:
                err_desc = res_data.get("description", "Unknown Telegram API Error")
                print(f"[Telegram Service Error] API Yanıtı ({response.status_code}): {err_desc}")
                log_event("TELEGRAM_ERROR", "ERROR", f"Telegram API hatası: {err_desc}")
                return {"status": "error", "message": err_desc}

    except Exception as e:
        print(f"[Telegram Service Exception]: {e}")
        log_event("TELEGRAM_EXCEPTION", "ERROR", f"Telegram gönderme hatası: {e}")
        return {"status": "error", "message": str(e)}


async def send_telegram_media(chat_id: str, media_type: str, media_url: str, caption: str = "", filename: str = None) -> Dict[str, Any]:
    """
    Sends an outbound media file (image, video, audio, document) via Telegram Bot API.
    Supports both local /uploads/ files and external URLs.
    """
    try:
        from backend.main import settings_db
        channels_cfg = settings_db.get("channels", {})
        telegram_token = channels_cfg.get("telegram_token", "").strip()

        if not telegram_token:
            return {"status": "error", "message": "Telegram Token is not configured."}

        m_type = (media_type or "document").lower()
        endpoint_map = {
            "image": ("sendPhoto", "photo"),
            "video": ("sendVideo", "video"),
            "audio": ("sendAudio", "audio"),
            "document": ("sendDocument", "document")
        }
        api_method, field_name = endpoint_map.get(m_type, ("sendDocument", "document"))
        url = f"https://api.telegram.org/bot{telegram_token}/{api_method}"

        local_filepath = None
        if "/uploads/" in media_url:
            rel_part = "uploads/" + media_url.split("/uploads/", 1)[1]
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            project_root = os.path.dirname(base_dir)
            for cand in [os.path.join(project_root, rel_part), os.path.join(base_dir, rel_part), rel_part]:
                if os.path.exists(cand) and os.path.isfile(cand):
                    local_filepath = cand
                    break

        doc_filename = filename or media_url.split("/")[-1] or "dosya"

        async with httpx.AsyncClient(timeout=30.0) as client:
            if local_filepath:
                with open(local_filepath, "rb") as f:
                    file_bytes = f.read()
                data_form = {"chat_id": chat_id}
                if caption:
                    data_form["caption"] = caption
                files = {field_name: (doc_filename, file_bytes)}
                response = await client.post(url, data=data_form, files=files)
            else:
                payload = {"chat_id": chat_id, field_name: media_url}
                if caption:
                    payload["caption"] = caption
                response = await client.post(url, json=payload)

            res_data = response.json()
            if response.status_code == 200 and res_data.get("ok"):
                return {"status": "success", "response": res_data}
            else:
                return {"status": "error", "message": res_data.get("description", "Telegram media error")}
    except Exception as e:
        print(f"[Telegram Media Exception]: {e}")
        return {"status": "error", "message": str(e)}

