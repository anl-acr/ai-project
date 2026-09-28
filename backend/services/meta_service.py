import os
import httpx
from typing import Dict, Any
from backend.services.audit_logger import log_event

async def send_meta_message(recipient_id: str, text: str, channel: str = "instagram") -> Dict[str, Any]:
    """
    Sends an outbound message to Instagram Direct or Facebook Messenger via Meta Graph API.
    """
    try:
        from backend.main import settings_db
        channels_cfg = settings_db.get("channels", {})
        
        token = channels_cfg.get("instagram_token", "").strip() if channel == "instagram" else channels_cfg.get("facebook_token", "").strip()
        if not token:
            token = channels_cfg.get("facebook_token", "").strip() or channels_cfg.get("instagram_token", "").strip()

        if not token:
            print(f"[Meta Service] {channel.capitalize()} Token bulunamadı. Mesaj gönderilemedi.")
            return {"status": "error", "message": f"{channel.capitalize()} Token is not configured."}

        url = "https://graph.facebook.com/v18.0/me/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": text}
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            res_data = response.json()

            if response.status_code == 200 and "message_id" in res_data:
                print(f"[Meta Service] {channel.capitalize()} mesajı gönderildi -> Recipient: {recipient_id}")
                log_event("META_SENT", "INFO", f"{channel.capitalize()} mesajı başarıyla yollandı: {recipient_id}")
                return {"status": "success", "response": res_data}
            else:
                err_msg = res_data.get("error", {}).get("message", "Unknown Meta API Error")
                print(f"[Meta Service Error] API Yanıtı ({response.status_code}): {err_msg}")
                log_event("META_ERROR", "ERROR", f"Meta API hatası: {err_msg}")
                return {"status": "error", "message": err_msg}

    except Exception as e:
        print(f"[Meta Service Exception]: {e}")
        log_event("META_EXCEPTION", "ERROR", f"Meta mesaj gönderme hatası: {e}")
        return {"status": "error", "message": str(e)}
