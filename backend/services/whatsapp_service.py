import httpx
import json
import os
import re

def load_settings():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "settings.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WhatsApp Service] Error loading settings: {e}")
    return {}

def sanitize_phone_number(phone: str) -> str:
    """
    Strips leading +, spaces, dashes and non-digit characters.
    Example: '+90 (555) 444-3322' -> '905554443322'
    """
    if not phone:
        return ""
    # Extract only digits
    digits = re.sub(r"\D", "", phone)
    return digits

async def send_whatsapp_message(to_phone: str, text: str) -> dict:
    """
    Dispatches an outbound text message to Meta WhatsApp Cloud API.
    Endpoint: POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
    """
    clean_phone = sanitize_phone_number(to_phone)
    if not clean_phone or not text:
        print(f"[WhatsApp Service] Invalid phone ({to_phone}) or empty text.")
        return {"status": "error", "message": "Invalid recipient or empty text"}

    settings_data = load_settings()
    channels_cfg = settings_data.get("channels", {})
    whatsapp_token = channels_cfg.get("whatsapp_token", "").strip()
    whatsapp_phone_number_id = channels_cfg.get("whatsapp_phone_number_id", "").strip()

    if not whatsapp_token or not whatsapp_phone_number_id:
        print(f"[WhatsApp Service] Credentials missing (token/phone_number_id). Message logged locally to {clean_phone}: '{text}'")
        return {
            "status": "dry_run",
            "message": "WhatsApp API credentials missing in settings. Message saved locally."
        }

    url = f"https://graph.facebook.com/v18.0/{whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {whatsapp_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_phone,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": text
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200 or resp.status_code == 201:
                data = resp.json()
                print(f"[WhatsApp Service] Successfully sent message to {clean_phone}: {data}")
                return {"status": "success", "data": data}
            else:
                err_body = resp.text
                print(f"[WhatsApp Service] Meta API Error ({resp.status_code}): {err_body}")
                return {"status": "error", "code": resp.status_code, "detail": err_body}
    except Exception as e:
        print(f"[WhatsApp Service] Exception while sending message to {clean_phone}: {e}")
        return {"status": "error", "detail": str(e)}
