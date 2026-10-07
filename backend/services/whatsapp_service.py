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
    Ensures Turkish 10/11 digit mobile numbers (starting with 5 or 05) are formatted with country code 90.
    Example:
    '0507 179 63 72' -> '905071796372'
    '5071796372'     -> '905071796372'
    '+905071796372'  -> '905071796372'
    '905071796372'   -> '905071796372'
    """
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10 and digits.startswith("5"):
        digits = "90" + digits
    elif len(digits) == 11 and digits.startswith("05"):
        digits = "90" + digits[1:]
    return digits

def resolve_whatsapp_credentials(token: str = None, phone_number_id: str = None) -> tuple:
    """
    Resolves active WhatsApp Bearer Token and Phone Number ID from:
    1. Direct parameters
    2. settings.json channels configuration (top-level or whatsapp_accounts list)
    3. Environment variables
    """
    settings_data = load_settings()
    channels_cfg = settings_data.get("channels", {})
    
    resolved_token = (token or channels_cfg.get("whatsapp_token", "") or os.getenv("WHATSAPP_TOKEN", "")).strip()
    resolved_phone_id = (phone_number_id or channels_cfg.get("whatsapp_phone_number_id", "") or os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")).strip()
    
    accs = channels_cfg.get("whatsapp_accounts", [])
    if isinstance(accs, list) and len(accs) > 0:
        matched_acc = None
        target_str = str(resolved_phone_id or "").strip()
        target_digits = re.sub(r"\D", "", target_str)
        
        if target_str or target_digits:
            for acc in accs:
                acc_id = str(acc.get("phone_number_id", "")).strip()
                acc_phone = str(acc.get("display_phone_number", "")).strip()
                acc_phone_digits = re.sub(r"\D", "", acc_phone)
                acc_name = str(acc.get("name", "")).strip()
                
                if (acc_id and (acc_id == target_str or acc_id in target_str)) or \
                   (acc_phone and acc_phone in target_str) or \
                   (acc_phone_digits and target_digits and (acc_phone_digits in target_digits or target_digits in acc_phone_digits)) or \
                   (acc_name and acc_name in target_str):
                    matched_acc = acc
                    break
        
        if not matched_acc:
            matched_acc = accs[0]

        if matched_acc:
            acc_tok = (matched_acc.get("token") or matched_acc.get("access_token") or "").strip()
            acc_pid = (matched_acc.get("phone_number_id") or "").strip()
            
            if acc_tok and not resolved_token:
                resolved_token = acc_tok
            if acc_pid:
                # Always prefer Meta's numeric phone_number_id over phone strings (e.g. 0850...)
                resolved_phone_id = acc_pid

    if not resolved_token and isinstance(accs, list):
        for acc in accs:
            t = (acc.get("token") or acc.get("access_token") or "").strip()
            if t:
                resolved_token = t
                if not resolved_phone_id:
                    resolved_phone_id = str(acc.get("phone_number_id", "")).strip()
                break

    return resolved_token, resolved_phone_id

async def send_whatsapp_message(to_phone: str, text: str, phone_number_id: str = None, token: str = None) -> dict:
    """
    Dispatches an outbound text message to Meta WhatsApp Cloud API.
    Endpoint: POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
    """
    clean_phone = sanitize_phone_number(to_phone)
    if not clean_phone or not text:
        print(f"[WhatsApp Service] Invalid phone ({to_phone}) or empty text.")
        return {"status": "error", "message": "Invalid recipient or empty text"}

    whatsapp_token, whatsapp_phone_number_id = resolve_whatsapp_credentials(token, phone_number_id)

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

    whatsapp_token, whatsapp_phone_number_id = resolve_whatsapp_credentials(token, phone_number_id)

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


async def send_whatsapp_media(to_phone: str, media_type: str, media_url: str, caption: str = "", phone_number_id: str = None, token: str = None) -> dict:
    """
    Dispatches media files (image, document, audio) to Meta WhatsApp Cloud API.
    media_type: 'image', 'document', 'audio'
    """
    clean_phone = sanitize_phone_number(to_phone)
    if not clean_phone or not media_url:
        return {"status": "error", "message": "Invalid recipient or empty media URL"}

    whatsapp_token, whatsapp_phone_number_id = resolve_whatsapp_credentials(token, phone_number_id)

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
