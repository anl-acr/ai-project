#!/usr/bin/env python3
"""
Nornia Enterprise API Portal — Single-Source Catalog, OpenAPI 3.1 & Postman Exporter
====================================================================================
Reads `backend/services/external_api_service.py` directly and writes:
  1. portals/api-portal/data/api-catalog.json
  2. portals/api-portal/public/openapi.json
  3. portals/api-portal/public/nornia-api.postman_collection.json
"""

import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

# Import pure catalog structures without requiring FastAPI runtime if unavailable
from backend.services import external_api_service as ext_api

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


SAMPLE_RESPONSES = {
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
    }
}

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
    for name in re.findall(r"\{([a-zA-Z0-9_]+)\}", base_path):
        desc_map = {
            "call_id": "Çağrının benzersiz kimliği (örn. aida-1763890123-4918)",
            "extension": "Hedef dahili numarası (örn. 1000)",
            "queue_id": "ACD kuyruk kimliği veya numarası (örn. 6000)",
        }
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
    categories = []
    openapi_paths = {}
    postman_folders = []

    for idx, cat in enumerate(ext_api.API_ENDPOINTS_CATALOG):
        cat_slug = slugify(cat["category"])
        items_out = []
        pm_items = []

        for j, item in enumerate(cat["items"]):
            method = item["method"].upper()
            raw_path = item["path"]
            base_path, path_params, query_params = extract_params(raw_path)
            ep_id = f"{method.lower()}-{slugify(base_path)}"
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
                "title": item["title"],
                "description": item["description"],
                "path_params": path_params,
                "query_params": query_params,
                "sample_body": sample_body,
                "sample_response": sample_resp,
            }
            items_out.append(ep_obj)

            # OpenAPI 3.1 entry
            oa_op = {
                "tags": [cat["category"]],
                "summary": item["title"],
                "description": item["description"],
                "operationId": ep_id.replace("-", "_"),
                "security": [{"ApiKeyAuth": []}, {"BearerAuth": []}],
                "x-nornia-scope": item["scope"],
                "responses": {
                    "200": {
                        "description": "Başarılı yanıt",
                        "content": {
                            "application/json": {
                                "example": sample_resp
                            }
                        }
                    },
                    "401": {"description": "Geçersiz veya eksik API anahtarı"},
                    "403": {"description": f"Yetersiz yetki (Gerekli scope: {item['scope']})"}
                }
            }
            oa_params = []
            for p in path_params + query_params:
                oa_params.append({
                    "name": p["name"],
                    "in": p["in"],
                    "required": p["required"],
                    "description": p["description"],
                    "schema": {"type": p["type"]}
                })
            if oa_params:
                oa_op["parameters"] = oa_params
            if sample_body is not None and method in ("POST", "PUT", "PATCH"):
                oa_op["requestBody"] = {
                    "required": True,
                    "content": {
                        "application/json": {
                            "example": sample_body
                        }
                    }
                }
            openapi_paths.setdefault(base_path, {})[method.lower()] = oa_op

            # Postman item
            pm_url_raw = "{{base_url}}" + raw_path.replace("{call_id}", "aida-1763890123-4918").replace("{extension}", "1000").replace("{queue_id}", "6000")
            pm_req = {
                "method": method,
                "header": [
                    {"key": "X-API-Key", "value": "{{api_key}}", "type": "text"},
                    {"key": "Content-Type", "value": "application/json", "type": "text"}
                ],
                "url": {"raw": pm_url_raw, "host": ["{{base_url}}"], "path": [seg for seg in base_path.strip("/").split("/")]},
                "description": f"{item['description']}\n\nGerekli Yetki (Scope): `{item['scope']}`"
            }
            if sample_body is not None and method in ("POST", "PUT", "PATCH"):
                pm_req["body"] = {
                    "mode": "raw",
                    "raw": json.dumps(sample_body, ensure_ascii=False, indent=2)
                }
            pm_items.append({"name": item["title"], "request": pm_req})

        categories.append({
            "id": cat_slug,
            "index": idx + 1,
            "title": cat["category"],
            "scope_module": cat["scope_module"],
            "endpoints": items_out
        })
        postman_folders.append({"name": cat["category"], "item": pm_items})

    catalog_doc = {
        "version": version,
        "api_version": "v1",
        "base_url_example": "https://musteri.nornia.com.tr",
        "total_endpoints": sum(len(c["endpoints"]) for c in categories),
        "permission_modules": ext_api.API_PERMISSION_MODULES,
        "categories": categories,
        "webhooks": WEBHOOK_EVENTS,
        "error_codes": ERROR_CODES,
    }

    openapi_doc = {
        "openapi": "3.1.0",
        "info": {
            "title": "Nornia Enterprise AI PBX — Kurumsal Dış API (v1)",
            "version": version,
            "description": "Nornia Santral, Çağrı Merkezi, CRM/CTI, Omnichannel ve Yapay Zeka Asistanı entegrasyonları için resmi REST API spesifikasyonu."
        },
        "servers": [
            {"url": "https://{santral}.nornia.com.tr", "description": "Nornia Bulut FQDN Santral Adresi", "variables": {"santral": {"default": "musteri"}}},
            {"url": "http://{yerel_ip}:8000", "description": "Yerel Ağ (LAN) Santral Adresi", "variables": {"yerel_ip": {"default": "192.168.1.25"}}}
        ],
        "components": {
            "securitySchemes": {
                "ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "X-API-Key"},
                "BearerAuth": {"type": "http", "scheme": "bearer"}
            }
        },
        "paths": openapi_paths
    }

    postman_doc = {
        "info": {
            "name": f"Nornia Enterprise PBX API ({version})",
            "description": "Nornia Enterprise AI PBX Kurumsal Dış API v1 Postman Koleksiyonu.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "variable": [
            {"key": "base_url", "value": "https://musteri.nornia.com.tr"},
            {"key": "api_key", "value": "aida_live_default_BURAYA_ANAHTARINIZI_YAZIN"}
        ],
        "item": postman_folders
    }

    (OUT_DATA_DIR / "api-catalog.json").write_text(json.dumps(catalog_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_PUBLIC_DIR / "openapi.json").write_text(json.dumps(openapi_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_PUBLIC_DIR / "nornia-api.postman_collection.json").write_text(json.dumps(postman_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] Exported {catalog_doc['total_endpoints']} endpoints across {len(categories)} categories ({version})")


if __name__ == "__main__":
    build_catalog()
