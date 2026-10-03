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

async def send_whatsapp_message(to_phone: str, text: str, phone_number_id: str = None, token: str = None) -> dict:
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
    whatsapp_token = (token or channels_cfg.get("whatsapp_token", "")).strip()
    whatsapp_phone_number_id = (phone_number_id or channels_cfg.get("whatsapp_phone_number_id", "")).strip()

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
            if resp.status_code in [200, 201]:
                data = resp.json()
                print(f"[WhatsApp Service] Successfully sent message to {clean_phone} via line {whatsapp_phone_number_id}: {data}")
                return {"status": "success", "data": data}
            else:
                err_body = resp.text
                print(f"[WhatsApp Service] Meta API Error ({resp.status_code}): {err_body}")
                return {"status": "error", "code": resp.status_code, "detail": err_body}
    except Exception as e:
        print(f"[WhatsApp Service] Exception while sending message to {clean_phone}: {e}")
        return {"status": "error", "detail": str(e)}


async def send_whatsapp_missed_call_autoresponder(phone_number: str) -> dict:
    """
    Sends an automated WhatsApp missed call greeting when an inbound phone call is missed or unanswered.
    """
    settings = load_settings()
    cfg = settings.get("channels", {})
    if cfg.get("missed_call_whatsapp_enabled", True) is False:
        print(f"[WhatsApp Autoresponder] Missed call notification disabled in settings.")
        return {"status": "disabled"}

    text = (
        "Merhaba! Bizi aradığınız için teşekkür ederiz. 📞\n\n"
        "Şu anda tüm müşteri temsilcilerimiz meşgul olduğu için çağrınızı yanıtlayamadık.\n"
        "Dilerseniz buraya yazarak talebinizi veya sorunuzu iletebilirsiniz. "
        "Yapay zeka asistanımız veya müşteri temsilcimiz size hemen yardımcı olacaktır."
    )
    res = await send_whatsapp_message(phone_number, text)
    print(f"[WhatsApp Autoresponder] Missed call WhatsApp message sent to {phone_number}: {res}")
    return res


async def send_whatsapp_buttons(to_phone: str, body_text: str, buttons: list, phone_number_id: str = None, token: str = None) -> dict:
    """
    Dispatches interactive quick reply buttons to Meta WhatsApp Cloud API.
    buttons example: [{"id": "btn_1", "title": "Fiyat Bilgisi"}, {"id": "btn_2", "title": "Canlı Temsilci"}]
    """
    clean_phone = sanitize_phone_number(to_phone)
    if not clean_phone or not body_text:
        return {"status": "error", "message": "Invalid recipient or empty text"}

    settings_data = load_settings()
    channels_cfg = settings_data.get("channels", {})
    whatsapp_token = (token or channels_cfg.get("whatsapp_token", "")).strip()
    whatsapp_phone_number_id = (phone_number_id or channels_cfg.get("whatsapp_phone_number_id", "")).strip()

    if not whatsapp_token or not whatsapp_phone_number_id:
        return {"status": "dry_run", "message": "WhatsApp API credentials missing"}

    url = f"https://graph.facebook.com/v18.0/{whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {whatsapp_token}",
        "Content-Type": "application/json"
    }

    button_objects = []
    for b in buttons[:3]:  # Meta limits to max 3 quick reply buttons
        button_objects.append({
            "type": "reply",
            "reply": {
                "id": str(b.get("id", b.get("title"))),
                "title": str(b.get("title"))[:20]  # Max 20 chars
            }
        })

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_phone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": { "text": body_text },
            "action": { "buttons": button_objects }
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code in [200, 201]:
                return {"status": "success", "data": resp.json()}
            else:
                return {"status": "error", "detail": resp.text}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


async def send_whatsapp_media(to_phone: str, media_type: str, media_url: str, caption: str = "") -> dict:
    """
    Dispatches media files (image, document, audio) to Meta WhatsApp Cloud API.
    media_type: 'image', 'document', 'audio'
    """
    clean_phone = sanitize_phone_number(to_phone)
    if not clean_phone or not media_url:
        return {"status": "error", "message": "Invalid recipient or empty media URL"}

    settings_data = load_settings()
    channels_cfg = settings_data.get("channels", {})
    whatsapp_token = channels_cfg.get("whatsapp_token", "").strip()
    whatsapp_phone_number_id = channels_cfg.get("whatsapp_phone_number_id", "").strip()

    if not whatsapp_token or not whatsapp_phone_number_id:
        return {"status": "dry_run", "message": "WhatsApp API credentials missing"}

    url = f"https://graph.facebook.com/v18.0/{whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {whatsapp_token}",
        "Content-Type": "application/json"
    }

    m_type = media_type.lower()
    if m_type not in ["image", "document", "audio"]:
        m_type = "document"

    media_obj = { "link": media_url }
    if caption and m_type in ["image", "document"]:
        media_obj["caption"] = caption
    if m_type == "document":
        media_obj["filename"] = media_url.split("/")[-1] or "dokuman.pdf"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_phone,
        "type": m_type,
        m_type: media_obj
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code in [200, 201]:
                return {"status": "success", "data": resp.json()}
            else:
                return {"status": "error", "detail": resp.text}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
