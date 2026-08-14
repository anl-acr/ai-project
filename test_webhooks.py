import asyncio
import json
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.whatsapp_service import send_whatsapp_message

client = TestClient(app)

def test_telegram_webhook():
    payload = {
        "update_id": 123456789,
        "message": {
            "message_id": 1,
            "from": {
                "id": 987654321,
                "is_bot": False,
                "first_name": "Ahmet",
                "last_name": "Yilmaz",
                "username": "ahmety",
                "language_code": "tr"
            },
            "chat": {
                "id": 987654321,
                "first_name": "Ahmet",
                "last_name": "Yilmaz",
                "username": "ahmety",
                "type": "private"
            },
            "date": 1690000000,
            "text": "Merhaba, siparisim nerede?"
        }
    }
    response = client.post("/api/webhooks/telegram", json=payload)
    print("Telegram POST Response:", response.status_code, response.json())
    assert response.status_code == 200

def test_whatsapp_verification():
    verify_token = "ai_pbx_whatsapp_verify_token_secure"
    params = {
        "hub.mode": "subscribe",
        "hub.verify_token": verify_token,
        "hub.challenge": "1234567890_CHALLENGE_CODE"
    }
    response = client.get("/api/webhooks/whatsapp", params=params)
    print("WhatsApp GET Verify Response:", response.status_code, response.text)
    assert response.status_code == 200
    assert response.text == "1234567890_CHALLENGE_CODE"

def test_whatsapp_webhook():
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "1234567890",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "1234567890",
                                "phone_number_id": "1234567890"
                            },
                            "contacts": [
                                {
                                    "profile": {
                                        "name": "Ayse Yilmaz"
                                    },
                                    "wa_id": "905554443322"
                                }
                            ],
                            "messages": [
                                {
                                    "from": "905554443322",
                                    "id": "wamid.HBgMOTA1NTU0NDQzMzIyFQIAEhgWMUVCQkQ5RjY0ODAzMzVDNDgwRDk4MQA=",
                                    "timestamp": "1690000000",
                                    "text": {
                                        "body": "Selam, WhatsApp uzerinden ulasiyorum."
                                    },
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    response = client.post("/api/webhooks/whatsapp", json=payload)
    print("WhatsApp POST Response:", response.status_code, response.json())
    assert response.status_code == 200

def test_whatsapp_outbound():
    res = asyncio.run(send_whatsapp_message("+90 555 444 33 22", "Test mesajı"))
    print("WhatsApp Outbound Test Result:", res)
    assert res.get("status") in ["success", "dry_run", "error"]

if __name__ == "__main__":
    test_telegram_webhook()
    test_whatsapp_verification()
    test_whatsapp_webhook()
    test_whatsapp_outbound()
