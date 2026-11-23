#!/usr/bin/env python3
"""
Nornia Enterprise API Portal — Complete Single-Source Catalog, OpenAPI 3.1 & Postman Exporter
=============================================================================================
Reads `backend/services/external_api_service.py` (via pure AST, zero FastAPI runtime needed)
for all 46 External REST API v1 (`X-API-Key`) endpoints AND merges all verified Platform,
CTI, Dialer, Omnichannel, RAG/AI, Workspace 360, Enterprise Reports, Multi-Site Federation,
Nornia Connect, Webhooks & SIP Diagnostics endpoints from the Nornia backend.

Outputs:
  1. portals/api-portal/data/api-catalog.json
  2. portals/api-portal/public/openapi.json
  3. portals/api-portal/public/nornia-api.postman_collection.json
"""

import ast
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_DATA_DIR = REPO_ROOT / "portals" / "api-portal" / "data"
OUT_PUBLIC_DIR = REPO_ROOT / "portals" / "api-portal" / "public"
OUT_DATA_DIR.mkdir(parents=True, exist_ok=True)
OUT_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)


def extract_pbx_version() -> str:
    main_py = REPO_ROOT / "backend" / "main.py"
    try:
        txt = main_py.read_text(encoding="utf-8", errors="ignore")
        m = re.search(r'"version"\s*:\s*"(v[0-9]+\.[0-9]+\.[0-9]+)"', txt)
        if m:
            return m.group(1)
    except Exception:
        pass
    return "v3.10.11"


def load_external_api_structures():
    src = (REPO_ROOT / "backend" / "services" / "external_api_service.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    perm_modules = []
    endpoints_catalog = []
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == "API_PERMISSION_MODULES":
                    perm_modules = ast.literal_eval(node.value)
                elif isinstance(t, ast.Name) and t.id == "API_ENDPOINTS_CATALOG":
                    endpoints_catalog = ast.literal_eval(node.value)
    return perm_modules, endpoints_catalog


SAMPLE_RESPONSES = {
    "/api/v1/status": {
        "status": "ok",
        "tenant_id": "tenant-default",
        "key_name": "ERP Prod Anahtarı",
        "scopes": ["calls:read", "calls:write", "cdr:read"],
        "server_time": "2026-11-23T14:20:00+03:00"
    },
    "/api/v1/calls/originate": {
        "status": "ok",
        "call_id": "aida-1763890123-4918",
        "extension": "1000",
        "destination": "05321234567",
        "message": "Dahili 1000 çaldırılıyor; açıldığında 05321234567 aranacak."
    },
    "/api/v1/calls/active": {
        "status": "ok",
        "count": 1,
        "calls": [
            {
                "call_id": "aida-1763890123-4918",
                "direction": "inbound",
                "caller_number": "05321234567",
                "callee_extension": "1000",
                "queue": "6000",
                "state": "Up",
                "duration_sec": 42,
                "recording_paused": False
            }
        ]
    },
    "/api/v1/calls/{call_id}/transfer": {
        "status": "ok",
        "call_id": "aida-1763890123-4918",
        "target_extension": "1002",
        "message": "Çağrı 1002 dahili numarasına başarıyla aktarıldı."
    },
    "/api/v1/calls/{call_id}/hangup": {
        "status": "ok",
        "call_id": "aida-1763890123-4918",
        "message": "Çağrı sonlandırıldı."
    },
    "/api/v1/calls/{call_id}/recording-pause": {
        "status": "ok",
        "call_id": "aida-1763890123-4918",
        "recording_paused": True,
        "message": "KVKK/PCI koruması: Ses kaydı duraklatıldı."
    },
    "/api/v1/calls/{call_id}/hold": {
        "status": "ok",
        "call_id": "aida-1763890123-4918",
        "on_hold": True,
        "message": "Çağrı beklemeye (MoH) alındı."
    },
    "/api/v1/calls/monitor": {
        "status": "ok",
        "supervisor_extension": "1000",
        "target_extension": "1001",
        "mode": "whisper",
        "message": "Süpervizör 1000, 1001 görüşmesine 'whisper' modunda bağlandı."
    },
    "/api/v1/cdr": {
        "status": "ok",
        "total": 128,
        "items": [
            {
                "call_id": "aida-1763890123-4918",
                "started_at": "2026-11-23T14:15:10+03:00",
                "direction": "inbound",
                "caller_number": "05321234567",
                "did_number": "908503607390",
                "agent_extension": "1000",
                "disposition": "ANSWERED",
                "duration_sec": 184,
                "talk_sec": 171,
                "sentiment": "positive",
                "recording_url": "/api/v1/cdr/aida-1763890123-4918/recording",
                "call_legs": [
                    {"leg_index": 0, "extension": "1000", "talk_sec": 95},
                    {"leg_index": 1, "extension": "1002", "talk_sec": 76}
                ]
            }
        ]
    },
    "/api/v1/cdr/{call_id}": {
        "status": "ok",
        "call_id": "aida-1763890123-4918",
        "caller_number": "05321234567",
        "agent_extension": "1000",
        "duration_sec": 184,
        "ai_summary": "Müşteri kargo takip numarasını sordu; temsilci teslimat bilgisini iletti.",
        "sentiment": "positive",
        "qa_score": 94,
        "recording_url": "/api/v1/cdr/aida-1763890123-4918/recording",
        "transcript": [
            {"speaker": "customer", "text": "Merhaba, 45921 numaralı siparişim ne durumda?"},
            {"speaker": "agent", "text": "Merhaba, hemen kontrol ediyorum. Kargonuz bugün dağıtıma çıkmış görünüyor."}
        ]
    },
    "/api/v1/cdr/{call_id}/recording": {
        "content_type": "audio/wav",
        "headers": {"Content-Disposition": "attachment; filename=\"call-aida-1763890123-4918.wav\""},
        "note": "İkili (binary) WAV/MP3 ses akışı döner."
    },
    "/api/v1/extensions": {
        "status": "ok",
        "count": 2,
        "extensions": [
            {
                "id": 10,
                "extension": "1000",
                "full_name": "Ahmet Yılmaz",
                "email": "ahmet@sirket.com",
                "role": "agent",
                "registered": True,
                "ip_address": "192.168.1.42",
                "agent_status": "available",
                "recording_active": True
            }
        ]
    },
    "/api/v1/queues": {
        "status": "ok",
        "queues": [
            {
                "id": 1,
                "extension": "6000",
                "name": "Müşteri Hizmetleri",
                "strategy": "rrmemory",
                "timeout": 20,
                "wrapup_time": 10,
                "members": ["1000", "1001", "1002"]
            }
        ]
    },
    "/api/v1/trunks": {
        "status": "ok",
        "trunks": [
            {
                "id": 1,
                "name": "Operator_Trunk",
                "host": "sip.operatortelekom.com.tr",
                "did_number": "908503607390",
                "registered": True,
                "active_channels": 3,
                "max_channels": 25
            }
        ]
    },
    "/api/v1/contacts": {
        "status": "ok",
        "count": 1,
        "contacts": [
            {
                "id": 512,
                "name": "Mehmet Demir",
                "phone": "05329876543",
                "company": "Demir Lojistik A.Ş.",
                "email": "mehmet@demirlojistik.com",
                "notes": "Kurumsal VIP Müşteri"
            }
        ]
    },
    "/api/v1/omnichannel/whatsapp/send": {
        "status": "ok",
        "channel": "whatsapp",
        "phone": "905321234567",
        "message_id": "wamid.HBgMOTA1MzIxMjM0NTY3FQIAERgSMzQ2...",
        "delivered": True
    },
    "/api/v1/ai-calls/originate": {
        "status": "ok",
        "call_id": "aida-ai-1763890988",
        "agent_name": "Sales_AI",
        "phone_number": "05321234567",
        "message": "AI sesli asistan çağrısı başlatıldı."
    },
    "/api/v1/system/capacity": {
        "status": "ok",
        "version": "v3.10.11",
        "plan_tier": "enterprise",
        "license_valid": True,
        "license_expires_at": "2027-12-31",
        "extensions_used": 18,
        "extensions_limit": 100,
        "active_calls": 4,
        "concurrent_calls_limit": 25,
        "sip_trunks_online": 2
    },
    "/api/v1/webhooks/subscribe": {
        "status": "ok",
        "webhook_id": "wh_89a1c4f2",
        "webhook_url": "https://crm.sirketiniz.com/api/pbx-events",
        "events": ["call.ringing", "call.answered", "call.transferred", "call.ended"],
        "signature_header": "X-AIDA-Signature"
    },
    "/api/cti/lookup": {
        "status": "ok",
        "matched": True,
        "contact": {"name": "Mehmet Demir", "company": "Demir Lojistik A.Ş.", "vip": True},
        "screen_pop_url": "https://crm.sirketiniz.com/customers/512?phone=05329876543"
    },
    "/api/workspace/customer-360": {
        "status": "ok",
        "phone": "05321234567",
        "profile": {"name": "Mehmet Demir", "tags": ["VIP", "Kurumsal"], "total_calls": 14, "total_chats": 6},
        "timeline": [
            {"type": "call", "timestamp": "2026-11-23T11:20:00+03:00", "summary": "Fatura sorgulama", "sentiment": "positive"},
            {"type": "whatsapp", "timestamp": "2026-11-22T16:40:00+03:00", "summary": "Kargo linki iletildi"}
        ]
    },
    "/api/reports/wallboard": {
        "status": "ok",
        "active_calls": 4,
        "waiting_in_queue": 1,
        "agents_available": 8,
        "agents_on_break": 2,
        "sla_percent": 94.6,
        "today_answered": 182,
        "today_missed": 7
    },
    "/api/system/overview": {
        "status": "ok",
        "hostname": "nornia-pbx",
        "version": "v3.10.11",
        "fqdn": "musteri.nornia.com.tr",
        "lan_ip": "192.168.1.25",
        "wan_ip": "85.105.42.18",
        "uptime_sec": 438290,
        "license_status": "active"
    }
}


# ============================================================================
# EK PLATFORM & ENTEGRASYON API KATEGORİLERİ (Backend'deki Tüm Gerçek Uç Noktalar)
# ============================================================================
PLATFORM_API_CATEGORIES = [
    {
        "category": "9. CTI & CRM Screen Pop (Arayan Tanıma & Otomatik Kart Açma)",
        "scope_module": "cti",
        "auth_type": "session",
        "items": [
            {
                "method": "POST",
                "method_tr": "Sorgulama / Eşleştirme (POST)",
                "path": "/api/cti/lookup",
                "scope": "cti_integration:read",
                "title": "Gelen Numarayı CRM'de Sorgula & Screen Pop URL Üret",
                "description": "Gelen çağrıdaki arayan numarayı (caller_number) santral rehberi ve tanımlı dış CRM sistemlerinde (Zoho, HubSpot, Salesforce, Bitrix24 veya Özel HTTP) sorgular; müşteri özetini ve otomatik açılacak CRM kart URL'sini döndürür.",
                "sample_body": {"phone": "05321234567", "did": "908503607390", "extension": "1000"},
            },
            {
                "method": "POST",
                "method_tr": "Bağlantı Testi (POST)",
                "path": "/api/cti/test",
                "scope": "cti_integration:write",
                "title": "CTI / CRM Bağlantı & Webhook Testi",
                "description": "Yapılandırılan harici CRM/CTI URL şablonunu veya HTTP sorgu ucunu örnek bir telefon numarasıyla test eder, HTTP yanıt kodu ve gecikme süresini (ms) raporlar.",
                "sample_body": {"test_phone": "05321234567", "crm_url": "https://crm.sirket.com/api/lookup?phone={phone}"},
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/settings/crm-integrations",
                "scope": "crm_integrations:read",
                "title": "Tanımlı Hazır CRM Entegrasyonlarını Listele",
                "description": "Santralde aktif olan Zoho, HubSpot, Salesforce, Bitrix24 ve özel CRM bağlayıcılarını döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Kaydetme / Güncelleme (POST)",
                "path": "/api/settings/crm-integrations",
                "scope": "crm_integrations:write",
                "title": "CRM Entegrasyonu Ekle / Güncelle",
                "description": "Yeni bir CRM bağlayıcısı kaydeder veya mevcut bağlayıcının kimlik doğrulama ve alan eşleştirme kurallarını günceller.",
                "sample_body": {"provider": "hubspot", "enabled": True, "api_token": "pat-eu1-xxxx", "auto_log_calls": True},
            },
            {
                "method": "POST",
                "method_tr": "Bağlantı Testi (POST)",
                "path": "/api/settings/crm-integrations/{crm_id}/test",
                "scope": "crm_integrations:write",
                "title": "Seçili CRM Bağlayıcısını Canlı Test Et",
                "description": "Belirtilen CRM entegrasyonunun API token geçerliliğini ve erişilebilirliğini canlı test eder.",
                "sample_body": {},
            },
        ],
    },
    {
        "category": "10. Otomatik Dış Arama (Dialer) & Kampanya Yönetimi API",
        "scope_module": "dialer",
        "auth_type": "session",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/settings/dialer/campaigns",
                "scope": "dialer:read",
                "title": "Dış Arama (Dialer) Kampanyalarını Listele",
                "description": "Tüm aktif, duraklatılmış ve tamamlanmış otomatik dış arama kampanyalarını, ilerleme yüzdelerini ve eşzamanlı kanal limitlerini döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Oluşturma / Güncelleme (POST)",
                "path": "/api/settings/dialer/campaigns",
                "scope": "dialer:write",
                "title": "Yeni Dış Arama Kampanyası Oluştur",
                "description": "AI Asistan, ACD Kuyruk veya IVR/Anons hedefli yeni bir otomatik dış arama kampanyası oluşturur.",
                "sample_body": {
                    "name": "Kasım Yenileme Kampanyası",
                    "mode": "ai_agent",
                    "target_id": "Sales_AI",
                    "max_concurrent": 5,
                    "caller_id": "908503607390",
                    "retry_limit": 2,
                    "retry_delay_minutes": 30
                },
            },
            {
                "method": "POST",
                "method_tr": "Liste Yükleme (POST)",
                "path": "/api/settings/dialer/campaigns/{campaign_id}/upload-list",
                "scope": "dialer:write",
                "title": "Kampanyaya Aranacak Numara Listesi Yükle (JSON / CSV)",
                "description": "Belirtilen kampanyaya müşteri adı, telefon numarası ve özel değişkenlerle (örn. fatura tutarı, son ödeme tarihi) toplu arama listesi yükler.",
                "sample_body": {
                    "records": [
                        {"name": "Ali Kaya", "phone": "05321112233", "custom_data": {"borc": "1.250 TL"}},
                        {"name": "Zeynep Demir", "phone": "05423334455", "custom_data": {"borc": "890 TL"}}
                    ]
                },
            },
            {
                "method": "POST",
                "method_tr": "Durum Kontrolü (POST)",
                "path": "/api/settings/dialer/campaigns/{campaign_id}/control",
                "scope": "dialer:write",
                "title": "Kampanyayı Başlat / Duraklat / Durdur",
                "description": "Belirtilen kampanyanın çalışma durumunu `start`, `pause`, `resume` veya `stop` aksiyonlarıyla anlık yönetir.",
                "sample_body": {"action": "start"},
            },
            {
                "method": "DELETE",
                "method_tr": "Silme (DELETE)",
                "path": "/api/settings/dialer/campaigns/{campaign_id}",
                "scope": "dialer:delete",
                "title": "Dış Arama Kampanyasını Sil",
                "description": "Kampanyayı ve bekleyen arama kuyruğunu kalıcı olarak siler.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/dialer/records?campaign_id=1&status=completed",
                "scope": "dialer:read",
                "title": "Kampanya Arama Kayıtlarını ve Sonuçlarını Çek",
                "description": "Kampanyadaki her numaranın arama sonucunu (ANSWERED, NOANSWER, BUSY, FAILED), deneme sayısını ve AI özetini listeler.",
                "sample_body": None,
            },
        ],
    },
    {
        "category": "11. Omnichannel (WhatsApp, Telegram, Meta, E-Posta) & Ortak Gelen Kutusu API",
        "scope_module": "omnichannel",
        "auth_type": "session",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/omnichannel/chats?channel=whatsapp&status=open",
                "scope": "omnichannel:access",
                "title": "Omnichannel Sohbet Oturumlarını Listele",
                "description": "WhatsApp, Telegram, Instagram, Facebook Messenger, E-Posta ve Webchat kanallarındaki tüm aktif ve kapalı sohbet oturumlarını listeler.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/omnichannel/chats/{session_id}/messages",
                "scope": "omnichannel:access",
                "title": "Sohbet Oturumunun Mesaj Geçmişini Getir",
                "description": "Belirtilen sohbet oturumundaki tüm müşteri, AI asistan ve temsilci mesajlarını medya ekleriyle kronolojik döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Mesaj Gönderme (POST)",
                "path": "/api/omnichannel/chats/{session_id}/send",
                "scope": "omnichannel:access",
                "title": "Aktif Sohbet Oturumuna Yanıt Gönder",
                "description": "Oturumun bağlı olduğu kanal (WhatsApp / Telegram / Instagram / E-Posta) üzerinden müşteriye metin veya medya yanıtı gönderir.",
                "sample_body": {"content": "Merhaba, talebiniz işleme alındı. Kargo kodunuz: TR9918273.", "sender": "agent"},
            },
            {
                "method": "POST",
                "method_tr": "Devralma (POST)",
                "path": "/api/omnichannel/chats/{session_id}/takeover",
                "scope": "omnichannel:access",
                "title": "Sohbeti Yapay Zekadan İnsan Temsilciye Devral",
                "description": "AI Asistan tarafından yönetilen bir sohbeti insan temsilciye devreder; AI otomatik yanıtlamayı durdurur.",
                "sample_body": {"agent_id": "1000"},
            },
            {
                "method": "POST",
                "method_tr": "AI'a Aktarma (POST)",
                "path": "/api/omnichannel/chats/{session_id}/transfer_to_ai",
                "scope": "omnichannel:access",
                "title": "Sohbeti Yeniden Yapay Zeka Asistanına Devret",
                "description": "İnsan temsilci müdahalesi tamamlandığında sohbeti tekrar otomatik AI yanıt moduna geçirir.",
                "sample_body": {},
            },
            {
                "method": "POST",
                "method_tr": "Toplu Yayın (POST)",
                "path": "/api/omnichannel/whatsapp/broadcast",
                "scope": "omnichannel:access",
                "title": "WhatsApp Toplu Kampanya / Bilgilendirme Gönderimi",
                "description": "Birden fazla telefon numarasına resmi Meta WhatsApp Business Cloud API üzerinden kontrollü hızda toplu duyuru veya şablon gönderir.",
                "sample_body": {"phones": ["905321234567", "905429876543"], "message": "Yeni kampanyamız başladı! Detaylar için yanıtlayın.", "account_id": "default"},
            },
            {
                "method": "POST",
                "method_tr": "Etkileşimli Buton (POST)",
                "path": "/api/omnichannel/whatsapp/buttons",
                "scope": "omnichannel:access",
                "title": "WhatsApp Etkileşimli Hızlı Yanıt Butonları Gönder",
                "description": "Müşteriye en fazla 3 adet tıklanabilir Meta Quick-Reply butonu içeren interaktif mesaj gönderir.",
                "sample_body": {"phone": "905321234567", "body_text": "Size nasıl yardımcı olabiliriz?", "buttons": ["Fiyat ve Bilgi", "Randevu Al", "Canlı Temsilci"]},
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/omnichannel/whatsapp/templates",
                "scope": "omnichannel:access",
                "title": "Meta Onaylı WhatsApp Mesaj Şablonlarını Çek",
                "description": "Meta Business hesabınızda onaylanmış HSM şablonlarını (24 saat penceresi dışı gönderim için) listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Şablon Gönderme (POST)",
                "path": "/api/omnichannel/whatsapp/send-template",
                "scope": "omnichannel:access",
                "title": "Onaylı WhatsApp Şablon Mesajı Gönder (24 Saat Dışı)",
                "description": "Meta onaylı bir şablonu dinamik parametrelerle müşteriye iletir.",
                "sample_body": {"phone": "905321234567", "template_name": "randevu_hatirlatma", "language": "tr", "parameters": ["Ahmet Bey", "24 Kasım 14:30"]},
            },
            {
                "method": "POST",
                "method_tr": "Yeni Sohbet Başlat (POST)",
                "path": "/api/omnichannel/chats/compose",
                "scope": "omnichannel:access",
                "title": "Müşteriye Yeni Dış Sohbet / E-Posta Başlat",
                "description": "Mevcut oturum olmadan WhatsApp, Telegram veya E-Posta üzerinden doğrudan yeni bir iletişim oturumu açar.",
                "sample_body": {"channel": "email", "to": "musteri@firma.com", "subject": "Teklif Dosyanız", "content": "Merhaba, talep ettiğiniz teklif ektedir."},
            },
        ],
    },
    {
        "category": "12. Bilgi Bankası (RAG), Canlı Çeviri & Kalite Kontrol (QA) API",
        "scope_module": "rag_ai",
        "auth_type": "session",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/rag/sources",
                "scope": "rag_kb:read",
                "title": "Bilgi Bankası (RAG) Kaynaklarını Listele",
                "description": "AI sesli ve yazılı asistanların kullandığı tüm indekslenmiş PDF, Word, Web sitesi ve manuel SSS kaynaklarını listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Web Tarama (POST)",
                "path": "/api/rag/crawl",
                "scope": "rag_kb:write",
                "title": "Web Sitesini Tara ve Bilgi Bankasına İndeksle",
                "description": "Verilen web sitesi URL'sini otomatik tarar, HTML içeriğini temizleyip anlamsal parçalara (chunks) bölerek RAG bilgi bankasına ekler.",
                "sample_body": {"url": "https://sirketiniz.com/sss", "max_pages": 10},
            },
            {
                "method": "POST",
                "method_tr": "Manuel Bilgi Ekle (POST)",
                "path": "/api/rag/manual",
                "scope": "rag_kb:write",
                "title": "Bilgi Bankasına Manuel Doküman / SSS Ekle",
                "description": "Fiyat listesi, iade politikası veya ürün teknik verilerini doğrudan metin olarak AI bilgi bankasına ekler.",
                "sample_body": {"title": "2026 Fiyat Listesi", "content": "Kurumsal paket aylık 4.900 TL + KDV olup 50 dahili ve sınırsız IVR içerir."},
            },
            {
                "method": "GET",
                "method_tr": "Anlamsal Arama (GET)",
                "path": "/api/rag/search?q=iade+suresi",
                "scope": "rag_kb:read",
                "title": "Bilgi Bankasında Anlamsal (Semantic) Sorgu Testi",
                "description": "Verilen müşteri sorusuna karşılık RAG motorunun hangi bilgi parçalarını ve benzerlik skorlarını döndürdüğünü test eder.",
                "sample_body": None,
            },
            {
                "method": "DELETE",
                "method_tr": "Silme (DELETE)",
                "path": "/api/rag/sources?source_name=fiyat_listesi.pdf",
                "scope": "rag_kb:delete",
                "title": "Bilgi Bankası Kaynağını Sil",
                "description": "Belirtilen kaynağa ait tüm vektör/metin parçalarını bilgi bankasından temizler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Canlı Metin Çeviri (POST)",
                "path": "/api/live-translator/translate-text",
                "scope": "live_translator:access",
                "title": "Gerçek Zamanlı Metin Çevirisi (Çok Dilli Destek)",
                "description": "Müşteri veya temsilci cümlelerini düşük gecikmeyle hedef dile (TR ↔ EN / DE / AR / RU / FR) çevirir.",
                "sample_body": {"text": "Siparişinizin teslimat adresini teyit edebilir misiniz?", "source_lang": "tr", "target_lang": "en"},
            },
            {
                "method": "POST",
                "method_tr": "Ses Sentezleme TTS (POST)",
                "path": "/api/live-translator/tts",
                "scope": "live_translator:access",
                "title": "Çevrilmiş Metni Doğal Sese Dönüştür (TTS)",
                "description": "Hedef dildeki metni canlı çağrıya aktarılabilir doğal insan sesine (audio/mp3) dönüştürür.",
                "sample_body": {"text": "Could you please confirm your delivery address?", "language": "en", "voice": "nova"},
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/qa/questions",
                "scope": "qa:read",
                "title": "Otomatik Çağrı Kalite Kontrol (QA) Kriterlerini Listele",
                "description": "AI Kalite Değerlendirme motorunun her çağrıyı puanlarken kullandığı soru setini ve ağırlıklarını döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Kriter Ekleme (POST)",
                "path": "/api/qa/questions",
                "scope": "qa:write",
                "title": "Yeni Kalite Değerlendirme (QA) Kriteri Ekle",
                "description": "Yeni bir denetim sorusu ve puan ağırlığı tanımlar (örn. KVKK aydınlatma metni okundu mu?).",
                "sample_body": {"question": "Temsilci görüşme başında şirket adını belirterek selamlama yaptı mı?", "weight": 15, "category": "Açılış"},
            },
        ],
    },
    {
        "category": "13. Müşteri 360°, Geri Arama (Callback) & Kriz Alarmı API",
        "scope_module": "workspace",
        "auth_type": "session",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / 360 Profil (GET)",
                "path": "/api/workspace/customer-360?phone=05321234567",
                "scope": "customer_360:read",
                "title": "Müşteri 360° Birleşik Zaman Tüneli Sorgula",
                "description": "Bir telefon numarasına ait tüm sesli çağrıları, WhatsApp/E-Posta sohbetlerini, randevuları, AI duygu geçmişini ve VIP etiketlerini tek zaman tünelinde döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Meta Güncelleme (POST)",
                "path": "/api/workspace/customer-360/meta",
                "scope": "customer_360:write",
                "title": "Müşteri 360° Etiket, VIP Durumu ve Özel Not Güncelle",
                "description": "Müşteri kartına VIP rozeti, risk uyarısı veya temsilciler arası paylaşılan sabit notlar ekler.",
                "sample_body": {"phone": "05321234567", "tags": ["VIP", "Kurumsal"], "pinned_note": "Öncelikli teknik destek sözleşmesi var."},
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/workspace/callbacks?status=pending",
                "scope": "callback_tasks:read",
                "title": "Planlı Geri Arama (Callback) Görevlerini Listele",
                "description": "Bekleyen, zamanı yaklaşan veya tamamlanmış müşteri geri arama görevlerini listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Görev Oluştur (POST)",
                "path": "/api/workspace/callbacks",
                "scope": "callback_tasks:write",
                "title": "Yeni Geri Arama (Callback) Görevi Planla",
                "description": "Belirli bir tarih/saatte belirtilen temsilciye hatırlatma çıkacak şekilde müşteri geri arama görevi oluşturur.",
                "sample_body": {"customer_name": "Mehmet Demir", "phone": "05321234567", "assigned_extension": "1000", "scheduled_at": "2026-11-24T10:30:00", "note": "Teklif onayı sorulacak"},
            },
            {
                "method": "PATCH",
                "method_tr": "Durum Güncelle (PATCH)",
                "path": "/api/workspace/callbacks/{task_id}",
                "scope": "callback_tasks:write",
                "title": "Geri Arama Görevi Durumunu Güncelle",
                "description": "Geri arama görevini `completed`, `rescheduled` veya `cancelled` olarak işaretler.",
                "sample_body": {"status": "completed", "result_note": "Müşteri arandı, sipariş onaylandı."},
            },
            {
                "method": "DELETE",
                "method_tr": "Silme (DELETE)",
                "path": "/api/workspace/callbacks/{task_id}",
                "scope": "callback_tasks:delete",
                "title": "Geri Arama Görevini Sil",
                "description": "Belirtilen geri arama görevini siler.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Listeleme (GET)",
                "path": "/api/workspace/missed-claims",
                "scope": "callback_tasks:read",
                "title": "Cevapsız Çağrı Sahiplenme (Missed Claim) Listesi",
                "description": "Hangi cevapsız çağrının hangi temsilci tarafından sahiplenilip geri arandığını listeler (çift aramayı önler).",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Sahiplenme (POST)",
                "path": "/api/workspace/missed-claims",
                "scope": "callback_tasks:write",
                "title": "Cevapsız Çağrıyı Üzerine Al (Claim)",
                "description": "Bir cevapsız çağrıyı temsilci adına kilitler; diğer temsilciler bu çağrının zaten ilgilenildiğini görür.",
                "sample_body": {"call_id": "aida-1763890123-4918", "extension": "1000"},
            },
            {
                "method": "GET",
                "method_tr": "Canlı Alarm (GET)",
                "path": "/api/workspace/crisis-alerts",
                "scope": "crisis_alerts:access",
                "title": "Canlı Kriz & Negatif Duygu Alarmlarını Çek",
                "description": "Aktif çağrılarda AI duygu analizi tarafından yüksek öfke/kriz skoru tespit edilen görüşmeleri süpervizör müdahalesi için listeler.",
                "sample_body": None,
            },
        ],
    },
    {
        "category": "14. Kurumsal Raporlar, Wallboard, Süpervizör & Hot-Desking API",
        "scope_module": "reports",
        "auth_type": "session",
        "items": [
            {
                "method": "GET",
                "method_tr": "Canlı Pano (GET)",
                "path": "/api/reports/wallboard",
                "scope": "wallboard:access",
                "title": "Canlı Wallboard KPI ve Kuyruk Metrikleri",
                "description": "Aktif çağrı, kuyrukta bekleyenler, müsait/moladaki temsilci sayıları, günlük SLA % ve ortalama bekleme sürelerini döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Rapor (GET)",
                "path": "/api/reports/enterprise/queue-sla?start_date=2026-11-01&end_date=2026-11-23",
                "scope": "reports_queue_sla:access",
                "title": "Kuyruk SLA & Cevaplama Hız Dilimleri Raporu",
                "description": "0-10 sn, 10-20 sn, 20-30 sn ve 30+ sn dilimlerinde kuyruk cevaplama oranlarını ve terk istatistiklerini döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Rapor (GET)",
                "path": "/api/reports/enterprise/breaks-attendance?start_date=2026-11-01&end_date=2026-11-23",
                "scope": "reports_breaks_attendance:access",
                "title": "Temsilci Mola & Puantaj Raporu",
                "description": "Her temsilcinin günlük oturum açma/kapama saatlerini, net çalışma süresini ve mola türü bazlı (Yemek, İhtiyaç, Eğitim) toplam dakikalarını döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Rapor (GET)",
                "path": "/api/reports/enterprise/agent-kpi-metrics",
                "scope": "reports_perf:access",
                "title": "Temsilci Performans & AHT / ACW KPI Raporu",
                "description": "Temsilci bazında toplam gelen/giden çağrı, ortalama konuşma süresi (AHT), wrap-up süresi ve FCR oranlarını döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Rapor (GET)",
                "path": "/api/reports/enterprise/omnichannel",
                "scope": "reports_omnichannel:access",
                "title": "Omnichannel Kanal & İlk Yanıt SLA Raporu",
                "description": "WhatsApp, Telegram, Instagram, Facebook ve E-Posta kanalları için ortalama ilk yanıt süresi ve çözüm oranlarını döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Rapor (GET)",
                "path": "/api/reports/enterprise/voip-quality",
                "scope": "reports_voip_quality:access",
                "title": "VoIP & Ses Kalitesi (MOS / Jitter / Paket Kaybı) Raporu",
                "description": "Çağrı bazlı RTCP/WebRTC MOS skoru, gecikme (RTT), jitter ve paket kaybı metriklerini döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Rapor (GET)",
                "path": "/api/reports/queue-surveys",
                "scope": "reports_survey:access",
                "title": "Çağrı Sonrası Müşteri Memnuniyet Anketi (CSAT) Raporu",
                "description": "DTMF tuşlama ile toplanan 1-5 arası memnuniyet anket sonuçlarını kuyruk ve temsilci kırılımında döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Rapor (GET)",
                "path": "/api/reports/trunk-package-usage",
                "scope": "reports_trunk_minutes:access",
                "title": "Operatör Dakika Paketi & Maliyet Tüketim Raporu",
                "description": "Her SIP Trunk için tanımlı aylık dakika paketinin ne kadarının tüketildiğini ve kalan dakikayı döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Özel Rapor Çalıştır (POST)",
                "path": "/api/reports/custom/execute",
                "scope": "reports_custom_builder:access",
                "title": "Özel Rapor Tasarımcısı Dinamik Sorgu Çalıştır",
                "description": "Seçilen veri kaynağı, sütunlar, gruplama ve filtrelerle dinamik kurumsal rapor üretir.",
                "sample_body": {"dataset": "calls", "metrics": ["count", "avg_duration"], "group_by": "agent_extension", "date_range": "last_7_days"},
            },
            {
                "method": "POST",
                "method_tr": "AI Rapor Üret (POST)",
                "path": "/api/reports/custom/ai-generate",
                "scope": "reports_custom_builder:access",
                "title": "Doğal Dille Yapay Zeka Özel Rapor Oluştur",
                "description": "Türkçe doğal dil isteğini (örn. 'Bu ay 30 saniyeden fazla bekleyip kaçan çağrıları kuyruk bazında listele') otomatik rapor tanımına çevirir.",
                "sample_body": {"prompt": "Son 30 günde en çok çağrı yanıtlayan 5 temsilciyi ortalama konuşma süreleriyle göster"},
            },
            {
                "method": "GET",
                "method_tr": "Mola Talepleri (GET)",
                "path": "/api/supervisor/break-requests",
                "scope": "supervisor:agent_status",
                "title": "Bekleyen Temsilci Mola Onay Taleplerini Listele",
                "description": "Kuyruk eşzamanlı mola kotasına takılan ve süpervizör onayı bekleyen mola taleplerini listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Mola Kararı (POST)",
                "path": "/api/supervisor/break-requests/{req_id}/decide",
                "scope": "supervisor:agent_status",
                "title": "Temsilci Mola Talebini Onayla veya Reddet",
                "description": "Bekleyen bir mola talebini `approve` veya `reject` kararıyla sonuçlandırır.",
                "sample_body": {"decision": "approve", "note": "Onaylandı"},
            },
            {
                "method": "GET",
                "method_tr": "Hot-Desk Oturumları (GET)",
                "path": "/api/hotdesk/sessions",
                "scope": "users:read",
                "title": "Aktif Hot-Desking (Ortak Masa Telefonu) Oturumlarını Listele",
                "description": "*75 kodu ile fiziksel masa telefonuna oturum açmış tüm kullanıcı-cihaz eşleşmelerini listeler.",
                "sample_body": None,
            },
            {
                "method": "DELETE",
                "method_tr": "Hot-Desk Çıkış (DELETE)",
                "path": "/api/hotdesk/sessions/{session_key}",
                "scope": "users:write",
                "title": "Hot-Desking Oturumunu Uzaktan Sonlandır",
                "description": "Bir temsilcinin fiziksel masa telefonundaki Hot-Desk oturumunu yönetici panelinden/API'den kapatır.",
                "sample_body": None,
            },
        ],
    },
    {
        "category": "15. Çok-Şubeli Santral (Federation), Nornia Connect, Ağ & AI Konfigürasyon API",
        "scope_module": "infrastructure",
        "auth_type": "session",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma (GET)",
                "path": "/api/federation/node-config",
                "scope": "federation_multisite:read",
                "title": "Santralin Multi-Site Rolünü (Standalone / Hub / Edge) Oku",
                "description": "Sunucunun dağıtık santral mimarisindeki rolünü, şube kodunu, medya politikasını ve SRST Failover durumunu döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Şube Listesi (GET)",
                "path": "/api/federation/sites",
                "scope": "federation_multisite:read",
                "title": "Bağlı Şube (Edge) Santrallerini Listele",
                "description": "Merkez Hub'a bağlı tüm şube santrallerinin çevrimiçi sağlık, son heartbeat ve yapılandırma senkronizasyon durumlarını listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Konfigürasyon İtme (POST)",
                "path": "/api/federation/sites/{site_code}/push-config",
                "scope": "federation_multisite:write",
                "title": "Şube Santraline Anlık Konfigürasyon Gönder (Push)",
                "description": "Merkezde yapılan dahili, dialplan veya kural değişikliklerini belirtilen şube santraline anında senkronize eder.",
                "sample_body": {"force": True},
            },
            {
                "method": "GET",
                "method_tr": "Durum (GET)",
                "path": "/api/settings/ras/status",
                "scope": "ras_settings:read",
                "title": "Nornia Connect (Sıfır-Port Bulut Köprüsü) Tünel Durumu",
                "description": "HTTPS bulut tüneli, WireGuard SIP Edge bağlantısı, kilitli alt alan adı (FQDN) ve bağlantı gecikmesini döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Yeniden Bağlan (POST)",
                "path": "/api/settings/ras/reconnect",
                "scope": "ras_settings:write",
                "title": "Nornia Connect Bulut Tünelini Yeniden Başlat",
                "description": "Hub ile olan sıfır-port bulut tünelini ve SIP Edge köprüsünü kesintisiz yeniler.",
                "sample_body": {},
            },
            {
                "method": "GET",
                "method_tr": "Ağ Durumu (GET)",
                "path": "/api/settings/network/status",
                "scope": "server_network:read",
                "title": "Sunucu Ağ Arayüzleri (NIC), IP ve Statik Rotaları Oku",
                "description": "Linux ağ kartlarını (enp0s3/eth0), IPv4/CIDR adreslerini, gateway, DNS ve özel SIP/MPLS statik rotalarını döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "AI Plan Üret (POST)",
                "path": "/api/ai-config-assistant/plan",
                "scope": "ai_config_assistant:write",
                "title": "AI Konfigürasyon Asistanı — Doğal Dilden Değişiklik Planı Üret",
                "description": "Türkçe yönetici komutunu (örn. '1020-1025 arası satış dahili aç ve 6000 kuyruğuna ekle') önizlenebilir ve geri alınabilir güvenli bir aksiyon planına çevirir.",
                "sample_body": {"prompt": "Mesai dışı saatlerde 0850 hattına gelen çağrıları AI karşılama asistanına yönlendir"},
            },
            {
                "method": "POST",
                "method_tr": "AI Plan Uygula (POST)",
                "path": "/api/ai-config-assistant/apply",
                "scope": "ai_config_assistant:write",
                "title": "AI Konfigürasyon Planını Snapshot Alarak Uygula",
                "description": "Üretilen konfigürasyon planını otomatik geri yükleme noktası (snapshot) alarak santrale uygular.",
                "sample_body": {"plan_id": "plan_9f82a1"},
            },
            {
                "method": "POST",
                "method_tr": "Geri Al (POST)",
                "path": "/api/ai-config-assistant/undo/{snapshot_id}",
                "scope": "ai_config_assistant:write",
                "title": "AI Konfigürasyon Değişikliğini Tek Tıkla Geri Al",
                "description": "Belirtilen snapshot kimliğine dönerek tüm santral değişikliklerini saniyeler içinde geri alır.",
                "sample_body": {},
            },
        ],
    },
    {
        "category": "16. Gelen Kanal Webhook'ları, SIP Hata Ayıklama (PCAP) & Sistem Sağlığı API",
        "scope_module": "webhooks_diag",
        "auth_type": "webhook",
        "items": [
            {
                "method": "GET",
                "method_tr": "Webhook Doğrulama (GET)",
                "path": "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=12345",
                "scope": "webhook:meta",
                "title": "WhatsApp Meta Cloud API Webhook Doğrulama (Challenge)",
                "description": "Meta Developer Console kurulumunda `hub.verify_token` doğrulaması yaparak `hub.challenge` değerini döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Gelen Mesaj (POST)",
                "path": "/api/webhooks/whatsapp",
                "scope": "webhook:meta",
                "title": "WhatsApp Gelen Mesaj ve Durum Bildirimi Alıcısı",
                "description": "Meta WhatsApp Business Cloud API'den gelen müşteri mesajlarını, buton tıklamalarını ve teslimat raporlarını (sent/delivered/read) işler.",
                "sample_body": {"object": "whatsapp_business_account", "entry": [{"id": "WABA_ID", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "1391907340666153"}}}]}]},
            },
            {
                "method": "POST",
                "method_tr": "Gelen Mesaj (POST)",
                "path": "/api/webhooks/telegram",
                "scope": "webhook:telegram",
                "title": "Telegram Bot API Webhook Alıcısı",
                "description": "Telegram Bot'a gelen müşteri mesajlarını otomatik olarak Ortak Gelen Kutusu'na ve AI yanıt motoruna yönlendirir.",
                "sample_body": {"update_id": 891234, "message": {"chat": {"id": 123456789}, "text": "Merhaba, destek alabilir miyim?"}},
            },
            {
                "method": "GET",
                "method_tr": "SIP Çağrı İzleme (GET)",
                "path": "/api/sip-debugger/calls",
                "scope": "troubleshooting:access",
                "title": "Canlı SIP Paket & Çağrı Akışlarını Listele (Web sngrep)",
                "description": "UDP/TCP 5060/5061 ve WSS 8089 üzerinden yakalanan SIP oturumlarını Call-ID bazında gruplanmış olarak döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "PCAP İndirme (GET)",
                "path": "/api/sip-debugger/calls/{call_id}/pcap",
                "scope": "troubleshooting:access",
                "title": "Seçili Çağrının Wireshark / sngrep Uyumlu PCAP Dosyasını İndir",
                "description": "Belirtilen SIP çağrısının tüm paketlerini Ethernet/IP/UDP başlıklarıyla standart `.pcap` ikili dosyası olarak indirir.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Ağ Tanılama (POST)",
                "path": "/api/sip-debugger/diagnostics/ping",
                "scope": "troubleshooting:access",
                "title": "SIP Trunk / Hedef Sunucu Ping & Gecikme Testi",
                "description": "Operatör SIP sunucusuna veya belirtilen IP/domain adresine ICMP ping atarak RTT gecikme ve paket kaybını ölçer.",
                "sample_body": {"target": "sip.operatortelekom.com.tr", "count": 4},
            },
            {
                "method": "POST",
                "method_tr": "Rota İzleme (POST)",
                "path": "/api/sip-debugger/diagnostics/traceroute",
                "scope": "troubleshooting:access",
                "title": "Ağ Güzergahı (Traceroute) Analizi",
                "description": "Santralden operatör SBC veya uzak şubeye kadar tüm ağ atlama noktalarını (hop) ve gecikmelerini raporlar.",
                "sample_body": {"target": "sip.operatortelekom.com.tr"},
            },
            {
                "method": "GET",
                "method_tr": "Sistem Özeti (GET)",
                "path": "/api/system/overview",
                "scope": "system_status:access",
                "title": "Santral Donanım, Ağ, FQDN & Lisans Özet Bilgisi",
                "description": "CPU/RAM/Disk, Asterisk durumu, LAN/WAN/NAT IP bilgileri, aktif FQDN ve donanım kilidi lisans özetini döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Sürüm Bilgisi (GET)",
                "path": "/api/version",
                "scope": "public",
                "title": "Santral Sürüm Kodu ve Değişiklik Günlüğü (Changelog)",
                "description": "Santralde yüklü güncel yazılım sürümünü (`v3.x.x`), yayın tarihini ve sürüm notlarını döndürür.",
                "sample_body": None,
            },
        ],
    },
]

WEBHOOK_EVENTS = [
    {
        "event": "call.ringing",
        "title": "Çağrı Çalıyor (Gelen / Giden)",
        "description": "Santrale yeni bir çağrı ulaştığında veya temsilci telefonu çalmaya başladığında tetiklenir. CTI Screen Pop ve CRM arayan tanıma için idealdir.",
        "payload": {
            "event": "call.ringing",
            "timestamp": "2026-11-23T14:15:10+03:00",
            "tenant_id": "tenant-default",
            "data": {
                "call_id": "aida-1763890123-4918",
                "direction": "inbound",
                "caller_number": "05321234567",
                "did_number": "908503607390",
                "target_extension": "1000",
                "queue": "6000"
            }
        }
    },
    {
        "event": "call.answered",
        "title": "Çağrı Cevaplandı",
        "description": "Temsilci veya Yapay Zeka Asistanı çağrıyı açtığı anda tetiklenir.",
        "payload": {
            "event": "call.answered",
            "timestamp": "2026-11-23T14:15:16+03:00",
            "tenant_id": "tenant-default",
            "data": {
                "call_id": "aida-1763890123-4918",
                "caller_number": "05321234567",
                "agent_extension": "1000",
                "agent_name": "Ahmet Yılmaz",
                "wait_sec": 6
            }
        }
    },
    {
        "event": "call.transferred",
        "title": "Çağrı Aktarıldı (Transfer)",
        "description": "Görüşme başka bir dahiliye, kuyruğa veya dış numaraya aktarıldığında tetiklenir.",
        "payload": {
            "event": "call.transferred",
            "timestamp": "2026-11-23T14:16:45+03:00",
            "tenant_id": "tenant-default",
            "data": {
                "call_id": "aida-1763890123-4918",
                "from_extension": "1000",
                "to_extension": "1002",
                "transfer_type": "attended"
            }
        }
    },
    {
        "event": "call.ended",
        "title": "Çağrı Sonlandı (CDR & Ses Kaydı Hazır)",
        "description": "Görüşme kapandığında toplam süre, konuşma süresi, sonuç durumu ve ses kaydı bağlantısı ile birlikte gönderilir.",
        "payload": {
            "event": "call.ended",
            "timestamp": "2026-11-23T14:18:14+03:00",
            "tenant_id": "tenant-default",
            "data": {
                "call_id": "aida-1763890123-4918",
                "disposition": "ANSWERED",
                "duration_sec": 184,
                "talk_sec": 171,
                "recording_url": "/api/v1/cdr/aida-1763890123-4918/recording",
                "sentiment": "positive"
            }
        }
    }
]

ERROR_CODES = [
    {"code": 200, "name": "OK", "meaning": "İstek başarıyla işlendi."},
    {"code": 400, "name": "Bad Request", "meaning": "Eksik veya geçersiz parametre / JSON gövdesi."},
    {"code": 401, "name": "Unauthorized", "meaning": "X-API-Key veya Bearer token eksik, geçersiz veya iptal edilmiş."},
    {"code": 403, "name": "Forbidden", "meaning": "API anahtarının bu uç nokta için gerekli Scope yetkisi yok veya istemci IP adresi Beyaz Liste (Whitelist) dışında."},
    {"code": 404, "name": "Not Found", "meaning": "İstenen çağrı, dahili, kuyruk veya kayıt bulunamadı."},
    {"code": 429, "name": "Too Many Requests", "meaning": "Dakikalık API hız limiti (Rate Limit) veya hatalı giriş koruması aşıldı."},
    {"code": 500, "name": "Internal Server Error", "meaning": "Beklenmeyen sunucu hatası; X-Request-ID ile destek ekibine iletebilirsiniz."}
]


def slugify(text: str) -> str:
    tr_map = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    s = text.translate(tr_map).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def extract_params(path: str):
    base_path, _, query_str = path.partition("?")
    path_params = []
    desc_map = {
        "call_id": "Çağrının benzersiz kimliği (örn. aida-1763890123-4918)",
        "extension": "Hedef dahili numarası veya kullanıcı ID (örn. 1000)",
        "queue_id": "ACD kuyruk kimliği veya kuyruk numarası (örn. 6000)",
        "rule_id": "Arama kuralı kimliği (ID)",
        "contact_id": "Rehber kişi kayıt kimliği (ID)",
        "campaign_id": "Dış arama kampanya kimliği (ID)",
        "session_id": "Omnichannel sohbet oturum kimliği",
        "task_id": "Geri arama (Callback) görev kimliği",
        "req_id": "Mola onay talep kimliği",
        "session_key": "Hot-Desking oturum anahtarı",
        "site_code": "Şube santrali benzersiz kodu (örn. ANKARA-01)",
        "snapshot_id": "AI Konfigürasyon geri alma snapshot kimliği",
        "crm_id": "CRM entegrasyon kimliği",
    }
    for name in re.findall(r"\{([a-zA-Z0-9_]+)\}", base_path):
        path_params.append({
            "name": name,
            "in": "path",
            "required": True,
            "type": "string",
            "description": desc_map.get(name, f"{name} parametresi")
        })
    query_params = []
    if query_str:
        for pair in query_str.split("&"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                query_params.append({
                    "name": k,
                    "in": "query",
                    "required": False,
                    "type": "integer" if v.isdigit() else "string",
                    "example": v,
                    "description": f"İsteğe bağlı filtre parametresi (örn. {v})"
                })
    return base_path, path_params, query_params


def build_catalog():
    version = extract_pbx_version()
    perm_modules, ext_v1_categories = load_external_api_structures()

    all_raw_categories = []
    for c in ext_v1_categories:
        c_copy = dict(c)
        c_copy["auth_type"] = "api_key"
        all_raw_categories.append(c_copy)
    for c in PLATFORM_API_CATEGORIES:
        all_raw_categories.append(dict(c))

    categories = []
    openapi_paths = {}
    postman_folders = []
    seen_ep_ids = set()

    for idx, cat in enumerate(all_raw_categories):
        cat_slug = slugify(cat["category"])
        cat_auth_type = cat.get("auth_type", "api_key")
        items_out = []
        pm_items = []

        for item in cat["items"]:
            method = item["method"].upper()
            raw_path = item["path"]
            base_path, path_params, query_params = extract_params(raw_path)
            ep_id = f"{method.lower()}-{slugify(base_path)}"
            if ep_id in seen_ep_ids:
                ep_id = f"{ep_id}-{idx + 1}"
            seen_ep_ids.add(ep_id)

            auth_type = item.get("auth_type") or cat_auth_type
            sample_body = item.get("sample_body")
            sample_resp = SAMPLE_RESPONSES.get(base_path) or {
                "status": "ok",
                "message": "İşlem başarıyla tamamlandı."
            }

            ep_obj = {
                "id": ep_id,
                "method": method,
                "method_tr": item.get("method_tr") or method,
                "path": raw_path,
                "base_path": base_path,
                "scope": item["scope"],
                "auth_type": auth_type,
                "title": item["title"],
                "description": item["description"],
                "path_params": path_params,
                "query_params": query_params,
                "sample_body": sample_body,
                "sample_response": sample_resp,
            }
            items_out.append(ep_obj)

            # OpenAPI 3.1 entry
            sec = [{"ApiKeyAuth": []}, {"BearerAuth": []}] if auth_type == "api_key" else ([{"SessionUserAuth": []}] if auth_type == "session" else [])
            oa_op = {
                "tags": [cat["category"]],
                "summary": item["title"],
                "description": item["description"],
                "operationId": ep_id.replace("-", "_"),
                "security": sec,
                "x-nornia-scope": item["scope"],
                "x-nornia-auth-type": auth_type,
                "responses": {
                    "200": {
                        "description": "Başarılı yanıt",
                        "content": {"application/json": {"example": sample_resp}}
                    },
                    "401": {"description": "Geçersiz veya eksik kimlik bilgisi"},
                    "403": {"description": f"Yetersiz yetki (Gerekli scope: {item['scope']})"}
                }
            }
            oa_params = [
                {
                    "name": p["name"],
                    "in": p["in"],
                    "required": p["required"],
                    "description": p["description"],
                    "schema": {"type": p["type"]}
                }
                for p in path_params + query_params
            ]
            if oa_params:
                oa_op["parameters"] = oa_params
            if sample_body is not None and method in ("POST", "PUT", "PATCH"):
                oa_op["requestBody"] = {
                    "required": True,
                    "content": {"application/json": {"example": sample_body}}
                }
            openapi_paths.setdefault(base_path, {})[method.lower()] = oa_op

            # Postman item
            pm_url_raw = "{{base_url}}" + (
                raw_path
                .replace("{call_id}", "aida-1763890123-4918")
                .replace("{extension}", "1000")
                .replace("{queue_id}", "6000")
                .replace("{rule_id}", "1")
                .replace("{contact_id}", "512")
                .replace("{campaign_id}", "1")
                .replace("{session_id}", "sess_101")
                .replace("{task_id}", "42")
                .replace("{req_id}", "12")
                .replace("{session_key}", "1000@192.168.1.50")
                .replace("{site_code}", "ANKARA-01")
                .replace("{snapshot_id}", "snap_20261123")
                .replace("{crm_id}", "hubspot")
            )
            pm_headers = [{"key": "Content-Type", "value": "application/json", "type": "text"}]
            if auth_type == "api_key":
                pm_headers.insert(0, {"key": "X-API-Key", "value": "{{api_key}}", "type": "text"})
            elif auth_type == "session":
                pm_headers.insert(0, {"key": "X-User-ID", "value": "{{user_id}}", "type": "text"})
                pm_headers.insert(1, {"key": "X-Tenant-ID", "value": "{{tenant_id}}", "type": "text"})
            pm_req = {
                "method": method,
                "header": pm_headers,
                "url": {"raw": pm_url_raw, "host": ["{{base_url}}"], "path": [seg for seg in base_path.strip("/").split("/")]},
                "description": f"{item['description']}\n\nAuth Tipi: `{auth_type}` | Gerekli Yetki (Scope): `{item['scope']}`"
            }
            if sample_body is not None and method in ("POST", "PUT", "PATCH"):
                pm_req["body"] = {"mode": "raw", "raw": json.dumps(sample_body, ensure_ascii=False, indent=2)}
            pm_items.append({"name": item["title"], "request": pm_req})

        categories.append({
            "id": cat_slug,
            "index": idx + 1,
            "title": cat["category"],
            "scope_module": cat["scope_module"],
            "auth_type": cat_auth_type,
            "endpoints": items_out
        })
        postman_folders.append({"name": cat["category"], "item": pm_items})

    v1_count = sum(len(c["endpoints"]) for c in categories if c["auth_type"] == "api_key")
    total_count = sum(len(c["endpoints"]) for c in categories)

    catalog_doc = {
        "version": version,
        "api_version": "v1",
        "base_url_example": "https://musteri.nornia.com.tr",
        "total_endpoints": total_count,
        "v1_endpoints_count": v1_count,
        "platform_endpoints_count": total_count - v1_count,
        "permission_modules": perm_modules,
        "categories": categories,
        "webhooks": WEBHOOK_EVENTS,
        "error_codes": ERROR_CODES,
    }

    openapi_doc = {
        "openapi": "3.1.0",
        "info": {
            "title": "Nornia Enterprise AI PBX — Tam API Referansı (External v1 + Platform)",
            "version": version,
            "description": "Nornia Santral, Çağrı Merkezi, CRM/CTI, Dialer, Omnichannel, RAG/Yapay Zeka, Kurumsal Raporlama, Multi-Site Federation ve SIP Hata Ayıklama için tam REST API spesifikasyonu."
        },
        "servers": [
            {"url": "https://{santral}.nornia.com.tr", "description": "Nornia Bulut FQDN Santral Adresi", "variables": {"santral": {"default": "musteri"}}},
            {"url": "http://{yerel_ip}:8000", "description": "Yerel Ağ (LAN) Santral Adresi", "variables": {"yerel_ip": {"default": "192.168.1.25"}}}
        ],
        "components": {
            "securitySchemes": {
                "ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "X-API-Key"},
                "BearerAuth": {"type": "http", "scheme": "bearer"},
                "SessionUserAuth": {"type": "apiKey", "in": "header", "name": "X-User-ID"}
            }
        },
        "paths": openapi_paths
    }

    postman_doc = {
        "info": {
            "name": f"Nornia Enterprise PBX Tam API Koleksiyonu ({version})",
            "description": "Nornia Enterprise AI PBX Kurumsal Dış API v1 + Tüm Platform & Entegrasyon API'leri Postman Koleksiyonu.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "variable": [
            {"key": "base_url", "value": "https://musteri.nornia.com.tr"},
            {"key": "api_key", "value": "aida_live_default_BURAYA_ANAHTARINIZI_YAZIN"},
            {"key": "user_id", "value": "admin"},
            {"key": "tenant_id", "value": "tenant-default"}
        ],
        "item": postman_folders
    }

    (OUT_DATA_DIR / "api-catalog.json").write_text(json.dumps(catalog_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_PUBLIC_DIR / "openapi.json").write_text(json.dumps(openapi_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_PUBLIC_DIR / "nornia-api.postman_collection.json").write_text(json.dumps(postman_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] Exported {total_count} total endpoints ({v1_count} External v1 + {total_count - v1_count} Platform/Integration) across {len(categories)} categories ({version})")


if __name__ == "__main__":
    build_catalog()
