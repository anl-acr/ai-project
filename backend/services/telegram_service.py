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
