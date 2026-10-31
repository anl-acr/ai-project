import asyncio
import copy
import datetime
import ipaddress
import json
import os
import re
import subprocess
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Body, HTTPException, Request
from sqlalchemy import delete, or_, select

from backend.database.config import AsyncSessionLocal
from backend.database.models import (
    Appointment,
    BlacklistItem,
    BlockWord,
    BreakType,
    CannedResponse,
    Contact,
    DocumentChunk,
    PBXQueue,
    QAQuestion,
    Rule,
    SystemRole,
    SystemUser,
    Trunk,
)
from backend.services.advanced_reports_service import (
    _apply_tenant_clause,
    _extract_tenant_id,
    _is_default_tenant,
    _is_global_tenant,
    _match_dict_tenant,
)

ai_config_assistant_router = APIRouter()

# ============================================================================
# 1. FULL-SCOPE ACTION PERMISSION MAP (26 MODULES / 78 CANONICAL ACTIONS)
# ============================================================================

ACTION_PERMISSION_MAP: Dict[str, Tuple[str, str]] = {
    # 1. Kullanıcılar & Dahililer
    "create_user": ("users:write", "Kullanıcı & Dahili Oluşturma"),
    "update_user": ("users:write", "Kullanıcı / Dahili Bilgi & Özellik Güncelleme"),
    "delete_user": ("users:delete", "Kullanıcı & Dahili Silme"),
    "update_user_forwarding": ("users:write", "Abone Çağrı Yönlendirme & GSM Ayarı"),
    # 2. ACD Çağrı Kuyrukları
    "create_queue": ("acd_queues:write", "ACD Çağrı Kuyruğu Oluşturma"),
    "update_queue": ("acd_queues:write", "ACD Kuyruk Parametre & Özellik Güncelleme"),
    "add_queue_members": ("acd_queues:write", "Kuyruğa Temsilci Atama"),
    "remove_queue_members": ("acd_queues:write", "Kuyruktan Temsilci Çıkarma"),
    "delete_queue": ("acd_queues:delete", "ACD Çağrı Kuyruğu Silme"),
    # 3. Yapay Zeka Sesli Asistanlar & Senaryo
    "create_ai_agent": ("ai_agents:write", "Yapay Zeka Sesli Asistan Oluşturma"),
    "update_ai_agent": ("ai_agents:write", "Yapay Zeka Asistan Ayar & Talimat Güncelleme"),
    "generate_ai_agent_scenario": ("ai_agents:write", "AI Asistan Görsel Senaryo Akışı Tasarlama"),
    "delete_ai_agent": ("ai_agents:delete", "Yapay Zeka Sesli Asistan Silme"),
    # 4. Konferans Odaları
    "create_conference": ("conferences:write", "Konferans Odası Oluşturma"),
    "update_conference": ("conferences:write", "Konferans Odası İsim, PIN & Katılımcı Güncelleme"),
    "delete_conference": ("conferences:delete", "Konferans Odası Silme"),
    # 5. Mola Tanımları
    "create_break_type": ("breaks:write", "Mola Tanımı Ekleme"),
    "update_break_type": ("breaks:write", "Mola Tanımı İsim, Süre & Kota Güncelleme"),
    "delete_break_type": ("breaks:delete", "Mola Tanımı Silme"),
    # 6. Departmanlar & Lokasyonlar
    "create_department": ("locations:write", "Departman Oluşturma"),
    "update_department": ("locations:write", "Departman İsim Güncelleme"),
    "delete_department": ("locations:delete", "Departman Silme"),
    "create_location": ("locations:write", "Lokasyon / Şube Oluşturma"),
    "update_location": ("locations:write", "Lokasyon / Şube İsim Güncelleme"),
    "delete_location": ("locations:delete", "Lokasyon / Şube Silme"),
    # 7. Abone Grupları & Çağrı Toplama Grupları
    "create_subscriber_group": ("subscriber_groups:write", "Abone Grubu Oluşturma"),
    "update_subscriber_group": ("subscriber_groups:write", "Abone Grubu İsim & Üye Güncelleme"),
    "delete_subscriber_group": ("subscriber_groups:delete", "Abone Grubu Silme"),
    "create_pickup_group": ("call_pickup_groups:write", "Çağrı Toplama Grubu Oluşturma"),
    "update_pickup_group": ("call_pickup_groups:write", "Çağrı Toplama Grubu İsim & Üye Güncelleme"),
    "delete_pickup_group": ("call_pickup_groups:delete", "Çağrı Toplama Grubu Silme"),
    # 8. Hızlı Aramalar (Speed Dials)
    "create_speed_dial": ("speed_dials:write", "Hızlı Arama Kısa Kodu Ekleme"),
    "update_speed_dial": ("speed_dials:write", "Hızlı Arama Kısa Kodu Güncelleme"),
    "delete_speed_dial": ("speed_dials:delete", "Hızlı Arama Kısa Kodu Silme"),
    # 9. SIP Dış Hatlar (Trunks)
    "create_trunk": ("trunks:write", "SIP Dış Hat (Trunk) Oluşturma"),
    "update_trunk": ("trunks:write", "SIP Dış Hat (Trunk) Ayar Güncelleme"),
    "delete_trunk": ("trunks:delete", "SIP Dış Hat (Trunk) Silme"),
    # 10. Gelen Arama Kuralları (Inbound DID)
    "create_inbound_rule": ("inbound_rules:write", "Gelen Arama (DID) Kuralı Oluşturma"),
    "update_inbound_rule": ("inbound_rules:write", "Gelen Arama (DID) Kuralı Güncelleme"),
    "delete_inbound_rule": ("inbound_rules:delete", "Gelen Arama (DID) Kuralı Silme"),
    # 11. Giden Arama Kuralları (Outbound Dialplan)
    "create_outbound_rule": ("outbound_rules:write", "Giden Arama Kuralı Oluşturma"),
    "update_outbound_rule": ("outbound_rules:write", "Giden Arama Kuralı Güncelleme"),
    "delete_outbound_rule": ("outbound_rules:delete", "Giden Arama Kuralı Silme"),
    # 12. Arama Akış Yönetimi (Görsel IVR / Call Flow)
    "create_call_flow": ("call_flow:write", "Arama Akışı (IVR Senaryosu) Oluşturma"),
    "update_call_flow": ("call_flow:write", "Arama Akışı (IVR) Güncelleme"),
    "delete_call_flow": ("call_flow:delete", "Arama Akışı (IVR) Silme"),
    # 13. Anons Yönetimi & AI TTS Seslendirme
    "create_tts_announcement": ("announcements:write", "Metinden AI Sesli Anons (TTS) Üretme"),
    "update_announcement": ("announcements:write", "Anons İsim & Tür Güncelleme"),
    "delete_announcement": ("announcements:delete", "Sesli Anons Silme"),
    # 14. Numara Planı & Özellik Kodları
    "update_numbering_plan": ("numbering_plan:write", "Numara Planı & Prefix Kodları Güncelleme"),
    # 15. Kurumsal Rehber (Contacts)
    "create_contact": ("contacts:write", "Rehbere Kişi Ekleme"),
    "update_contact": ("contacts:write", "Rehber Kişi Bilgisi Güncelleme"),
    "delete_contact": ("contacts:delete", "Rehberden Kişi Silme"),
    # 16. Hızlı Cevap Şablonları (Canned Responses)
    "create_canned_response": ("canned_responses:write", "Hızlı Cevap Şablonu Ekleme"),
    "update_canned_response": ("canned_responses:write", "Hızlı Cevap Şablonu Güncelleme"),
    "delete_canned_response": ("canned_responses:delete", "Hızlı Cevap Şablonu Silme"),
    # 17. Kara Liste & Yasaklı Kelimeler
    "add_blacklist": ("blacklist:write", "Kara Liste Numara / E-Posta Engelleme"),
    "remove_blacklist": ("blacklist:delete", "Kara Listeden Engel Kaldırma"),
    "add_block_word": ("blacklist:write", "Yasaklı / Argo Kelime Ekleme"),
    "remove_block_word": ("blacklist:delete", "Yasaklı Kelime Kaldırma"),
    # 18. Bilgi Bankası (RAG) & Kural Editörü
    "add_kb_text": ("rag_kb:write", "Bilgi Bankasına (RAG) Metin / SSS Öğretme"),
    "crawl_kb_url": ("rag_kb:write", "Bilgi Bankasına Web Sitesi URL Taratma"),
    "delete_kb_source": ("rag_kb:delete", "Bilgi Bankası Kaynağı Silme"),
    "create_ai_rule": ("rule_editor:write", "AI Kural & Davranış Tanımı Ekleme"),
    "update_ai_rule": ("rule_editor:write", "AI Kural & Davranış Tanımı Güncelleme"),
    "delete_ai_rule": ("rule_editor:delete", "AI Kural Tanımı Silme"),
    # 19. Çağrı Kalite Kontrol (QA) Kriterleri
    "create_qa_question": ("qa:write", "Çağrı Kalite (QA) Değerlendirme Sorusu Ekleme"),
    "update_qa_question": ("qa:write", "Çağrı Kalite (QA) Sorusu Güncelleme"),
    "delete_qa_question": ("qa:delete", "Çağrı Kalite (QA) Sorusu Silme"),
    # 20. Dış Arama Kampanyaları (Dialer)
    "create_dialer_campaign": ("dialer:write", "Dış Arama (Dialer) Kampanyası Oluşturma"),
    "update_dialer_campaign": ("dialer:write", "Dış Arama Kampanyası Başlatma / Durdurma / Güncelleme"),
    "delete_dialer_campaign": ("dialer:delete", "Dış Arama Kampanyası Silme"),
    # 21. Randevu Takvimi
    "create_appointment": ("calendar:write", "Müşteri Randevusu Oluşturma"),
    "update_appointment": ("calendar:write", "Randevu Tarihi / Bilgisi Güncelleme"),
    "cancel_appointment": ("calendar:delete", "Randevu İptal Etme / Silme"),
    # 22. Roller & Yetki Profilleri
    "create_role": ("roles:write", "Yetki Rolü Oluşturma"),
    "update_role": ("roles:write", "Rol Yetkileri & İzinleri Güncelleme"),
    "delete_role": ("roles:delete", "Yetki Rolü Silme"),
    # 23. Zamanlanmış Raporlar
    "create_scheduled_report": ("scheduled_reports:write", "Zamanlanmış Rapor Planlama"),
    "update_scheduled_report": ("scheduled_reports:write", "Zamanlanmış Rapor Güncelleme"),
    "delete_scheduled_report": ("scheduled_reports:delete", "Zamanlanmış Rapor Silme"),
    # 24. Kanal Entegrasyonları (WhatsApp) & Sistem / AI Modül Ayarları
    "update_whatsapp_settings": ("channels:write", "WhatsApp Mesai, Karşılama & AI Persona Ayarı"),
    "update_pbx_ai_features": ("pbx:write", "Santral, NAT & Yapay Zeka Modül Ayarı"),
    # 25. Güvenlik Kalkanı, Geri Yükleme Noktası & Canlı Süpervizör Müdahalesi
    "add_security_whitelist": ("security:write", "Güvenlik Kalkanı Güvenli IP (Whitelist) Ekleme"),
    "remove_security_whitelist": ("security:delete", "Güvenli IP Listesinden Çıkarma"),
    "create_restore_point": ("restore_points:write", "Sistem Geri Yükleme Noktası Oluşturma"),
    "set_agent_live_status": ("supervisor:agent_status", "Canlı Temsilci Durum Müdahalesi (Mola / Müsait)"),
}

_ACTION_TYPE_ALIASES: Dict[str, str] = {
    # Users
    "rename_user": "update_user",
    "edit_user": "update_user",
    "modify_user": "update_user",
    "change_user_name": "update_user",
    "rename_extension": "update_user",
    "update_extension": "update_user",
    "remove_user": "delete_user",
    "delete_extension": "delete_user",
    # Queues
    "rename_queue": "update_queue",
    "edit_queue": "update_queue",
    "modify_queue": "update_queue",
    "remove_queue": "delete_queue",
    "delete_queue_members": "remove_queue_members",
    # AI Agents
    "rename_ai_agent": "update_ai_agent",
    "rename_agent": "update_ai_agent",
    "update_agent": "update_ai_agent",
    "edit_ai_agent": "update_ai_agent",
    "remove_ai_agent": "delete_ai_agent",
    "create_agent_scenario": "generate_ai_agent_scenario",
    "update_ai_agent_scenario": "generate_ai_agent_scenario",
    # Conferences
    "rename_conference": "update_conference",
    "edit_conference": "update_conference",
    "remove_conference": "delete_conference",
    # Breaks
    "create_break": "create_break_type",
    "rename_break": "update_break_type",
    "rename_break_type": "update_break_type",
    "update_break": "update_break_type",
    "edit_break": "update_break_type",
    "delete_break": "delete_break_type",
    "remove_break": "delete_break_type",
    # Departments / Locations
    "rename_department": "update_department",
    "edit_department": "update_department",
    "remove_department": "delete_department",
    "rename_location": "update_location",
    "edit_location": "update_location",
    "remove_location": "delete_location",
    # Groups
    "rename_subscriber_group": "update_subscriber_group",
    "rename_group": "update_subscriber_group",
    "update_group": "update_subscriber_group",
    "add_subscriber_group_members": "update_subscriber_group",
    "remove_subscriber_group": "delete_subscriber_group",
    "delete_group": "delete_subscriber_group",
    "rename_pickup_group": "update_pickup_group",
    "remove_pickup_group": "delete_pickup_group",
    # Speed dials
    "rename_speed_dial": "update_speed_dial",
    "remove_speed_dial": "delete_speed_dial",
    # Trunks
    "add_trunk": "create_trunk",
    "rename_trunk": "update_trunk",
    "edit_trunk": "update_trunk",
    "remove_trunk": "delete_trunk",
    # Inbound / Outbound Rules
    "rename_inbound_rule": "update_inbound_rule",
    "edit_inbound_rule": "update_inbound_rule",
    "remove_inbound_rule": "delete_inbound_rule",
    "add_outbound_rule": "create_outbound_rule",
    "rename_outbound_rule": "update_outbound_rule",
    "edit_outbound_rule": "update_outbound_rule",
    "remove_outbound_rule": "delete_outbound_rule",
    # Call flows / IVR
    "create_ivr": "create_call_flow",
    "create_workflow": "create_call_flow",
    "update_ivr": "update_call_flow",
    "update_workflow": "update_call_flow",
    "rename_call_flow": "update_call_flow",
    "delete_ivr": "delete_call_flow",
    "delete_workflow": "delete_call_flow",
    "remove_call_flow": "delete_call_flow",
    # Announcements
    "create_announcement": "create_tts_announcement",
    "generate_announcement": "create_tts_announcement",
    "tts_announcement": "create_tts_announcement",
    "rename_announcement": "update_announcement",
    "remove_announcement": "delete_announcement",
    # Contacts
    "add_contact": "create_contact",
    "edit_contact": "update_contact",
    "rename_contact": "update_contact",
    "remove_contact": "delete_contact",
    # Canned responses
    "add_canned_response": "create_canned_response",
    "edit_canned_response": "update_canned_response",
    "remove_canned_response": "delete_canned_response",
    # Blacklist & Block words
    "delete_blacklist": "remove_blacklist",
    "unblock_number": "remove_blacklist",
    "create_block_word": "add_block_word",
    "delete_block_word": "remove_block_word",
    # Knowledge base & Rules
    "add_rag_text": "add_kb_text",
    "create_kb_text": "add_kb_text",
    "add_knowledge": "add_kb_text",
    "crawl_url": "crawl_kb_url",
    "index_url": "crawl_kb_url",
    "remove_kb_source": "delete_kb_source",
    "create_rule": "create_ai_rule",
    "add_rule": "create_ai_rule",
    "update_rule": "update_ai_rule",
    "delete_rule": "delete_ai_rule",
    # QA Questions
    "add_qa_question": "create_qa_question",
    "edit_qa_question": "update_qa_question",
    "remove_qa_question": "delete_qa_question",
    # Dialer
    "create_campaign": "create_dialer_campaign",
    "update_campaign": "update_dialer_campaign",
    "start_campaign": "update_dialer_campaign",
    "stop_campaign": "update_dialer_campaign",
    "pause_campaign": "update_dialer_campaign",
    "delete_campaign": "delete_dialer_campaign",
    # Calendar / Appointments
    "add_appointment": "create_appointment",
    "book_appointment": "create_appointment",
    "delete_appointment": "cancel_appointment",
    "remove_appointment": "cancel_appointment",
    # Roles
    "add_role": "create_role",
    "edit_role": "update_role",
    "remove_role": "delete_role",
    # Scheduled reports
    "rename_scheduled_report": "update_scheduled_report",
    "edit_scheduled_report": "update_scheduled_report",
    "remove_scheduled_report": "delete_scheduled_report",
    # Channels / System / Security / Supervisor
    "update_channels": "update_whatsapp_settings",
    "update_system_settings": "update_pbx_ai_features",
    "update_nat": "update_pbx_ai_features",
    "whitelist_ip": "add_security_whitelist",
    "delete_security_whitelist": "remove_security_whitelist",
    "create_backup_point": "create_restore_point",
    "agent_status": "set_agent_live_status",
}

BREAK_COLOR_MAP: Dict[str, str] = {
    "turuncu": "#f59e0b",
    "amber": "#f59e0b",
    "sarı": "#f59e0b",
    "mavi": "#3b82f6",
    "blue": "#3b82f6",
    "yeşil": "#10b981",
    "emerald": "#10b981",
    "green": "#10b981",
    "pembe": "#ec4899",
    "pink": "#ec4899",
    "mor": "#8b5cf6",
    "purple": "#8b5cf6",
    "kırmızı": "#ef4444",
    "red": "#ef4444",
    "rose": "#ef4444",
    "teal": "#14b8a6",
    "indigo": "#6366f1",
}


# ============================================================================
# 2. TURKISH NLP & ENTITY RESOLUTION HELPERS
# ============================================================================

def _tr_norm(val: Any) -> str:
    """Turkish-aware lowercase normalization ('İ' -> 'i', 'I' -> 'ı')."""
    s = str(val or "").replace("İ", "i").replace("I", "ı").lower()
    return re.sub(r"\s+", " ", s).strip()


def _strip_quotes_and_apos(raw_ref: str) -> str:
    s = str(raw_ref or "").strip().strip("\"'“”‘’")
    s = re.sub(r"['’`][a-zçğıöşüA-ZÇĞİÖŞÜ]+$", "", s).strip()
    return s.strip("\"'“”‘’ ")


def _clean_entity_ref(raw_ref: str) -> str:
    """Strips quotes, Turkish apostrophe suffixes ('ın, 'nin, 'nun...) and common entity nouns."""
    s = str(raw_ref or "").strip().strip("\"'“”‘’")
    s = re.sub(r"['’`][a-zçğıöşüA-ZÇĞİÖŞÜ]+$", "", s).strip()
    s = re.sub(r"^(?:mevcut|sistemdeki|olan|kayıtlı)\s+", "", s, flags=re.IGNORECASE).strip()
    s = re.sub(
        r"\s+(?:isimli|adlı|adındaki|numaralı|nolu)?\s*(?:dahilisinin|dahiliyi|dahilisini|dahilisi|dahili|kullanıcısının|kullanıcısını|kullanıcısı|kullanıcıyı|kullanıcı|temsilcisinin|temsilcisini|temsilcisi|temsilci|aboneliğinin|abonesinin|abonesini|abonesi|aboneyi|abone|kuyruğunun|kuyruğunu|kuyruğu|kuyruk|asistanının|asistanını|asistanı|asistan|ajanının|ajanını|ajanı|odasının|odasını|odası|molasının|molasını|molası|mola|departmanının|departmanını|departmanı|departman|bölümünün|bölümünü|bölümü|lokasyonunun|lokasyonunu|lokasyonu|lokasyon|şubesinin|şubesini|şubesi|grubunun|grubunu|grubu|hattının|hattını|hattı|trunkının|trunkını|trunkı|kuralının|kuralını|kuralı|raporunun|raporunu|raporu|anonsunun|anonsunu|anonsu|anons|akışının|akışını|akışı|akış|kampanyasının|kampanyasını|kampanyası|kampanya|rolünün|rolünü|rolü|kişisinin|kişisini|kişisi)$",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()
    s = re.sub(r"['’`][a-zçğıöşüA-ZÇĞİÖŞÜ]+$", "", s).strip()
    return s.strip("\"'“”‘’ ")


def _strip_tr_possessive_variants(norm_s: str) -> List[str]:
    """Generates stem candidates for un-apostrophed Turkish genitive/accusative/dative suffixes."""
    cands = [norm_s]
    for suf in (
        "nın", "nin", "nun", "nün",
        "ndan", "nden", "dan", "den",
        "na", "ne", "ya", "ye",
        "ın", "in", "un", "ün",
        "yı", "yi", "yu", "yü",
        "ı", "i", "u", "ü", "a", "e",
    ):
        if len(norm_s) > len(suf) + 2 and norm_s.endswith(suf):
            stem = norm_s[: -len(suf)].strip()
            if stem not in cands:
                cands.append(stem)
            if stem.endswith("ğ"):
                hard = stem[:-1] + "k"
                if hard not in cands:
                    cands.append(hard)
    return cands


def _resolve_break_color_hex(raw_color: Any) -> str:
    s = _tr_norm(raw_color or "")
    if s.startswith("#") and len(s) in (4, 7):
        return s
    for k, hx in BREAK_COLOR_MAP.items():
        if k in s:
            return hx
    return "#f59e0b"


def _extract_json_dict(raw_text: str) -> Optional[Dict[str, Any]]:
    if not raw_text:
        return None
    cleaned = str(raw_text).strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first != -1 and last != -1 and last > first:
        try:
            parsed = json.loads(cleaned[first : last + 1])
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return None


async def _resolve_request_user_permissions(request: Request, tenant_id: str) -> Tuple[str, str, bool, set]:
    """Returns (user_label, role_code, is_full_admin, permissions_set)."""
    from backend.main import resolve_audit_user_label, settings_db

    raw_uid = str(request.headers.get("X-User-ID") or "admin").strip()
    user_label = resolve_audit_user_label(raw_uid)

    if raw_uid.lower() in ("admin", "system", "superadmin"):
        return user_label, "admin", True, {"*"}

    role_code = "admin"
    matched_user = None
    try:
        async with AsyncSessionLocal() as db:
            users_db = (await db.execute(select(SystemUser))).scalars().all()
            for u in users_db:
                if str(u.id) == raw_uid or str(u.extension or "") == raw_uid or str(u.email or "").lower() == raw_uid.lower():
                    matched_user = u
                    break
    except Exception:
        pass

    if matched_user:
        role_code = str(matched_user.role or "agent").strip()
    else:
        for du in settings_db.get("users", []) or []:
            if not isinstance(du, dict):
                continue
            if str(du.get("id")) == raw_uid or str(du.get("extension") or "") == raw_uid or str(du.get("username") or "") == raw_uid:
                role_code = str(du.get("role") or "agent").strip()
                break

    if role_code == "admin":
        return user_label, "admin", True, {"*"}

    roles_list = settings_db.get("roles", []) or []
    role_obj = next(
        (r for r in roles_list if isinstance(r, dict) and (r.get("role_code") == role_code or r.get("name") == role_code)),
        None,
    )
    perms = set(role_obj.get("permissions", []) if role_obj else [])
    return user_label, role_code, False, perms


def _has_perm(is_admin: bool, perms: set, code: str) -> bool:
    if is_admin or "*" in perms or code in perms:
        return True
    base = code.split(":")[0]
    if base in perms:
        return True
    return False


# ============================================================================
# 3. COMPREHENSIVE PBX & AI CONTEXT GATHERER
# ============================================================================

async def _gather_pbx_context(tenant_id: str) -> Dict[str, Any]:
    from backend.main import DEFAULT_SETTINGS, settings_db

    pbx_cfg = settings_db.get("pbx", {}) or {}
    default_np = DEFAULT_SETTINGS["pbx"]["numbering_plan"]
    saved_np = pbx_cfg.get("numbering_plan") or {}
    numbering_plan = {
        "extension_range": saved_np.get("extension_range") or default_np["extension_range"],
        "queue_range": saved_np.get("queue_range") or default_np["queue_range"],
        "conference_range": saved_np.get("conference_range") or default_np["conference_range"],
        "speed_dial_range": saved_np.get("speed_dial_range") or default_np["speed_dial_range"],
        "call_flow_range": saved_np.get("call_flow_range") or default_np["call_flow_range"],
    }

    used_extensions = set()
    users_by_ext: Dict[str, Dict[str, Any]] = {}
    queues_by_ext: Dict[str, Dict[str, Any]] = {}
    trunks_summary: List[Dict[str, Any]] = []
    contacts_summary: List[Dict[str, Any]] = []
    canned_summary: List[Dict[str, Any]] = []
    qa_summary: List[Dict[str, Any]] = []
    ai_rules_summary: List[Dict[str, Any]] = []
    rag_sources: List[str] = []
    roles_summary: List[Dict[str, Any]] = []
    appointments_summary: List[Dict[str, Any]] = []

    try:
        async with AsyncSessionLocal() as db:
            u_rows = (await db.execute(_apply_tenant_clause(select(SystemUser), SystemUser, tenant_id))).scalars().all()
            for u in u_rows:
                ext = str(u.extension or "").strip()
                if ext:
                    used_extensions.add(ext)
                key = ext or f"id:{u.id}"
                users_by_ext[key] = {
                    "id": u.id,
                    "extension": ext,
                    "full_name": u.full_name or "",
                    "role": u.role or "agent",
                    "email": u.email or "",
                }

            q_rows = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
            for q in q_rows:
                ext = str(q.extension or "").strip()
                if ext:
                    used_extensions.add(ext)
                key = ext or f"id:{q.id}"
                queues_by_ext[key] = {
                    "id": q.id,
                    "extension": ext,
                    "name": q.name or "",
                    "strategy": q.strategy or "ringall",
                    "members": list(q.queueMembers or []),
                }

            t_rows = (await db.execute(_apply_tenant_clause(select(Trunk), Trunk, tenant_id))).scalars().all()
            for t in t_rows:
                trunks_summary.append({"id": t.id, "name": t.trunk_name or "", "host": t.host or "", "did": t.did_number or ""})

            c_rows = (await db.execute(select(Contact).limit(60))).scalars().all()
            for c in c_rows:
                c_ten = getattr(c, "tenant_id", "tenant-default") or "tenant-default"
                if _is_global_tenant(tenant_id) or (_is_default_tenant(tenant_id) and _is_default_tenant(c_ten)) or c_ten == tenant_id:
                    contacts_summary.append(
                        {"id": c.id, "name": f"{c.first_name or ''} {c.last_name or ''}".strip(), "phone": c.phone_number or ""}
                    )

            cr_rows = (await db.execute(select(CannedResponse).limit(40))).scalars().all()
            for cr in cr_rows:
                canned_summary.append({"id": cr.id, "shortcut": cr.shortcut, "title": cr.title})

            qa_rows = (await db.execute(select(QAQuestion).limit(40))).scalars().all()
            for qq in qa_rows:
                qa_summary.append({"id": qq.id, "question": qq.question, "max_score": qq.max_score})

            rl_rows = (await db.execute(_apply_tenant_clause(select(Rule), Rule, tenant_id))).scalars().all()
            for rl in rl_rows[:40]:
                ai_rules_summary.append({"id": rl.id, "rule_type": rl.rule_type, "keyword": rl.trigger_keyword or ""})

            src_stmt = select(DocumentChunk.filename).distinct()
            if not _is_global_tenant(tenant_id):
                if _is_default_tenant(tenant_id):
                    src_stmt = src_stmt.where(or_(DocumentChunk.tenant_id.in_(["tenant-default", "default"]), DocumentChunk.tenant_id.is_(None)))
                else:
                    src_stmt = src_stmt.where(DocumentChunk.tenant_id == tenant_id)
            rag_sources = [str(r) for r in (await db.execute(src_stmt)).scalars().all() if r][:40]

            s_roles = (await db.execute(select(SystemRole))).scalars().all()
            for sr in s_roles:
                roles_summary.append({"id": sr.id, "role_code": sr.role_code, "name": sr.name})

            ap_rows = (await db.execute(_apply_tenant_clause(select(Appointment), Appointment, tenant_id))).scalars().all()
            for ap in ap_rows[-30:]:
                appointments_summary.append(
                    {
                        "id": ap.id,
                        "customer_name": ap.customer_name,
                        "customer_phone": ap.customer_phone,
                        "status": ap.status,
                    }
                )
    except Exception:
        pass

    for u in settings_db.get("users", []) or []:
        if not isinstance(u, dict) or not _match_dict_tenant(u, tenant_id):
            continue
        ext = str(u.get("extension") or "").strip()
        if ext:
            used_extensions.add(ext)
        key = ext or f"id:{u.get('id')}"
        if key not in users_by_ext:
            users_by_ext[key] = {
                "id": u.get("id"),
                "extension": ext,
                "full_name": u.get("full_name") or u.get("name") or "",
                "role": u.get("role") or "agent",
                "email": u.get("email") or "",
            }

    for q in settings_db.get("queues", []) or []:
        if not isinstance(q, dict) or not _match_dict_tenant(q, tenant_id):
            continue
        ext = str(q.get("extension") or q.get("queue_number") or "").strip()
        if ext:
            used_extensions.add(ext)
        key = ext or f"id:{q.get('id')}"
        if key not in queues_by_ext:
            queues_by_ext[key] = {
                "id": q.get("id"),
                "extension": ext,
                "name": q.get("name") or "",
                "strategy": q.get("strategy") or "ringall",
                "members": list(q.get("queueMembers") or q.get("members") or []),
            }

    for c in settings_db.get("conferences", []) or []:
        if isinstance(c, dict) and (c.get("room_number") or c.get("extension")):
            used_extensions.add(str(c.get("room_number") or c.get("extension")).strip())

    for s in settings_db.get("speed_dials", []) or []:
        if isinstance(s, dict) and (s.get("short_code") or s.get("code")):
            used_extensions.add(str(s.get("short_code") or s.get("code")).strip())

    if not trunks_summary:
        for t in settings_db.get("trunks", []) or []:
            if isinstance(t, dict) and _match_dict_tenant(t, tenant_id):
                trunks_summary.append({"id": t.get("id"), "name": t.get("trunk_name") or t.get("name") or "", "host": t.get("host") or ""})

    confs_summary = [
        {
            "id": c.get("id"),
            "room_number": str(c.get("room_number") or c.get("extension") or ""),
            "name": c.get("room_name") or c.get("name") or "",
        }
        for c in (settings_db.get("conferences", []) or [])
        if isinstance(c, dict) and _match_dict_tenant(c, tenant_id)
    ]

    ai_agents_summary = [
        {"id": a.get("id"), "name": a.get("name") or ""}
        for a in (settings_db.get("ai_agents", []) or [])
        if isinstance(a, dict) and _match_dict_tenant(a, tenant_id)
    ]

    breaks_summary = [
        {"id": b.get("id"), "name": b.get("name") or ""}
        for b in (settings_db.get("breaks", []) or [])
        if isinstance(b, dict)
    ]

    depts_summary = [
        {"id": d.get("id"), "name": d.get("name") or ""}
        for d in (settings_db.get("departments", []) or [])
        if isinstance(d, dict) and _match_dict_tenant(d, tenant_id)
    ]

    locs_summary = [
        {"id": l.get("id"), "name": l.get("name") or ""}
        for l in (settings_db.get("locations", []) or [])
        if isinstance(l, dict) and _match_dict_tenant(l, tenant_id)
    ]

    sub_groups_summary = [
        {"id": g.get("id"), "name": g.get("name") or "", "extensions": g.get("extensions") or g.get("members") or []}
        for g in (settings_db.get("subscriber_groups", []) or [])
        if isinstance(g, dict) and _match_dict_tenant(g, tenant_id)
    ]

    pickup_groups_summary = [
        {"id": g.get("id"), "name": g.get("name") or "", "extensions": g.get("extensions") or []}
        for g in (settings_db.get("call_pickup_groups", []) or [])
        if isinstance(g, dict) and _match_dict_tenant(g, tenant_id)
    ]

    speed_dials_summary = [
        {
            "id": s.get("id"),
            "code": str(s.get("short_code") or s.get("code") or ""),
            "name": s.get("description") or s.get("name") or "",
            "long_number": str(s.get("long_number") or s.get("target") or s.get("number") or ""),
        }
        for s in (settings_db.get("speed_dials", []) or [])
        if isinstance(s, dict) and _match_dict_tenant(s, tenant_id)
    ]

    inbound_rules_summary = [
        {
            "id": r.get("id"),
            "name": r.get("name") or "",
            "did_number": ", ".join(r.get("did_patterns") or []) if isinstance(r.get("did_patterns"), list) else str(r.get("did_number") or ""),
        }
        for r in (settings_db.get("inbound_rules", []) or [])
        if isinstance(r, dict) and _match_dict_tenant(r, tenant_id)
    ]

    outbound_rules_summary = [
        {"id": r.get("id"), "name": r.get("name") or ""}
        for r in (settings_db.get("outbound_rules", []) or [])
        if isinstance(r, dict) and _match_dict_tenant(r, tenant_id)
    ]

    call_flows_summary = [
        {"id": w.get("id"), "name": w.get("name") or "", "status": w.get("status") or "active"}
        for w in (settings_db.get("workflows", []) or [])
        if isinstance(w, dict) and _match_dict_tenant(w, tenant_id)
    ]

    announcements_summary = [
        {"id": a.get("id"), "name": a.get("name") or "", "type": a.get("type") or "announcement"}
        for a in (settings_db.get("announcements", []) or [])
        if isinstance(a, dict) and _match_dict_tenant(a, tenant_id)
    ]

    campaigns_summary = [
        {"id": c.get("id"), "name": c.get("name") or "", "status": c.get("status") or "paused"}
        for c in (settings_db.get("dialer_campaigns", []) or [])
        if isinstance(c, dict) and _match_dict_tenant(c, tenant_id)
    ]

    scheduled_reports_summary = [
        {"id": s.get("id"), "name": s.get("name") or "", "send_time": s.get("send_time") or ""}
        for s in (settings_db.get("scheduled_reports", []) or [])
        if isinstance(s, dict) and _match_dict_tenant(s, tenant_id)
    ]

    return {
        "numbering_plan": numbering_plan,
        "used_extensions": used_extensions,
        "users": list(users_by_ext.values())[:120],
        "queues": list(queues_by_ext.values())[:50],
        "ai_agents": ai_agents_summary[:40],
        "conferences": confs_summary[:40],
        "breaks": breaks_summary[:40],
        "departments": depts_summary[:40],
        "locations": locs_summary[:40],
        "subscriber_groups": sub_groups_summary[:40],
        "pickup_groups": pickup_groups_summary[:40],
        "speed_dials": speed_dials_summary[:50],
        "trunks": trunks_summary[:30],
        "inbound_rules": inbound_rules_summary[:40],
        "outbound_rules": outbound_rules_summary[:40],
        "call_flows": call_flows_summary[:40],
        "announcements": announcements_summary[:40],
        "contacts": contacts_summary[:60],
        "canned_responses": canned_summary[:40],
        "ai_rules": ai_rules_summary[:40],
        "rag_sources": rag_sources[:40],
        "qa_questions": qa_summary[:40],
        "campaigns": campaigns_summary[:30],
        "appointments": appointments_summary[:30],
        "roles": roles_summary[:25],
        "scheduled_reports": scheduled_reports_summary[:30],
    }


def _next_free_in_plan(ctx: Dict[str, Any], used: set, range_key: str, default_start: int, default_end: int) -> str:
    np = ctx.get("numbering_plan") or {}
    rng = np.get(range_key) or {}
    start = int(rng.get("start") or default_start)
    end = int(rng.get("end") or default_end)
    if start == 1000 and range_key == "extension_range":
        start = 1001  # Reserve 1000 if already primary operator
    for n in range(start, end + 1):
        s = str(n)
        if s not in used:
            used.add(s)
            return s
    return str(start)


def _find_matching_entity_in_ctx(
    raw_ref: str,
    prompt_norm: str,
    ctx: Dict[str, Any],
) -> Optional[Tuple[str, Dict[str, Any]]]:
    direct = _strip_quotes_and_apos(raw_ref)
    cleaned = _clean_entity_ref(raw_ref)
    if not direct and not cleaned:
        return None
    stems: List[str] = []
    for cand in (direct, cleaned):
        if cand:
            for v in _strip_tr_possessive_variants(_tr_norm(cand)):
                if v and v not in stems:
                    stems.append(v)

    hint_order: List[str] = []
    if any(k in prompt_norm for k in ("kuyruk", "kuyruğ", "acd")):
        hint_order.append("queues")
    if any(k in prompt_norm for k in ("asistan", "ai ", "yapay zeka", "sesli bot", "ajan")):
        hint_order.append("ai_agents")
    if any(k in prompt_norm for k in ("konferans", "oda", "toplantı")):
        hint_order.append("conferences")
    if "mola" in prompt_norm:
        hint_order.append("breaks")
    if any(k in prompt_norm for k in ("departman", "bölüm", "birim")):
        hint_order.append("departments")
    if any(k in prompt_norm for k in ("lokasyon", "şube", "ofis")):
        hint_order.append("locations")
    if "yakalama" in prompt_norm or "toplama" in prompt_norm:
        hint_order.append("pickup_groups")
    if "grup" in prompt_norm or "grub" in prompt_norm:
        hint_order.append("subscriber_groups")
    if "hızlı arama" in prompt_norm or "kısa kod" in prompt_norm:
        hint_order.append("speed_dials")
    if any(k in prompt_norm for k in ("trunk", "dış hat", "operatör")):
        hint_order.append("trunks")
    if "giden arama" in prompt_norm:
        hint_order.append("outbound_rules")
    if any(k in prompt_norm for k in ("gelen arama", "did")):
        hint_order.append("inbound_rules")
    if any(k in prompt_norm for k in ("arama akış", "ivr", "akış")):
        hint_order.append("call_flows")
    if "anons" in prompt_norm:
        hint_order.append("announcements")
    if "rehber" in prompt_norm or "kişi" in prompt_norm:
        hint_order.append("contacts")
    if "hızlı cevap" in prompt_norm or "şablon" in prompt_norm:
        hint_order.append("canned_responses")
    if "kampanya" in prompt_norm or "dialer" in prompt_norm:
        hint_order.append("campaigns")
    if "kalite" in prompt_norm or "qa" in prompt_norm:
        hint_order.append("qa_questions")
    if "rol" in prompt_norm:
        hint_order.append("roles")
    if "rapor" in prompt_norm:
        hint_order.append("scheduled_reports")
    if any(k in prompt_norm for k in ("dahili", "kullanıcı", "temsilci", "abone", "personel")):
        hint_order.append("users")

    cat_to_action = {
        "users": "update_user",
        "queues": "update_queue",
        "ai_agents": "update_ai_agent",
        "conferences": "update_conference",
        "breaks": "update_break_type",
        "departments": "update_department",
        "locations": "update_location",
        "subscriber_groups": "update_subscriber_group",
        "pickup_groups": "update_pickup_group",
        "speed_dials": "update_speed_dial",
        "trunks": "update_trunk",
        "inbound_rules": "update_inbound_rule",
        "outbound_rules": "update_outbound_rule",
        "call_flows": "update_call_flow",
        "announcements": "update_announcement",
        "contacts": "update_contact",
        "canned_responses": "update_canned_response",
        "qa_questions": "update_qa_question",
        "campaigns": "update_dialer_campaign",
        "roles": "update_role",
        "scheduled_reports": "update_scheduled_report",
    }

    ordered_cats = hint_order + [c for c in cat_to_action.keys() if c not in hint_order]

    def _item_keys(item: Dict[str, Any]) -> List[str]:
        vals = []
        for k in ("extension", "room_number", "code", "did_number", "shortcut", "role_code", "phone", "full_name", "name", "title", "question", "id"):
            v = item.get(k)
            if v is not None and str(v).strip():
                vals.append(_tr_norm(v))
        return vals

    for cat in ordered_cats:
        for item in ctx.get(cat, []) or []:
            ikeys = _item_keys(item)
            if any(st in ikeys for st in stems):
                return cat_to_action[cat], item

    num_m = re.search(r"\b(\d{3,4})\b", cleaned)
    if num_m:
        num_s = num_m.group(1)
        for cat in ordered_cats:
            if cat in ("users", "queues", "conferences", "speed_dials"):
                for item in ctx.get(cat, []) or []:
                    if num_s in _item_keys(item):
                        return cat_to_action[cat], item

    for cat in ordered_cats:
        for item in ctx.get(cat, []) or []:
            nm = _tr_norm(item.get("full_name") or item.get("name") or item.get("title") or item.get("question") or "")
            if not nm or len(nm) < 3:
                continue
            for st in stems:
                if len(st) >= 3 and (st in nm or nm in st):
                    return cat_to_action[cat], item

    return None


def _resolve_target_in_category(raw_ref: str, cat: str, ctx: Dict[str, Any]) -> str:
    direct = _strip_quotes_and_apos(raw_ref)
    if not direct:
        return ""
    m = _find_matching_entity_in_ctx(raw_ref, "", {cat: ctx.get(cat, [])})
    if m:
        item = m[1]
        return str(
            item.get("extension")
            or item.get("room_number")
            or item.get("code")
            or item.get("shortcut")
            or item.get("full_name")
            or item.get("name")
            or item.get("title")
            or item.get("question")
            or item.get("id")
            or direct
        )
    return _clean_entity_ref(raw_ref) or direct


def _resolve_member_extensions(raw_members: List[Any], ctx: Dict[str, Any], batch_name_to_ext: Dict[str, str]) -> List[str]:
    """Resolves user names or extension numbers (including newly planned users in same batch) to extensions."""
    resolved: List[str] = []
    for rm in raw_members or []:
        s = _clean_entity_ref(str(rm or ""))
        if not s:
            continue
        if s.isdigit():
            if s not in resolved:
                resolved.append(s)
            continue
        ns = _tr_norm(s)
        if ns in batch_name_to_ext:
            ext_v = batch_name_to_ext[ns]
            if ext_v not in resolved:
                resolved.append(ext_v)
            continue
        for u in ctx.get("users", []) or []:
            if _tr_norm(u.get("full_name")) == ns or (len(ns) >= 3 and ns in _tr_norm(u.get("full_name"))):
                ext_v = str(u.get("extension") or "").strip()
                if ext_v and ext_v not in resolved:
                    resolved.append(ext_v)
                break
    return resolved


# ============================================================================
# 3. LLM ACTION NORMALIZER & MULTI-CLAUSE SEMANTIC PARSER
# ============================================================================

def _normalize_llm_action(act: Dict[str, Any], prompt_norm: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Maps non-standard LLM action names and parameter aliases onto the 78 canonical action schemas."""
    raw_type = str(act.get("action_type") or act.get("type") or "").strip().lower()
    raw_params = dict(act.get("params") or {})

    # Special campaign start/stop aliases preserve status intent
    if raw_type == "start_campaign":
        raw_params.setdefault("status", "running")
    elif raw_type in ("stop_campaign", "pause_campaign"):
        raw_params.setdefault("status", "paused")

    canonical_type = _ACTION_TYPE_ALIASES.get(raw_type, raw_type)

    target_aliases = (
        "target", "old_name", "current_name", "from_name", "source_name",
        "entity", "id", "target_name", "target_extension", "extension",
        "queue_extension", "room_number", "short_code", "code", "shortcut",
        "role_code", "campaign_name", "flow_name", "rule_name", "trunk_name",
        "announcement_name", "phone_number", "ip_address",
    )
    new_name_aliases = ("new_name", "to_name", "updated_name", "full_name", "name", "room_name", "title")

    def _pick(keys: Tuple[str, ...]) -> str:
        for k in keys:
            v = raw_params.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        return ""

    if canonical_type not in ACTION_PERMISSION_MAP and any(
        w in raw_type for w in ("rename", "update", "edit", "modify", "change")
    ):
        cand_target = _pick(target_aliases)
        m = _find_matching_entity_in_ctx(cand_target, prompt_norm, ctx)
        canonical_type = m[0] if m else "update_user"

    if canonical_type.startswith("update_") and canonical_type not in (
        "update_user_forwarding",
        "update_numbering_plan",
        "update_whatsapp_settings",
        "update_pbx_ai_features",
    ):
        tgt = _pick(target_aliases)
        nn = _pick(new_name_aliases)
        if not tgt and nn:
            tgt = nn
            nn = ""
        if tgt:
            raw_params["target"] = _clean_entity_ref(tgt) or _strip_quotes_and_apos(tgt)
        if nn and _tr_norm(nn) != _tr_norm(raw_params.get("target") or ""):
            raw_params["new_name"] = _strip_quotes_and_apos(nn)

    elif canonical_type.startswith(("delete_", "remove_", "cancel_")):
        tgt = _pick(target_aliases + ("name", "full_name", "value", "word", "source"))
        if tgt:
            raw_params["target"] = _clean_entity_ref(tgt) or _strip_quotes_and_apos(tgt)

    out = dict(act)
    out["action_type"] = canonical_type
    out["params"] = raw_params
    return out


def _is_del_verb(norm: str) -> bool:
    """Word-boundary check for Turkish delete/remove verbs so words like 'temsilci' never false-match 'sil'."""
    return bool(re.search(r"\b(?:sil|silin|silelim|kaldır|kaldırın|çıkar|çıkarın|iptal\s+et|iptal\s+edin)\b", norm))


def _split_compound_clauses(prompt: str) -> List[str]:
    """Splits multi-step Turkish instructions cleanly without breaking quoted strings or name lists."""
    text = prompt.strip()
    if not text:
        return []
    placeholders: Dict[str, str] = {}

    def _mask(m: re.Match) -> str:
        key = f"__QT_{len(placeholders)}__"
        placeholders[key] = m.group(0)
        return key

    masked = re.sub(r"[\"“][^\"”]{1,400}[\"”]|['‘][^'’]{2,400}['’]", _mask, text)
    # 1. Split on semicolons, newlines, sentence boundaries, and explicit Turkish sequence connectors
    parts = re.split(
        r"(?:\r?\n)+|\s*;\s*|\s+(?:ve\s+ardından|ardından|daha\s+sonra|sonrasında|ayrıca|bunun\s+yanında|sonra\s+da)\s+|(?<=[.!])\s+(?=[A-ZÇĞİÖŞÜ0-9\"'])",
        masked,
        flags=re.IGNORECASE,
    )
    # 2. Secondary split on ' ve ' ONLY when the left side already has a completed Turkish imperative/action verb
    #    (so "Ahmet Yılmaz ve Ayşe Demir için 2 yeni dahili aç" stays together, while "... ata ve 0850... yönlendir" splits!)
    action_end_re = re.compile(
        r"(?:aç|ekle|oluştur|kur|tanımla|ata|yönlendir|bağla|öğret|seslendir|değiştir|yap|güncelle|sil|kaldır|engelle|başlat|durdur|planla)\s*$",
        re.IGNORECASE,
    )
    refined: List[str] = []
    for chunk in parts:
        sub_ve = re.split(r"\s+ve\s+", chunk)
        if len(sub_ve) <= 1:
            refined.append(chunk)
            continue
        acc = sub_ve[0]
        for nxt in sub_ve[1:]:
            if action_end_re.search(acc.strip()):
                refined.append(acc)
                acc = nxt
            else:
                acc = f"{acc} ve {nxt}"
        refined.append(acc)

    restored: List[str] = []
    for p in refined:
        s = p.strip(" ,.;")
        if not s:
            continue
        for k, v in placeholders.items():
            s = s.replace(k, v)
        s = re.sub(
            r"^(?:ve\s+)?(?:ardından|daha\s+sonra|sonrasında|ayrıca|bunun\s+yanında|sonra\s+da)\s+",
            "",
            s.strip(),
            flags=re.IGNORECASE,
        ).strip(" ,.")
        if s:
            restored.append(s)
    return restored or [text]


def _extract_quoted(clause: str) -> List[str]:
    res = []
    for m in re.finditer(r"[\"“]([^\"”]{1,400})[\"”]|['‘]([^'’]{2,400})['’]", clause):
        val = (m.group(1) or m.group(2) or "").strip()
        if val:
            res.append(val)
    return res


def _parse_single_clause_semantically(clause: str, ctx: Dict[str, Any], used_exts: set) -> List[Dict[str, Any]]:
    """Deterministic Turkish semantic parser for a single clause or multi-entity clause."""
    actions: List[Dict[str, Any]] = []
    raw = clause.strip()
    norm = _tr_norm(raw)
    quoted = _extract_quoted(raw)

    # ------------------------------------------------------------------
    # A. GENERIC RENAME / NAME UPDATE ("X'in adını Y yap / değiştir")
    # ------------------------------------------------------------------
    ren_patterns = [
        r"^(.+?)\s+(?:adını|ismini|başlığını|etiketini)\s+[\"“'‘]?([^\"”'’]+?)[\"”'’]?\s*(?:olarak\s+)?(?:değiştir\w*|güncelle\w*|yap\w*|düzenle\w*)$",
        r"^[\"“'‘]([^\"”'’]+)[\"”'’]\s*(?:['’][a-zçğıöşü]+)?\s+[\"“'‘]([^\"”'’]+)[\"”'’]\s+olarak\s+(?:değiştir\w*|yeniden\s+adlandır\w*|güncelle\w*|yap\w*)$",
    ]
    for pat in ren_patterns:
        rm = re.search(pat, raw.strip(" .!"), flags=re.IGNORECASE)
        if rm:
            raw_target = rm.group(1).strip()
            new_nm = _strip_quotes_and_apos(rm.group(2).strip())
            matched = _find_matching_entity_in_ctx(raw_target, norm, ctx)
            act_type = matched[0] if matched else "update_user"
            target_val = _clean_entity_ref(raw_target)
            if matched:
                it = matched[1]
                target_val = str(
                    it.get("extension")
                    or it.get("room_number")
                    or it.get("code")
                    or it.get("shortcut")
                    or it.get("full_name")
                    or it.get("name")
                    or it.get("title")
                    or it.get("id")
                    or target_val
                )
            actions.append({
                "action_type": act_type,
                "summary": f"'{target_val}' kaydının adı '{new_nm}' olarak güncellenecek.",
                "params": {"target": target_val, "new_name": new_nm},
            })
            return actions

    # ------------------------------------------------------------------
    # B. RESTORE POINT / BACKUP
    # ------------------------------------------------------------------
    if any(k in norm for k in ("geri yükleme noktası", "yedek noktası", "sistem yedeği", "anlık yedek", "snapshot al")):
        title = quoted[0] if quoted else "AI Konfigürasyon Asistanı Yedeği"
        actions.append({
            "action_type": "create_restore_point",
            "summary": f"'{title}' başlıklı sistem geri yükleme noktası oluşturulacak.",
            "params": {"title": title, "description": raw[:200]},
        })
        return actions

    # ------------------------------------------------------------------
    # C. SECURITY WHITELIST IP
    # ------------------------------------------------------------------
    ip_m = re.search(r"\b(\d{1,3}(?:\.\d{1,3}){3}(?:/\d{1,2})?)\b", raw)
    if ip_m and any(k in norm for k in ("whitelist", "güvenli ip", "güvenlik kalkanı", "ip izin", "beyaz liste")):
        ip_val = ip_m.group(1)
        is_del = _is_del_verb(norm)
        actions.append({
            "action_type": "remove_security_whitelist" if is_del else "add_security_whitelist",
            "summary": f"{ip_val} adresi güvenli IP {'listesinden çıkarılacak' if is_del else 'listesine eklenecek'}.",
            "params": {"ip_address": ip_val, "target": ip_val},
        })
        return actions

    # ------------------------------------------------------------------
    # D. LIVE SUPERVISOR AGENT STATUS ("1001 dahilisini yemek molasına al / müsait yap")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("molaya çıkar", "molasına çıkar", "molaya al", "molasına al", "müsait yap", "hazır duruma getir", "çevrimiçi yap")):
        ext_m = re.search(r"\b(\d{3,4})\b", raw)
        target_ref = ext_m.group(1) if ext_m else (quoted[0] if quoted else "")
        status_val = "ready" if any(k in norm for k in ("müsait", "hazır", "çevrimiçi")) else "paused"
        reason = ""
        br_m = re.search(r"([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+mola(?:sı|sına)?)", raw, re.IGNORECASE)
        if br_m and status_val == "paused":
            reason = re.sub(r"sına$|sine$|ya$|ye$", "sı", br_m.group(1).strip(), flags=re.IGNORECASE).title()
        if target_ref:
            actions.append({
                "action_type": "set_agent_live_status",
                "summary": f"'{target_ref}' temsilcisinin canlı durumu '{status_val}' olarak değiştirilecek.",
                "params": {"target": target_ref, "status": status_val, "reason": reason or "Kısa Mola"},
            })
            return actions

    # ------------------------------------------------------------------
    # E. TTS ANNOUNCEMENT ("... metniyle ... anonsu oluştur / seslendir")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("anons", "seslendir", "tts", "bekleme müziği")):
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "üret", "ekle", "seslendir")):
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:anonsunu|anonsu|sil\w*|kaldır\w*)", "", raw, flags=re.IGNORECASE))
            if tgt:
                actions.append({
                    "action_type": "delete_announcement",
                    "summary": f"'{tgt}' sesli anonsu silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        if any(k in norm for k in ("oluştur", "üret", "ekle", "seslendir", "hazırla", "kaydet")):
            text_val = ""
            name_val = "Karşılama Anonsu"
            if len(quoted) >= 2:
                # Longer quote is usually the TTS speech text, shorter is the announcement title
                if len(quoted[0]) <= len(quoted[1]):
                    name_val, text_val = quoted[0], quoted[1]
                else:
                    text_val, name_val = quoted[0], quoted[1]
            elif len(quoted) == 1:
                text_val = quoted[0]
                nm_m = re.search(r"([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]{2,35}?)\s+(?:isimli|adlı|adında)?\s*anons", raw, re.IGNORECASE)
                if nm_m and quoted[0] not in nm_m.group(1):
                    cand = nm_m.group(1).strip()
                    cand = re.sub(r"^(?:yeni|bir|sesli|tts)\s+", "", cand, flags=re.IGNORECASE).strip()
                    if cand:
                        name_val = cand.title()
            voice = "tr-TR-EmelNeural"
            if any(k in norm for k in ("erkek", "ahmet", "charon", "puck", "fenrir")):
                voice = "tr-TR-AhmetNeural"
            ann_type = "moh" if "bekleme müziği" in norm or "moh" in norm else "announcement"
            if text_val:
                actions.append({
                    "action_type": "create_tts_announcement",
                    "summary": f"'{name_val}' isimli AI sesli anons (TTS) üretilecek.",
                    "params": {
                        "name": name_val,
                        "text": text_val,
                        "type": ann_type,
                        "voice": voice,
                        "tts_provider": "auto",
                    },
                })
                return actions

    # ------------------------------------------------------------------
    # F. CALL FLOW / IVR WORKFLOW ("arama akışı", "ivr menüsü", "1'e basınca ... 2'ye basınca")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("arama akış", "ivr", "sesli yanıt menü")) or (
        "tuşla" in norm and ("kuyruğ" in norm or "dahili" in norm)
    ) or ("1'e bas" in norm or "1 tuş" in norm):
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "kur", "ekle", "tasarla")):
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:arama\s+akışını|akışını|ivr|sil\w*|kaldır\w*)", "", raw, flags=re.IGNORECASE))
            if tgt:
                actions.append({
                    "action_type": "delete_call_flow",
                    "summary": f"'{tgt}' arama akışı silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        flow_name = quoted[0] if quoted else "Ana Karşılama IVR Akışı"
        did_m = re.search(r"(?<!\d)(90\d{10}|0850\d{7}|0[2345]\d{9})(?!\d)", raw.replace(" ", ""))
        did_num = did_m.group(1) if did_m else ""
        menu_routes: Dict[str, str] = {}
        for dm in re.finditer(
            r"(\d)\s*(?:['’]?[ea]\s*bas\w*|tuş\w*)\s+([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]{2,35}?)(?=\s*(?:,|ve\s+\d|\d\s*tuş|\d\s*['’]|mesai|yönlen|aktar|$))",
            raw,
            re.IGNORECASE,
        ):
            digit = dm.group(1)
            dest_raw = _clean_entity_ref(dm.group(2))
            if dest_raw:
                menu_routes[digit] = dest_raw
        wh_m = re.search(r"(\d{1,2}[:.]\d{2})\s*[-–ile]+\s*(\d{1,2}[:.]\d{2})", raw)
        work_start = wh_m.group(1).replace(".", ":") if wh_m else "09:00"
        work_end = wh_m.group(2).replace(".", ":") if wh_m else "18:00"
        actions.append({
            "action_type": "create_call_flow",
            "summary": f"'{flow_name}' görsel arama akışı (IVR) oluşturulacak.",
            "params": {
                "name": flow_name,
                "did_number": did_num,
                "work_hours_start": work_start,
                "work_hours_end": work_end,
                "menu_routes": menu_routes,
                "prompt_text": raw,
            },
        })
        return actions

    # ------------------------------------------------------------------
    # G. KNOWLEDGE BASE (RAG) & AI RULES
    # ------------------------------------------------------------------
    url_m = re.search(r"(https?://[^\s\"'<>]+)", raw, re.IGNORECASE)
    if url_m and any(k in norm for k in ("bilgi bankası", "rag", "tara", "indeksle", "öğret", "web sitesi", "kaynak")):
        url_val = url_m.group(1).rstrip(".,)")
        actions.append({
            "action_type": "crawl_kb_url",
            "summary": f"'{url_val}' adresi taranarak Bilgi Bankasına (RAG) eklenecek.",
            "params": {"url": url_val},
        })
        return actions

    if any(k in norm for k in ("bilgi bankası", "rag", "bilgi tabanı", "yapay zekaya öğret")):
        if _is_del_verb(norm) and quoted:
            actions.append({
                "action_type": "delete_kb_source",
                "summary": f"Bilgi Bankasından '{quoted[0]}' kaynağı silinecek.",
                "params": {"target": quoted[0]},
            })
            return actions
        content_val = quoted[-1] if quoted else ""
        title_val = quoted[0] if len(quoted) >= 2 else "Kurumsal Bilgi Notu"
        if not content_val:
            colon_m = re.search(r":\s*(.+)$", raw)
            if colon_m:
                content_val = colon_m.group(1).strip()
        if content_val:
            actions.append({
                "action_type": "add_kb_text",
                "summary": f"Bilgi Bankasına '{title_val}' başlıklı içerik öğretilecek.",
                "params": {"title": title_val, "content": content_val},
            })
            return actions

    if any(k in norm for k in ("ai kural", "yapay zeka kural", "sss kural", "tetikleyici kelime", "müşteri sorarsa")):
        kw = quoted[0] if len(quoted) >= 1 else ""
        resp = quoted[1] if len(quoted) >= 2 else ""
        r_type = "routing" if "transfer" in norm or "aktar" in norm else ("prompt" if "talimat" in norm else "faq")
        act_trig = "NONE"
        ext_m = re.search(r"\b(\d{3,4})\b", raw)
        if r_type == "routing" and ext_m:
            act_trig = f"TRANSFER:{ext_m.group(1)}"
        if kw or resp:
            actions.append({
                "action_type": "create_ai_rule",
                "summary": f"AI Kural Editörüne '{kw or r_type}' kuralı eklenecek.",
                "params": {
                    "rule_type": r_type,
                    "trigger_keyword": kw,
                    "response_text": resp or raw,
                    "action_to_trigger": act_trig,
                },
            })
            return actions

    # ------------------------------------------------------------------
    # H. QA QUESTIONS ("çağrı kalite", "qa sorusu", "değerlendirme kriteri", "puanlık")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("kalite kontrol", "kalite kriter", "kalite soru", "qa soru", "qa kriter", "değerlendirme soru")):
        if _is_del_verb(norm) and quoted and not any(k in norm for k in ("ekle", "oluştur")):
            actions.append({
                "action_type": "delete_qa_question",
                "summary": f"'{quoted[0]}' kalite kontrol sorusu silinecek.",
                "params": {"target": quoted[0]},
            })
            return actions
        q_text = quoted[0] if quoted else ""
        score_m = re.search(r"(\d{1,3})\s*puan", norm)
        max_score = int(score_m.group(1)) if score_m else 20
        if q_text:
            actions.append({
                "action_type": "create_qa_question",
                "summary": f"QA Kalite Kontrolüne ({max_score} puan) yeni kriter eklenecek.",
                "params": {"question": q_text, "max_score": max_score},
            })
            return actions

    # ------------------------------------------------------------------
    # I. CANNED RESPONSES ("hızlı cevap", "/kargo kısayoluyla")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("hızlı cevap", "hazır cevap", "hazır mesaj", "cevap şablon")) or re.search(r"/[a-zA-Z0-9_-]+\s+kısayol", norm):
        if _is_del_verb(norm) and (quoted or "/" in raw) and not any(k in norm for k in ("oluştur", "ekle")):
            sc_m = re.search(r"/([a-zA-Z0-9_-]+)", raw)
            tgt = sc_m.group(1) if sc_m else quoted[0]
            actions.append({
                "action_type": "delete_canned_response",
                "summary": f"'/{tgt.lstrip('/')}' hızlı cevap şablonu silinecek.",
                "params": {"target": tgt.lstrip("/")},
            })
            return actions
        sc_m = re.search(r"/([a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]+)", raw)
        shortcut = sc_m.group(1).lower() if sc_m else "bilgi"
        content = quoted[-1] if quoted else ""
        title = quoted[0] if len(quoted) >= 2 else shortcut.capitalize()
        if content:
            actions.append({
                "action_type": "create_canned_response",
                "summary": f"'/{shortcut}' kısayollu hızlı cevap şablonu oluşturulacak.",
                "params": {"shortcut": shortcut, "title": title, "content": content},
            })
            return actions

    # ------------------------------------------------------------------
    # J. CONTACTS / KURUMSAL REHBER ("rehbere ... ekle")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("rehbere", "rehberine", "rehberden", "kişi kartı")):
        if _is_del_verb(norm) and "rehbere" not in norm:
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:rehberden|kişisini|sil\w*|kaldır\w*)", "", raw, flags=re.IGNORECASE))
            if tgt:
                actions.append({
                    "action_type": "delete_contact",
                    "summary": f"Rehberden '{tgt}' kişisi silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        ph_m = re.search(r"(\+?\d[\d\s()-]{8,16}\d)", raw)
        phone = re.sub(r"[^\d+]", "", ph_m.group(1)) if ph_m else ""
        comp_m = re.search(r"([A-ZÇĞİÖŞÜ][\wçğıöşüÇĞİÖŞÜ\s]{1,30}?)\s+(?:şirket\w*|firma\w*)", raw)
        company = comp_m.group(1).strip() if comp_m else ""
        nm = quoted[0] if quoted else ""
        if not nm:
            nm_m = re.search(r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)", raw)
            if nm_m:
                nm = nm_m.group(1).strip()
        if nm and phone:
            parts = nm.split(None, 1)
            actions.append({
                "action_type": "create_contact",
                "summary": f"Kurumsal rehbere '{nm}' ({phone}) eklenecek.",
                "params": {
                    "first_name": parts[0],
                    "last_name": parts[1] if len(parts) > 1 else "",
                    "phone_number": phone,
                    "company": company,
                    "is_vip": "vip" in norm or "vıp" in norm,
                },
            })
            return actions

    # ------------------------------------------------------------------
    # K. BLACKLIST & BLOCK WORDS
    # ------------------------------------------------------------------
    if any(k in norm for k in ("yasaklı kelime", "argo kelime", "küfür filtresi", "kelime engelle")):
        is_del = _is_del_verb(norm)
        words = quoted if quoted else []
        for w in words:
            actions.append({
                "action_type": "remove_block_word" if is_del else "add_block_word",
                "summary": f"Yasaklı kelimelerden '{w}' {'kaldırılacak' if is_del else 'eklenecek'}.",
                "params": {"word": w, "target": w, "category": "profanity"},
            })
        if actions:
            return actions

    if any(k in norm for k in ("kara liste", "engelle", "engelini kaldır", "numarayı blokla")):
        ph_m = re.search(r"(\+?\d[\d\s()-]{6,16}\d)", raw)
        val = re.sub(r"[^\d+]", "", ph_m.group(1)) if ph_m else (quoted[0] if quoted else "")
        is_del = _is_del_verb(norm) or "engelini aç" in norm
        if val:
            actions.append({
                "action_type": "remove_blacklist" if is_del else "add_blacklist",
                "summary": f"'{val}' numarası kara listeden {'çıkarılacak' if is_del else 'engellenecek'}.",
                "params": {"value": val, "target": val, "reason": "AI Asistan komutu ile engellendi"},
            })
            return actions

    # ------------------------------------------------------------------
    # L. DIALER CAMPAIGNS ("dış arama kampanyası", "otomatik arama kampanyası")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("kampanya", "dialer", "otomatik dış arama", "toplu dış arama")):
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "kur", "ekle")):
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:kampanyasını|kampanyayı|sil\w*|kaldır\w*)", "", raw, flags=re.IGNORECASE))
            if tgt:
                actions.append({
                    "action_type": "delete_dialer_campaign",
                    "summary": f"'{tgt}' dış arama kampanyası silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        if any(k in norm for k in ("başlat", "durdur", "duraklat")) and not any(k in norm for k in ("oluştur", "kur", "yeni")):
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:kampanyasını|kampanyayı|başlat\w*|durdur\w*|duraklat\w*)", "", raw, flags=re.IGNORECASE))
            st = "running" if "başlat" in norm else "paused"
            actions.append({
                "action_type": "update_dialer_campaign",
                "summary": f"'{tgt}' kampanyası {'başlatılacak' if st == 'running' else 'duraklatılacak'}.",
                "params": {"target": tgt, "status": st},
            })
            return actions
        camp_name = quoted[0] if quoted else "Yeni Dış Arama Kampanyası"
        conc_m = re.search(r"(\d{1,2})\s*(?:eş\s*zamanlı|kanal|çağrı)", norm)
        conc = int(conc_m.group(1)) if conc_m else 2
        phones = [re.sub(r"[^\d+]", "", m.group(0)) for m in re.finditer(r"(?<!\d)(?:\+?90|0)5\d{9}(?!\d)", raw.replace(" ", ""))]
        actions.append({
            "action_type": "create_dialer_campaign",
            "summary": f"'{camp_name}' dış arama kampanyası oluşturulacak.",
            "params": {
                "name": camp_name,
                "max_concurrent": conc,
                "numbers": phones,
                "status": "running" if "hemen başlat" in norm else "paused",
            },
        })
        return actions

    # ------------------------------------------------------------------
    # M. APPOINTMENTS / RANDEVU TAKVİMİ
    # ------------------------------------------------------------------
    if "randevu" in norm and (any(k in norm for k in ("oluştur", "ekle", "planla", "iptal", "kaydet")) or _is_del_verb(norm)):
        if "iptal" in norm or _is_del_verb(norm):
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:randevusunu|randevuyu|iptal\s+et\w*|sil\w*)", "", raw, flags=re.IGNORECASE))
            actions.append({
                "action_type": "cancel_appointment",
                "summary": f"'{tgt}' randevusu iptal edilecek.",
                "params": {"target": tgt},
            })
            return actions
        ph_m = re.search(r"(\+?\d[\d\s()-]{8,16}\d)", raw)
        phone = re.sub(r"[^\d+]", "", ph_m.group(1)) if ph_m else ""
        cust = quoted[0] if quoted else "Müşteri"
        dt_m = re.search(r"(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})", raw)
        tm_m = re.search(r"\b(\d{1,2}:\d{2})\b", raw)
        actions.append({
            "action_type": "create_appointment",
            "summary": f"'{cust}' için müşteri randevusu oluşturulacak.",
            "params": {
                "customer_name": cust,
                "customer_phone": phone,
                "date": dt_m.group(1) if dt_m else "",
                "time": tm_m.group(1) if tm_m else "14:00",
                "notes": raw[:200],
            },
        })
        return actions

    # ------------------------------------------------------------------
    # N. NUMBERING PLAN ("numara planı", "dahili aralığını 1000-1999 yap")
    # ------------------------------------------------------------------
    if "numara plan" in norm or "numaralandırma" in norm or "prefix" in norm:
        rng_m = re.search(r"\b(\d{3,5})\s*[-–ile]+\s*(\d{3,5})\b", raw)
        params_np: Dict[str, Any] = {}
        if rng_m:
            s_v, e_v = int(rng_m.group(1)), int(rng_m.group(2))
            if "kuyruk" in norm:
                params_np["queue_range"] = {"start": s_v, "end": e_v}
            elif "konferans" in norm:
                params_np["conference_range"] = {"start": s_v, "end": e_v}
            elif "hızlı arama" in norm:
                params_np["speed_dial_range"] = {"start": s_v, "end": e_v}
            else:
                params_np["extension_range"] = {"start": s_v, "end": e_v}
        if params_np:
            actions.append({
                "action_type": "update_numbering_plan",
                "summary": "Santral numara planı aralıkları güncellenecek.",
                "params": params_np,
            })
            return actions

    # ------------------------------------------------------------------
    # O. OUTBOUND RULES ("giden arama kuralı")
    # ------------------------------------------------------------------
    if "giden arama" in norm and (any(k in norm for k in ("kural", "rota", "oluştur", "ekle")) or _is_del_verb(norm)):
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "ekle")):
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:giden\s+arama\s+kuralını|kuralını|sil\w*|kaldır\w*)", "", raw, flags=re.IGNORECASE))
            actions.append({
                "action_type": "delete_outbound_rule",
                "summary": f"'{tgt}' giden arama kuralı silinecek.",
                "params": {"target": tgt},
            })
            return actions
        r_name = quoted[0] if quoted else "GSM & Şehirlerarası Çıkış"
        pat_m = re.search(r"(_?[0-9XZN.\[\]]{2,15})", raw)
        pattern = pat_m.group(1) if pat_m else "05XXXXXXXXX"
        cid_m = re.search(r"(?<!\d)(90\d{10}|0850\d{7})(?!\d)", raw.replace(" ", ""))
        actions.append({
            "action_type": "create_outbound_rule",
            "summary": f"'{r_name}' giden arama kuralı ({pattern}) oluşturulacak.",
            "params": {
                "name": r_name,
                "pattern": pattern,
                "caller_id": cid_m.group(1) if cid_m else "",
                "strip": 0,
                "prepend": "",
            },
        })
        return actions

    # ------------------------------------------------------------------
    # P. INBOUND DID RULES ("0850... numarasını ... kuyruğuna yönlendir / gelen arama kuralı")
    # ------------------------------------------------------------------
    did_m = re.search(r"(?<!\d)(\+?90\d{10}|0850\d{7}|0[2345]\d{9})(?!\d)", raw.replace(" ", ""))
    if ("gelen arama" in norm or (did_m and any(k in norm for k in ("yönlendir", "bağla", "aktar", "rotala", "kuyruğ", "akış")))):
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "ekle", "yönlendir")):
            tgt = did_m.group(1) if did_m else (quoted[0] if quoted else "")
            if tgt:
                actions.append({
                    "action_type": "delete_inbound_rule",
                    "summary": f"'{tgt}' gelen arama (DID) kuralı silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        did_val = did_m.group(1).lstrip("+") if did_m else ""
        dest_type = "queue"
        if any(k in norm for k in ("akış", "ivr")):
            dest_type = "call_flow"
        elif any(k in norm for k in ("dahili", "kullanıcı", "abone")) and "kuyru" not in norm:
            dest_type = "user"
        dest_target = ""
        ext_m = re.search(r"\b([1289]\d{2,3})\b", raw)
        if ext_m and ext_m.group(1) not in (did_val or ""):
            dest_target = ext_m.group(1)
        elif quoted:
            dest_target = quoted[-1]
        else:
            q_m = re.search(r"(?:(?:numarasını|hattını|aramalarını)\s+)?([A-ZÇĞİÖŞÜa-zçğıöşü\s]{2,30}?)\s+(?:kuyruğuna|akışına|dahilisine)", raw, re.IGNORECASE)
            if q_m:
                dest_target = re.sub(r"^(?:numarasını|hattını|aramalarını)\s+", "", _clean_entity_ref(q_m.group(1)), flags=re.IGNORECASE).strip()
        actions.append({
            "action_type": "create_inbound_rule",
            "summary": f"'{did_val or 'Tüm DID'}' gelen aramaları '{dest_target}' ({dest_type}) hedefine yönlendirilecek.",
            "params": {
                "name": f"DID {did_val}" if did_val else "Genel Gelen Kuralı",
                "did_number": did_val,
                "destination_type": dest_type,
                "destination_target": dest_target,
            },
        })
        return actions

    # ------------------------------------------------------------------
    # Q. SPEED DIALS ("hızlı arama", "kısa kod")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("hızlı arama", "kısa kod")):
        if _is_del_verb(norm) and not any(k in norm for k in ("ekle", "oluştur")):
            code_m = re.search(r"\*?\b(\d{2,4})\b", raw)
            tgt = code_m.group(1) if code_m else (quoted[0] if quoted else "")
            if tgt:
                actions.append({
                    "action_type": "delete_speed_dial",
                    "summary": f"'{tgt}' hızlı arama kısa kodu silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        code_m = re.search(r"\*?(\d{3,4})\b", raw)
        ph_m = re.search(r"(?<!\d)(0\d{10}|90\d{10}|444\d{4}|0850\d{7})(?!\d)", raw.replace(" ", ""))
        code_v = code_m.group(1) if code_m else _next_free_in_plan(ctx, used_exts, "speed_dial_range", 4000, 4999)
        long_v = ph_m.group(1) if ph_m else ""
        desc = quoted[0] if quoted else "Hızlı Arama"
        if long_v:
            actions.append({
                "action_type": "create_speed_dial",
                "summary": f"*{code_v} hızlı arama kodu '{desc}' ({long_v}) olarak eklenecek.",
                "params": {"short_code": code_v, "long_number": long_v, "description": desc},
            })
            return actions

    # ------------------------------------------------------------------
    # R. SUBSCRIBER GROUPS & CALL PICKUP GROUPS
    # ------------------------------------------------------------------
    if any(k in norm for k in ("çağrı yakalama grub", "çağrı toplama grub", "pickup grub")):
        is_del = _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "kur", "ekle"))
        g_name = quoted[0] if quoted else "Çağrı Toplama Grubu"
        exts = re.findall(r"\b(1\d{3})\b", raw)
        actions.append({
            "action_type": "delete_pickup_group" if is_del else "create_pickup_group",
            "summary": f"'{g_name}' çağrı toplama grubu {'silinecek' if is_del else 'oluşturulacak'}.",
            "params": {"target": g_name, "name": g_name, "extensions": exts},
        })
        return actions

    if "abone grub" in norm or ("grub" in norm and "kuyru" not in norm and any(k in norm for k in ("abone", "dahili"))):
        is_del = _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "kur", "ekle"))
        g_name = quoted[0] if quoted else ""
        if not g_name:
            gm = re.search(r"([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]{2,30}?)\s+(?:isimli|adlı)?\s*abone\s+grub", raw, re.IGNORECASE)
            if gm:
                g_name = gm.group(1).strip().title()
        g_name = g_name or "Yeni Abone Grubu"
        exts = re.findall(r"\b(1\d{3})\b", raw)
        actions.append({
            "action_type": "delete_subscriber_group" if is_del else "create_subscriber_group",
            "summary": f"'{g_name}' abone grubu {'silinecek' if is_del else 'oluşturulacak'}.",
            "params": {"target": g_name, "name": g_name, "members": exts},
        })
        return actions

    # ------------------------------------------------------------------
    # S. CONFERENCES ("konferans odası")
    # ------------------------------------------------------------------
    if "konferans" in norm or "toplantı odası" in norm:
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "aç", "ekle", "kur")):
            rm_m = re.search(r"\b(\d{3,4})\b", raw)
            tgt = rm_m.group(1) if rm_m else (quoted[0] if quoted else "")
            if tgt:
                actions.append({
                    "action_type": "delete_conference",
                    "summary": f"'{tgt}' konferans odası silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        rm_m = re.search(r"\b([38]\d{2,3})\b", raw)
        room_no = rm_m.group(1) if rm_m else _next_free_in_plan(ctx, used_exts, "conference_range", 3000, 3999)
        pin_m = re.search(r"(?:pin|şifre)\w*\s*[:=]?\s*(\d{4,8})", norm)
        pin = pin_m.group(1) if pin_m else ""
        c_name = quoted[0] if quoted else "Yönetim Konferans Odası"
        actions.append({
            "action_type": "create_conference",
            "summary": f"{room_no} numaralı '{c_name}' konferans odası oluşturulacak.",
            "params": {
                "room_number": room_no,
                "name": c_name,
                "pin": pin,
                "recording_enabled": "kayıt" in norm or "kaydet" in norm,
            },
        })
        return actions

    # ------------------------------------------------------------------
    # T. BREAK TYPES ("mola tanımı", "15 dakikalık çay molası ekle")
    # ------------------------------------------------------------------
    if "mola" in norm and (any(k in norm for k in ("ekle", "oluştur", "tanımla", "dakika", "süresini")) or _is_del_verb(norm)):
        if _is_del_verb(norm) and not any(k in norm for k in ("ekle", "oluştur", "tanımla")):
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:molasını|molayı|mola\s+tanımını|sil\w*|kaldır\w*)", "", raw, flags=re.IGNORECASE))
            if tgt:
                actions.append({
                    "action_type": "delete_break_type",
                    "summary": f"'{tgt}' mola tanımı silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        dur_m = re.search(r"(\d{1,3})\s*(?:dakika|dk)", norm)
        dur = int(dur_m.group(1)) if dur_m else 15
        quota_m = re.search(r"(?:günlük|kota\w*)\s*(\d{1,3})\s*(?:dakika|dk)", norm)
        quota = int(quota_m.group(1)) if quota_m else dur * 2
        color_hex = "#f59e0b"
        for cname, chex in BREAK_COLOR_MAP.items():
            if cname in norm:
                color_hex = chex
                break
        b_name = quoted[0] if quoted else ""
        if not b_name:
            bm = re.search(r"([A-ZÇĞİÖŞÜa-zçğıöşü]{2,20}\s+mola(?:sı)?)", raw, re.IGNORECASE)
            if bm:
                b_name = bm.group(1).strip().title()
                if not b_name.lower().endswith("sı") and not b_name.lower().endswith("si"):
                    b_name += " Molası" if "mola" not in b_name.lower() else ""
        b_name = b_name or "Kısa Mola"
        actions.append({
            "action_type": "create_break_type",
            "summary": f"'{b_name}' ({dur} dk) mola tanımı eklenecek.",
            "params": {"name": b_name, "max_duration_minutes": dur, "daily_quota_minutes": quota, "color": color_hex},
        })
        return actions

    # ------------------------------------------------------------------
    # U. DEPARTMENTS & LOCATIONS
    # ------------------------------------------------------------------
    if any(k in norm for k in ("departman", "lokasyon", "şube")):
        is_loc = "lokasyon" in norm or "şube" in norm
        is_del = _is_del_verb(norm) and not any(k in norm for k in ("ekle", "oluştur", "aç"))
        nm = quoted[0] if quoted else ""
        if not nm:
            dm = re.search(r"([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]{2,30}?)\s+(?:isimli|adlı)?\s*(?:departman|lokasyon|şube)", raw, re.IGNORECASE)
            if dm:
                nm = re.sub(r"^(?:yeni|bir)\s+", "", dm.group(1).strip(), flags=re.IGNORECASE).title()
        if nm:
            act_t = ("delete_location" if is_del else "create_location") if is_loc else ("delete_department" if is_del else "create_department")
            actions.append({
                "action_type": act_t,
                "summary": f"'{nm}' {'lokasyonu' if is_loc else 'departmanı'} {'silinecek' if is_del else 'oluşturulacak'}.",
                "params": {"name": nm, "target": nm},
            })
            return actions

    # ------------------------------------------------------------------
    # V. AI VOICE AGENTS & SCENARIO DESIGN
    # ------------------------------------------------------------------
    if any(k in norm for k in ("yapay zeka asistan", "sesli asistan", "ai asistan", "ai ajan", "asistan senaryo")):
        if "senaryo" in norm and any(k in norm for k in ("tasarla", "oluştur", "güncelle", "kur")):
            ag_name = quoted[0] if quoted else (ctx.get("ai_agents", [{}])[0].get("name") if ctx.get("ai_agents") else "Karşılama Asistanı")
            actions.append({
                "action_type": "generate_ai_agent_scenario",
                "summary": f"'{ag_name}' için görsel AI diyalog senaryosu tasarlanacak.",
                "params": {"target": ag_name, "scenario_prompt": raw},
            })
            return actions
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "ekle", "kur")):
            tgt = quoted[0] if quoted else _clean_entity_ref(re.sub(r"(?:asistanını|asistanı|sil\w*|kaldır\w*)", "", raw, flags=re.IGNORECASE))
            if tgt:
                actions.append({
                    "action_type": "delete_ai_agent",
                    "summary": f"'{tgt}' yapay zeka asistanı silinecek.",
                    "params": {"target": tgt},
                })
                return actions
        ag_name = quoted[0] if quoted else "AI Müşteri Asistanı"
        voice = "Charon" if "erkek" in norm else "Aoede"
        greeting = quoted[1] if len(quoted) >= 2 else f"Merhaba, ben {ag_name}. Size nasıl yardımcı olabilirim?"
        actions.append({
            "action_type": "create_ai_agent",
            "summary": f"'{ag_name}' sesli yapay zeka asistanı oluşturulacak.",
            "params": {
                "name": ag_name,
                "voice": voice,
                "greeting": greeting,
                "system_prompt": raw,
            },
        })
        return actions

    # ------------------------------------------------------------------
    # W. WHATSAPP SETTINGS & SYSTEM / AI FEATURES
    # ------------------------------------------------------------------
    if "whatsapp" in norm and any(k in norm for k in ("mesai", "persona", "karşılama", "menü", "üslup", "otomatik cevap")):
        wh_m = re.search(r"(\d{1,2}[:.]\d{2})\s*[-–ile]+\s*(\d{1,2}[:.]\d{2})", raw)
        persona = ""
        for p in ("kurumsal", "satis", "destek", "samimi"):
            if p in norm or (p == "satis" and "satış" in norm):
                persona = p
                break
        wp_params: Dict[str, Any] = {}
        if wh_m:
            wp_params["work_hours_start"] = wh_m.group(1).replace(".", ":")
            wp_params["work_hours_end"] = wh_m.group(2).replace(".", ":")
        if persona:
            wp_params["persona"] = persona
        if "menü" in norm:
            wp_params["welcome_menu_enabled"] = not any(k in norm for k in ("kapat", "pasif", "devre dışı"))
        actions.append({
            "action_type": "update_whatsapp_settings",
            "summary": "WhatsApp kanal mesai / persona / karşılama ayarları güncellenecek.",
            "params": wp_params,
        })
        return actions

    if any(k in norm for k in ("ses biyometri", "akıllı geri arama", "smart callback", "kayıt saklama", "extern_ip", "nat ayar")):
        feat_params: Dict[str, Any] = {}
        en = not any(k in norm for k in ("kapat", "pasif", "devre dışı"))
        if "biyometri" in norm:
            feat_params["voice_biometrics_enabled"] = en
        if "geri arama" in norm or "callback" in norm:
            feat_params["smart_callback_enabled"] = en
        if "saklama" in norm:
            dm = re.search(r"(\d{1,4})\s*gün", norm)
            if dm:
                feat_params["recording_retention_days"] = int(dm.group(1))
        if ip_m and "nat" in norm:
            feat_params["nat_enabled"] = en
            feat_params["extern_ip"] = ip_m.group(1)
        if feat_params:
            actions.append({
                "action_type": "update_pbx_ai_features",
                "summary": "Santral & AI modül parametreleri güncellenecek.",
                "params": feat_params,
            })
            return actions

    # ------------------------------------------------------------------
    # X. SCHEDULED REPORTS
    # ------------------------------------------------------------------
    if "zamanlanmış rapor" in norm or ("rapor" in norm and any(k in norm for k in ("her gün", "her sabah", "e-posta", "mail gönder"))):
        mail_m = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", raw)
        tm_m = re.search(r"\b(\d{1,2}:\d{2})\b", raw)
        r_name = quoted[0] if quoted else "Günlük Çağrı Merkezi Özeti"
        actions.append({
            "action_type": "create_scheduled_report",
            "summary": f"'{r_name}' zamanlanmış raporu planlanacak.",
            "params": {
                "name": r_name,
                "frequency": "weekly" if "hafta" in norm else ("monthly" if "aylık" in norm else "daily"),
                "send_time": tm_m.group(1) if tm_m else "09:00",
                "recipients": mail_m,
                "report_type": "executive_summary",
            },
        })
        return actions

    # ------------------------------------------------------------------
    # Y. USER FORWARDING ("1001 dahilisini cevapsızda 0532... numarasına yönlendir")
    # ------------------------------------------------------------------
    if any(k in norm for k in ("yönlendir", "aktar")) and any(k in norm for k in ("meşgul", "cevapsız", "her zaman", "cep", "gsm")):
        ext_m = re.search(r"\b(1\d{3})\b", raw)
        ph_m = re.search(r"(?<!\d)(05\d{9}|\+?905\d{9})(?!\d)", raw.replace(" ", ""))
        if ext_m and ph_m:
            mode = "always"
            if "meşgul" in norm:
                mode = "busy"
            elif "cevapsız" in norm or "zaman aşım" in norm:
                mode = "no_answer"
            to_m = re.search(r"(\d{1,2})\s*(?:saniye|sn)", norm)
            actions.append({
                "action_type": "update_user_forwarding",
                "summary": f"{ext_m.group(1)} dahilisinin ({mode}) çağrı yönlendirmesi {ph_m.group(1)} olarak ayarlanacak.",
                "params": {
                    "extension": ext_m.group(1),
                    "mode": mode,
                    "destination": ph_m.group(1),
                    "active": not any(k in norm for k in ("kapat", "iptal", "pasif")),
                    "timeout": int(to_m.group(1)) if to_m else 25,
                },
            })
            return actions

    # ------------------------------------------------------------------
    # Z. USERS & QUEUES (Creation, Member Assignment, Deletion)
    # ------------------------------------------------------------------
    if "kuyruk" in norm or "kuyruğ" in norm:
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "kur", "aç")):
            q_ext = re.search(r"\b([289]\d{2,3})\b", raw)
            tgt = q_ext.group(1) if q_ext else (quoted[0] if quoted else "")
            if tgt:
                actions.append({
                    "action_type": "delete_queue",
                    "summary": f"'{tgt}' ACD kuyruğu silinecek.",
                    "params": {"target": tgt},
                })
                return actions

        if any(k in norm for k in ("üye ekle", "kuyruğuna ekle", "kuyruğa ata", "kuyruğuna ata", "temsilci ata", "dahililerini ata")) and not any(
            k in norm for k in ("kuyruğu kur", "kuyruğu oluştur", "kuyruk oluştur", "kuyruk aç", "oluşturup")
        ):
            q_ext_m = re.search(r"\b([289]\d{2,3})\b", raw)
            exts = re.findall(r"\b(1\d{3})\b", raw)
            q_ref = q_ext_m.group(1) if q_ext_m else (quoted[0] if quoted else "")
            if not q_ref:
                qm = re.search(r"([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]{2,25}?)\s+kuyruğuna", raw, re.IGNORECASE)
                if qm:
                    q_ref = _clean_entity_ref(qm.group(1))
            if q_ref and exts:
                actions.append({
                    "action_type": "add_queue_members",
                    "summary": f"'{q_ref}' kuyruğuna {', '.join(exts)} dahilileri atanacak.",
                    "params": {"queue_extension": q_ref, "members": exts},
                })
                return actions

        if any(k in norm for k in ("oluştur", "kur", "aç", "ekle")):
            q_ext_m = re.search(r"\b([289]\d{2,3})\b", raw)
            q_ext = q_ext_m.group(1) if q_ext_m else _next_free_in_plan(ctx, used_exts, "queue_range", 2000, 2999)
            used_exts.add(q_ext)
            q_name = quoted[0] if quoted else ""
            if not q_name:
                qm = re.search(r"([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]{2,30}?)\s+(?:isimli|adlı|adında)?\s*kuyru[ğk]", raw, re.IGNORECASE)
                if qm:
                    cand = re.sub(r"^(?:yeni|bir|ardından|ayrıca|\d{3,4}\s*numaralı)\s+", "", qm.group(1).strip(), flags=re.IGNORECASE).strip()
                    if cand:
                        q_name = cand.title()
            q_name = q_name or f"Kuyruk {q_ext}"
            strat = "ringall"
            if "sırayla" in norm or "round" in norm or "rrmemory" in norm:
                strat = "rrmemory"
            elif "en az konuşan" in norm or "leastrecent" in norm:
                strat = "leastrecent"
            elif "rastgele" in norm or "random" in norm:
                strat = "random"
            exts = [e for e in re.findall(r"\b(1\d{3})\b", raw) if e != q_ext]
            actions.append({
                "action_type": "create_queue",
                "summary": f"{q_ext} numaralı '{q_name}' kuyruğu ({strat}) oluşturulacak.",
                "params": {
                    "name": q_name,
                    "extension": q_ext,
                    "strategy": strat,
                    "members": exts,
                    "post_call_survey_enabled": "anket" in norm,
                    "callback_enabled": "geri arama" in norm or "callback" in norm,
                },
            })
            return actions

    # Users creation / deletion
    if any(k in norm for k in ("dahili", "kullanıcı", "temsilci", "personel", "abone", "operatör")):
        if _is_del_verb(norm) and not any(k in norm for k in ("oluştur", "aç", "ekle")):
            ext_m = re.search(r"\b(1\d{3})\b", raw)
            tgt = ext_m.group(1) if ext_m else (quoted[0] if quoted else "")
            if tgt:
                actions.append({
                    "action_type": "delete_user",
                    "summary": f"'{tgt}' kullanıcısı / dahilisi silinecek.",
                    "params": {"target": tgt},
                })
                return actions

        if any(k in norm for k in ("oluştur", "aç", "ekle", "tanımla")):
            role = "supervisor" if "süpervizör" in norm or "supervisor" in norm else ("admin" if "yönetici" in norm or "admin" in norm else "agent")
            explicit_exts = re.findall(r"\b(1\d{3})\b", raw)
            names: List[str] = list(quoted)
            if not names:
                for nm_m in re.finditer(
                    r"\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,20}\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,25})\b",
                    raw,
                ):
                    cand = nm_m.group(1).strip()
                    if _tr_norm(cand) not in ("yeni dahili", "çağrı merkezi", "müşteri hizmetleri", "teknik destek", "hızlı arama"):
                        names.append(cand)
            count_m = re.search(r"\b(\d{1,2})\s*(?:adet|tane|yeni)?\s*(?:dahili|temsilci|kullanıcı|abone)", norm)
            if not names and count_m:
                cnt = min(int(count_m.group(1)), 15)
                names = [f"Temsilci {i + 1}" for i in range(cnt)]
            elif not names and explicit_exts:
                names = [f"Dahili {e}" for e in explicit_exts]

            dept_m = re.search(r"([A-ZÇĞİÖŞÜa-zçğıöşü]{2,20})\s+departman", raw, re.IGNORECASE)
            dept_val = dept_m.group(1).title() if dept_m else ""
            rec_enabled = not ("ses kaydı kapalı" in norm or "kaydı kapat" in norm)

            for idx, full_nm in enumerate(names):
                ext_v = explicit_exts[idx] if idx < len(explicit_exts) else _next_free_in_plan(ctx, used_exts, "extension_range", 1001, 1999)
                used_exts.add(ext_v)
                actions.append({
                    "action_type": "create_user",
                    "summary": f"{ext_v} numaralı '{full_nm}' ({role}) dahilisi oluşturulacak.",
                    "params": {
                        "full_name": full_nm,
                        "extension": ext_v,
                        "role": role,
                        "department": dept_val,
                        "call_recording": rec_enabled,
                        "voicemail_enabled": "sesli mesaj" in norm or "voicemail" in norm,
                    },
                })
            if actions:
                return actions

    return actions


def _parse_config_prompt_semantically(prompt: str, ctx: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Multi-clause Turkish semantic parser across all 26 PBX/AI modules."""
    used_exts = set(ctx.get("used_extensions") or set())
    clauses = _split_compound_clauses(prompt)
    all_actions: List[Dict[str, Any]] = []
    warnings: List[str] = []

    for clause in clauses:
        parsed = _parse_single_clause_semantically(clause, ctx, used_exts)
        all_actions.extend(parsed)

    if not all_actions and len(clauses) > 1:
        # Try whole prompt as single block if clause split was too granular
        all_actions = _parse_single_clause_semantically(prompt, ctx, used_exts)

    if not all_actions:
        warnings.append(
            "Komutunuzdan doğrudan yapılandırılabilir bir eylem çıkarılamadı. Lütfen yapmak istediğiniz işlemi "
            "(örn. dahili/kuyruk/IVR akışı/TTS anons/kampanya/bilgi bankası/kural ekleme veya güncelleme) biraz daha net belirtin."
        )
    return all_actions, warnings


# ============================================================================
# 4. DRY-RUN PLAN VALIDATOR, BATCH LINKER & RBAC ENFORCER
# ============================================================================

def _validate_and_enrich_plan_actions(
    raw_actions: List[Dict[str, Any]],
    user_perms: set,
    ctx: Dict[str, Any],
    prompt_norm: str = "",
) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    enriched: List[Dict[str, Any]] = []
    warnings: List[str] = []
    blocked_permissions: List[str] = []
    has_wildcard = "*" in user_perms
    used_exts = set(ctx.get("used_extensions") or set())

    # Batch memory so chained commands in a single prompt resolve each other!
    planned_exts_in_batch: set = set()
    batch_name_to_ext: Dict[str, str] = {}
    batch_queue_name_to_ext: Dict[str, str] = {}
    batch_flow_names: List[str] = []

    for idx, raw_act in enumerate(raw_actions or []):
        if not isinstance(raw_act, dict):
            continue
        act = _normalize_llm_action(raw_act, prompt_norm, ctx)
        a_type = str(act.get("action_type") or "").strip()
        if a_type not in ACTION_PERMISSION_MAP:
            warnings.append(f"Desteklenmeyen eylem türü atlandı: '{a_type}'")
            continue

        req_perm, category_label = ACTION_PERMISSION_MAP[a_type]
        allowed = _has_perm(has_wildcard, user_perms, req_perm)
        if not allowed:
            blocked_permissions.append(f"{category_label} ({req_perm})")

        params = dict(act.get("params") or {})
        action_warnings: List[str] = []

        # --- Specific enrichments & batch cross-referencing ---
        if a_type == "create_user":
            ext = str(params.get("extension") or "").strip()
            if not ext or not ext.isdigit():
                ext = _next_free_in_plan(ctx, used_exts | planned_exts_in_batch, "extension_range", 1001, 1999)
                params["extension"] = ext
            elif ext in used_exts or ext in planned_exts_in_batch:
                old_ext = ext
                ext = _next_free_in_plan(ctx, used_exts | planned_exts_in_batch, "extension_range", 1001, 1999)
                params["extension"] = ext
                action_warnings.append(f"{old_ext} dahilisi dolu olduğu için boş olan {ext} atandı.")
            planned_exts_in_batch.add(ext)
            fn = str(params.get("full_name") or params.get("name") or f"Dahili {ext}").strip()
            params["full_name"] = fn
            params["role"] = str(params.get("role") or "agent").lower()
            batch_name_to_ext[_tr_norm(fn)] = ext
            # Also index first name if unique
            first_tok = _tr_norm(fn.split()[0]) if fn.split() else ""
            if first_tok and first_tok not in batch_name_to_ext:
                batch_name_to_ext[first_tok] = ext

        elif a_type == "create_queue":
            ext = str(params.get("extension") or params.get("queue_number") or "").strip()
            if not ext or not ext.isdigit():
                ext = _next_free_in_plan(ctx, used_exts | planned_exts_in_batch, "queue_range", 2000, 2999)
                params["extension"] = ext
            elif ext in used_exts or ext in planned_exts_in_batch:
                old_ext = ext
                ext = _next_free_in_plan(ctx, used_exts | planned_exts_in_batch, "queue_range", 2000, 2999)
                params["extension"] = ext
                action_warnings.append(f"{old_ext} kuyruk numarası kullanımda olduğu için {ext} atandı.")
            planned_exts_in_batch.add(ext)
            qn = str(params.get("name") or f"Kuyruk {ext}").strip()
            params["name"] = qn
            params["strategy"] = str(params.get("strategy") or "ringall").strip()
            raw_mems = params.get("members") or []
            if isinstance(raw_mems, str):
                raw_mems = [x.strip() for x in raw_mems.split(",") if x.strip()]
            # If user wrote "bu temsilcileri / yeni temsilcileri kuyruğa ata" with empty members, bind newly created users in batch!
            if not raw_mems and batch_name_to_ext and any(
                k in prompt_norm for k in ("bu dahilileri", "bu temsilcileri", "bu kullanıcıları", "kuyruğa ata", "kuyruğuna ekle", "üye olarak")
            ):
                raw_mems = list(dict.fromkeys(batch_name_to_ext.values()))
            params["members"] = _resolve_member_extensions(raw_mems, ctx, batch_name_to_ext)
            batch_queue_name_to_ext[_tr_norm(qn)] = ext
            batch_queue_name_to_ext[_tr_norm(_clean_entity_ref(qn))] = ext

        elif a_type in ("add_queue_members", "remove_queue_members"):
            q_ref = str(params.get("queue_extension") or params.get("target") or params.get("name") or "").strip()
            nq = _tr_norm(_clean_entity_ref(q_ref))
            if nq in batch_queue_name_to_ext:
                params["queue_extension"] = batch_queue_name_to_ext[nq]
            elif not q_ref.isdigit():
                params["queue_extension"] = _resolve_target_in_category(q_ref, "queues", ctx)
            else:
                params["queue_extension"] = q_ref
            raw_mems = params.get("members") or []
            if isinstance(raw_mems, str):
                raw_mems = [x.strip() for x in raw_mems.split(",") if x.strip()]
            if not raw_mems and a_type == "add_queue_members" and batch_name_to_ext:
                raw_mems = list(dict.fromkeys(batch_name_to_ext.values()))
            params["members"] = _resolve_member_extensions(raw_mems, ctx, batch_name_to_ext)

        elif a_type == "create_conference":
            rm = str(params.get("room_number") or params.get("extension") or "").strip()
            if not rm or not rm.isdigit() or rm in used_exts or rm in planned_exts_in_batch:
                rm = _next_free_in_plan(ctx, used_exts | planned_exts_in_batch, "conference_range", 3000, 3999)
            planned_exts_in_batch.add(rm)
            params["room_number"] = rm
            params["name"] = str(params.get("name") or params.get("room_name") or f"Konferans {rm}").strip()
            raw_int = params.get("internals") or params.get("members") or []
            if isinstance(raw_int, str):
                raw_int = [x.strip() for x in raw_int.split(",") if x.strip()]
            params["internals"] = _resolve_member_extensions(raw_int, ctx, batch_name_to_ext)

        elif a_type == "create_speed_dial":
            sc = str(params.get("short_code") or params.get("code") or "").strip().lstrip("*")
            if not sc:
                sc = _next_free_in_plan(ctx, used_exts | planned_exts_in_batch, "speed_dial_range", 4000, 4999)
            planned_exts_in_batch.add(sc)
            params["short_code"] = sc
            params["long_number"] = str(params.get("long_number") or params.get("target_number") or params.get("number") or "").strip()
            params["description"] = str(params.get("description") or params.get("name") or f"Kısa Kod {sc}").strip()

        elif a_type in ("create_subscriber_group", "update_subscriber_group", "create_pickup_group", "update_pickup_group"):
            raw_mems = params.get("members") or params.get("extensions") or []
            if isinstance(raw_mems, str):
                raw_mems = [x.strip() for x in raw_mems.split(",") if x.strip()]
            if not raw_mems and a_type.startswith("create_") and batch_name_to_ext:
                raw_mems = list(dict.fromkeys(batch_name_to_ext.values()))
            params["members"] = _resolve_member_extensions(raw_mems, ctx, batch_name_to_ext)

        elif a_type == "create_inbound_rule":
            d_target = str(params.get("destination_target") or params.get("destination") or "").strip()
            d_type = str(params.get("destination_type") or "queue").strip().lower()
            if d_type in ("ivr", "workflow", "flow"):
                d_type = "call_flow"
            elif d_type in ("extension", "agent"):
                d_type = "user"
            params["destination_type"] = d_type
            nt = _tr_norm(_clean_entity_ref(d_target))
            if d_type == "queue":
                if nt in batch_queue_name_to_ext:
                    params["destination_target"] = batch_queue_name_to_ext[nt]
                elif not d_target and batch_queue_name_to_ext:
                    params["destination_target"] = list(batch_queue_name_to_ext.values())[-1]
                elif d_target and not d_target.isdigit():
                    params["destination_target"] = _resolve_target_in_category(d_target, "queues", ctx)
            elif d_type == "user":
                if nt in batch_name_to_ext:
                    params["destination_target"] = batch_name_to_ext[nt]
                elif d_target and not d_target.isdigit():
                    params["destination_target"] = _resolve_target_in_category(d_target, "users", ctx)
            elif d_type == "call_flow" and not d_target and batch_flow_names:
                params["destination_target"] = batch_flow_names[-1]

        elif a_type == "create_call_flow":
            fn = str(params.get("name") or "Ana Karşılama Akışı").strip()
            params["name"] = fn
            batch_flow_names.append(fn)

        elif a_type == "add_security_whitelist":
            ip_s = str(params.get("ip_address") or params.get("ip") or "").strip()
            try:
                if "/" in ip_s:
                    ipaddress.ip_network(ip_s, strict=False)
                else:
                    ipaddress.ip_address(ip_s)
            except Exception:
                action_warnings.append(f"'{ip_s}' geçerli bir IPv4/CIDR formatında görünmüyor.")

        # Resolve targets cleanly for update_* and delete_* actions
        target_cat_map = {
            "update_user": "users", "delete_user": "users",
            "update_queue": "queues", "delete_queue": "queues",
            "update_ai_agent": "ai_agents", "delete_ai_agent": "ai_agents", "generate_ai_agent_scenario": "ai_agents",
            "update_conference": "conferences", "delete_conference": "conferences",
            "update_break_type": "breaks", "delete_break_type": "breaks",
            "update_department": "departments", "delete_department": "departments",
            "update_location": "locations", "delete_location": "locations",
            "update_subscriber_group": "subscriber_groups", "delete_subscriber_group": "subscriber_groups",
            "update_pickup_group": "pickup_groups", "delete_pickup_group": "pickup_groups",
            "update_speed_dial": "speed_dials", "delete_speed_dial": "speed_dials",
            "update_trunk": "trunks", "delete_trunk": "trunks",
            "update_inbound_rule": "inbound_rules", "delete_inbound_rule": "inbound_rules",
            "update_outbound_rule": "outbound_rules", "delete_outbound_rule": "outbound_rules",
            "update_call_flow": "call_flows", "delete_call_flow": "call_flows",
            "update_announcement": "announcements", "delete_announcement": "announcements",
            "update_contact": "contacts", "delete_contact": "contacts",
            "update_canned_response": "canned_responses", "delete_canned_response": "canned_responses",
            "update_qa_question": "qa_questions", "delete_qa_question": "qa_questions",
            "update_dialer_campaign": "campaigns", "delete_dialer_campaign": "campaigns",
            "update_role": "roles", "delete_role": "roles",
            "update_scheduled_report": "scheduled_reports", "delete_scheduled_report": "scheduled_reports",
        }
        if a_type in target_cat_map and params.get("target"):
            params["target"] = _resolve_target_in_category(str(params["target"]), target_cat_map[a_type], ctx)

        summary = str(act.get("summary") or "").strip()
        if not summary:
            summary = f"{category_label}: {json.dumps(params, ensure_ascii=False)[:120]}"

        act_id_str = str(raw_act.get("action_id") or raw_act.get("id") or f"step-{idx + 1}")
        enriched.append({
            "id": act_id_str,
            "action_id": act_id_str,
            "type": a_type,
            "action_type": a_type,
            "type_label": category_label,
            "category": category_label,
            "required_permission": req_perm,
            "allowed": allowed,
            "summary": summary,
            "params": params,
            "warnings": action_warnings,
            "conflict_note": " • ".join(action_warnings) if action_warnings else "",
        })
        warnings.extend(action_warnings)

    return enriched, warnings, list(dict.fromkeys(blocked_permissions))


# ============================================================================
# 5. DRY-RUN PLAN ENDPOINT (LLM + MULTI-CLAUSE SEMANTIC MERGE)
# ============================================================================

@ai_config_assistant_router.post("/api/ai-config-assistant/plan")
async def plan_ai_configuration_changes(request: Request, payload: Dict[str, Any] = Body(...)):
    """Parses natural language Turkish PBX/AI instructions into a Dry-Run execution plan across 26 modules."""
    from backend.services.ai_task_router import execute_routed_text_generation

    prompt = str(payload.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Lütfen gerçekleştirmek istediğiniz yapılandırma komutunu yazın.")

    tenant_id = _extract_tenant_id(request, payload)
    _user_label, _role_code, _is_admin, user_perms = await _resolve_request_user_permissions(request, tenant_id)
    ctx = await _gather_pbx_context(tenant_id)

    compact_ctx = {
        "numbering_plan": ctx["numbering_plan"],
        "existing_users": [f"{u['extension']}:{u['full_name']}" for u in ctx["users"][:50]],
        "existing_queues": [f"{q['extension']}:{q['name']}(members={q['members']})" for q in ctx["queues"][:30]],
        "existing_ai_agents": [a["name"] for a in ctx["ai_agents"]],
        "existing_conferences": [f"{c['room_number']}:{c['name']}" for c in ctx["conferences"]],
        "existing_breaks": [b["name"] for b in ctx["breaks"]],
        "existing_departments": [d["name"] for d in ctx["departments"]],
        "existing_locations": [l["name"] for l in ctx["locations"]],
        "existing_subscriber_groups": [g["name"] for g in ctx["subscriber_groups"]],
        "existing_pickup_groups": [g["name"] for g in ctx["pickup_groups"]],
        "existing_speed_dials": [f"{s['code']}:{s['name']}->{s['long_number']}" for s in ctx["speed_dials"][:25]],
        "existing_trunks": [f"{t['id']}:{t['name']}" for t in ctx["trunks"]],
        "existing_call_flows": [f"{w['id']}:{w['name']}" for w in ctx["call_flows"]],
        "existing_announcements": [a["name"] for a in ctx["announcements"]],
        "existing_campaigns": [c["name"] for c in ctx["campaigns"]],
        "existing_canned_responses": [f"/{c['shortcut']}:{c['title']}" for c in ctx["canned_responses"][:20]],
        "existing_qa_questions": [q["question"][:60] for q in ctx["qa_questions"][:15]],
        "existing_roles": [f"{r['role_code']}:{r['name']}" for r in ctx["roles"]],
    }

    system_instruction = (
        "Sen AIDA Kurumsal AI Santral (PBX), Omnichannel İletişim Merkezi ve Yapay Zeka Yönetim Asistanısın. "
        "Yöneticinin doğal dilde yazdığı TEK veya ÇOK ADIMLI (zincirleme) komutu analiz edip SADECE geçerli bir JSON nesnesi döndür. "
        "Markdown veya açıklama ekleme.\n\n"
        f"MEVCUT SİSTEM ÖZETİ:\n{json.dumps(compact_ctx, ensure_ascii=False)}\n\n"
        "DESTEKLENEN 78 EYLEM ŞEMASI (action_type ve params):\n"
        "1. KULLANICI/DAHİLİ:\n"
        "  - create_user: {full_name, extension, role:'agent'|'supervisor'|'admin', email:'', department:'', location:'', password:'', call_recording:true, voicemail_enabled:false, outbound_permission:true, mobile_phone:''}\n"
        "  - update_user: {target:'dahili veya ad', new_name:'', role:'', email:'', department:'', location:'', password:'', call_recording:true|false, voicemail_enabled:true|false, outbound_permission:true|false, mobile_phone:''}\n"
        "  - delete_user: {target:'dahili veya ad'}\n"
        "  - update_user_forwarding: {extension:'1001', mode:'always'|'busy'|'no_answer', destination:'0532...', active:true, timeout:25}\n"
        "2. ACD KUYRUK:\n"
        "  - create_queue: {name, extension:'2000+', strategy:'ringall'|'rrmemory'|'leastrecent'|'fewestcalls'|'random', timeout:20, max_wait_time:300, wrapup_time:5, members:['1001'], post_call_survey_enabled:false, callback_enabled:false}\n"
        "  - update_queue: {target:'kuyruk no veya ad', new_name:'', strategy:'', timeout:20, max_wait_time:300, post_call_survey_enabled:true|false, callback_enabled:true|false}\n"
        "  - add_queue_members / remove_queue_members: {queue_extension:'2000 veya kuyruk adı', members:['1001','1002']}\n"
        "  - delete_queue: {target:'kuyruk no veya ad'}\n"
        "3. YAPAY ZEKA SESLİ ASİSTAN & SENARYO:\n"
        "  - create_ai_agent: {name, voice:'Aoede'|'Charon'|'Kore'|'Fenrir'|'Puck', greeting, system_prompt, language:'tr-TR'}\n"
        "  - update_ai_agent: {target:'asistan adı', new_name:'', voice:'', greeting:'', system_prompt:''}\n"
        "  - generate_ai_agent_scenario: {target:'asistan adı', scenario_prompt:'doğal dilde senaryo akışı açıklaması'}\n"
        "  - delete_ai_agent: {target:'asistan adı'}\n"
        "4. KONFERANS, MOLA, DEPARTMAN, LOKASYON:\n"
        "  - create_conference: {name, room_number:'3000+', pin:'', admin_pin:'', internals:['1001'], externals:[], recording_enabled:false}\n"
        "  - update_conference: {target:'oda no veya ad', new_name:'', pin:'', internals:['1001'], recording_enabled:true|false} | delete_conference: {target}\n"
        "  - create_break_type: {name, max_duration_minutes:15, daily_quota_minutes:30, color:'#f59e0b'} | update_break_type: {target, new_name:'', max_duration_minutes:20, daily_quota_minutes:40, color:''} | delete_break_type: {target}\n"
        "  - create_department / update_department / delete_department: {name, target, new_name}\n"
        "  - create_location / update_location / delete_location: {name, target, new_name}\n"
        "5. ABONE & ÇAĞRI TOPLAMA GRUPLARI, HIZLI ARAMA:\n"
        "  - create_subscriber_group: {name, members:['1001','1002']} | update_subscriber_group: {target, new_name:'', members:['1001'], add_members:[], remove_members:[]} | delete_subscriber_group: {target}\n"
        "  - create_pickup_group: {name, extensions:['1001','1002']} | update_pickup_group: {target, new_name:'', extensions:['1001']} | delete_pickup_group: {target}\n"
        "  - create_speed_dial: {short_code:'4001', long_number:'0532...', description:'Kurye'} | update_speed_dial: {target:'4001', new_name:'', long_number:''} | delete_speed_dial: {target}\n"
        "6. DIŞ HAT (TRUNK), GELEN (DID) & GİDEN ARAMA KURALLARI:\n"
        "  - create_trunk: {name, host, username:'', password:'', port:5060, did_number:'', protocol:'UDP'} | update_trunk: {target, new_name:'', host:'', username:'', password:'', did_number:''} | delete_trunk: {target}\n"
        "  - create_inbound_rule: {name, did_number:'90850... veya boş(tümü)', destination_type:'queue'|'user'|'call_flow', destination_target:'2001 veya Kuyruk/Akış adı'} | update_inbound_rule: {target, new_name:'', destination_type:'', destination_target:''} | delete_inbound_rule: {target}\n"
        "  - create_outbound_rule: {name, pattern:'05XXXXXXXXX', strip:0, prepend:'', caller_id:'', trunk_target:'', allowed_extensions:[]} | update_outbound_rule: {target, new_name:'', pattern:'', caller_id:''} | delete_outbound_rule: {target}\n"
        "7. GÖRSEL ARAMA AKIŞI (IVR) & TTS SESLİ ANONS & NUMARA PLANI:\n"
        "  - create_call_flow: {name, did_number:'', work_hours_start:'09:00', work_hours_end:'18:00', welcome_announcement:'', after_hours_target:'', menu_routes:{'1':'Satış Kuyruğu','2':'Destek Kuyruğu'}, default_target:''}\n"
        "  - update_call_flow: {target, new_name:'', status:'active'|'draft', menu_routes:{}} | delete_call_flow: {target}\n"
        "  - create_tts_announcement: {name, text:'Okunacak Türkçe anons metni', type:'announcement'|'moh', voice:'tr-TR-EmelNeural'|'tr-TR-AhmetNeural'|'Aoede'}\n"
        "  - update_announcement: {target, new_name:'', type:'announcement'|'moh'} | delete_announcement: {target}\n"
        "  - update_numbering_plan: {extension_range:{start:1000,end:1999}, queue_range:{start:2000,end:2999}, conference_range:{start:3000,end:3999}, speed_dial_range:{start:4000,end:4999}}\n"
        "8. REHBER, HIZLI CEVAP, KARA LİSTE & YASAKLI KELİME:\n"
        "  - create_contact: {first_name, last_name:'', phone_number, email:'', company:'', notes:'', is_vip:false} | update_contact: {target, first_name:'', last_name:'', phone_number:'', company:'', is_vip:true|false} | delete_contact: {target}\n"
        "  - create_canned_response: {shortcut:'kargo', title:'Kargo Bilgisi', content:'Siparişiniz kargoya verilmiştir.'} | update_canned_response: {target, title:'', content:''} | delete_canned_response: {target}\n"
        "  - add_blacklist / remove_blacklist: {value:'+905...', target:'+905...', reason:''}\n"
        "  - add_block_word / remove_block_word: {word:'kelime', target:'kelime', category:'profanity'|'competitor'|'custom'}\n"
        "9. BİLGİ BANKASI (RAG), AI KURAL EDİTÖRÜ & QA KALİTE SORULARI:\n"
        "  - add_kb_text: {title:'İade Politikası', content:'14 gün içinde ücretsiz iade...'} | crawl_kb_url: {url:'https://...'} | delete_kb_source: {target:'dosya veya url'}\n"
        "  - create_ai_rule: {rule_type:'faq'|'routing'|'prompt', trigger_keyword:'fiyat', response_text:'...', action_to_trigger:'NONE'|'TRANSFER:1000'|'HANGUP'} | update_ai_rule / delete_ai_rule: {target, response_text:'', action_to_trigger:''}\n"
        "  - create_qa_question: {question:'Temsilci KVKK aydınlatmasını yaptı mı?', max_score:20} | update_qa_question: {target, question:'', max_score:25} | delete_qa_question: {target}\n"
        "10. DIŞ ARAMA KAMPANYASI (DIALER), RANDEVU, ROL, ZAMANLANMIŞ RAPOR:\n"
        "  - create_dialer_campaign: {name, agent_target:'', trunk_target:'', numbers:['0532...'], max_concurrent:2, status:'paused'|'running'} | update_dialer_campaign: {target, new_name:'', status:'running'|'paused', add_numbers:[]} | delete_dialer_campaign: {target}\n"
        "  - create_appointment: {customer_name, customer_phone, date:'YYYY-MM-DD', time:'14:00', notes:''} | update_appointment: {target, date:'', time:'', status:'confirmed'} | cancel_appointment: {target}\n"
        "  - create_role: {name, role_code:'', copy_from:'agent'|'supervisor', add_permissions:[], remove_permissions:[]} | update_role: {target, new_name:'', add_permissions:[], remove_permissions:[]} | delete_role: {target}\n"
        "  - create_scheduled_report: {name, report_type:'executive_summary', frequency:'daily'|'weekly'|'monthly', send_time:'09:00', recipients:['a@b.com']} | update_scheduled_report / delete_scheduled_report: {target}\n"
        "11. KANAL (WHATSAPP), SANTRAL/AI ÖZELLİKLERİ, GÜVENLİK, YEDEK & CANLI SÜPERVİZÖR:\n"
        "  - update_whatsapp_settings: {persona:'kurumsal'|'satis'|'destek'|'samimi', work_hours_start:'09:00', work_hours_end:'18:00', welcome_menu_enabled:true, missed_call_whatsapp_enabled:true, after_hours_message:''}\n"
        "  - update_pbx_ai_features: {voice_biometrics_enabled:true|false, smart_callback_enabled:true|false, recording_retention_days:180, nat_enabled:true|false, extern_ip:''}\n"
        "  - add_security_whitelist / remove_security_whitelist: {ip_address:'1.2.3.4', target:'1.2.3.4'}\n"
        "  - create_restore_point: {title:'...', description:''}\n"
        "  - set_agent_live_status: {target:'1001 veya isim', status:'ready'|'paused', reason:'Yemek Molası'}\n\n"
        "ZİNCİRLEME KOMUT KURALI: Kullanıcı tek cümlede birden fazla işlem istediyse (örn. 3 dahili aç, bunları yeni kuyruğa ekle, TTS anons üret ve DID'i kuyruğa bağla), "
        "tüm adımları sırasıyla `actions` dizisine koy! Yeni açılan dahililerin numaralarını aynı plandaki `create_queue.members` veya `create_subscriber_group.members` içine doğrudan yaz.\n"
        "ÇIKTI FORMATI:\n"
        '{"explanation":"Kısa Türkçe özet","actions":[{"action_type":"...","summary":"Türkçe adım açıklaması","params":{}}],"warnings":[]}'
    )

    llm_actions: List[Dict[str, Any]] = []
    llm_explanation = ""
    llm_warnings: List[str] = []
    used_engine = "semantic_parser"

    try:
        gen_res = await execute_routed_text_generation(
            task_key="config_assistant",
            tenant_id=tenant_id,
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.1,
            json_mode=True,
        )
        if gen_res.get("ok") and gen_res.get("text"):
            raw_txt = str(gen_res["text"]).strip()
            raw_txt = re.sub(r"^```(?:json)?\s*", "", raw_txt)
            raw_txt = re.sub(r"\s*```$", "", raw_txt)
            parsed_json = json.loads(raw_txt)
            if isinstance(parsed_json, dict) and isinstance(parsed_json.get("actions"), list) and len(parsed_json["actions"]) > 0:
                llm_actions = parsed_json["actions"]
                llm_explanation = str(parsed_json.get("explanation") or "").strip()
                if isinstance(parsed_json.get("warnings"), list):
                    llm_warnings = [str(w) for w in parsed_json["warnings"] if w]
                used_engine = f"{gen_res.get('provider')}:{gen_res.get('model')}"
    except Exception as e:
        print(f"[AI Config Assistant LLM Fallback]: {e}")

    if not llm_actions:
        llm_actions, sem_warnings = _parse_config_prompt_semantically(prompt, ctx)
        llm_warnings.extend(sem_warnings)
    else:
        # Complement check: if user wrote a multi-clause command and LLM dropped obvious clauses, check semantic parser count
        sem_actions, _ = _parse_config_prompt_semantically(prompt, copy.deepcopy(ctx))
        existing_types = { _normalize_llm_action(a, _tr_norm(prompt), ctx).get("action_type") for a in llm_actions if isinstance(a, dict) }
        for sa in sem_actions:
            st = sa.get("action_type")
            # Append distinct non-conflicting high-specificity actions missed by LLM (e.g. restore point, TTS, KB, QA)
            if st in (
                "create_restore_point", "create_tts_announcement", "add_kb_text", "crawl_kb_url",
                "create_qa_question", "add_security_whitelist", "create_canned_response", "create_contact",
            ) and st not in existing_types:
                llm_actions.append(sa)
                existing_types.add(st)

    enriched_actions, val_warnings, blocked_perms = _validate_and_enrich_plan_actions(
        llm_actions, user_perms, ctx, _tr_norm(prompt)
    )
    all_warnings = list(dict.fromkeys(llm_warnings + val_warnings))

    if not llm_explanation:
        if enriched_actions:
            llm_explanation = f"Komutunuz analiz edildi ve {len(enriched_actions)} yapılandırma adımı Dry-Run önizlemesine hazırlandı."
        else:
            llm_explanation = "Komutunuzdan uygulanabilir bir yapılandırma adımı çıkarılamadı."

    allowed_count = sum(1 for a in enriched_actions if a["allowed"])

    return {
        "status": "ok",
        "engine": used_engine,
        "prompt": prompt,
        "explanation": llm_explanation,
        "actions": enriched_actions,
        "total_actions": len(enriched_actions),
        "allowed_actions": allowed_count,
        "blocked_permissions": blocked_perms,
        "permission_blocks": blocked_perms,
        "can_apply": len(enriched_actions) > 0 and allowed_count == len(enriched_actions),
        "warnings": all_warnings,
    }


# ============================================================================
# 6. APPLY ENGINE (78 ACTIONS + BATCH CROSS-LINKING + ASTERISK SYNC)
# ============================================================================

SNAPSHOT_SETTINGS_KEYS = (
    "users",
    "queues",
    "ai_agents",
    "conferences",
    "blacklist",
    "block_words",
    "inbound_rules",
    "outbound_rules",
    "workflows",
    "announcements",
    "scheduled_reports",
    "breaks",
    "departments",
    "locations",
    "subscriber_groups",
    "call_pickup_groups",
    "speed_dials",
    "trunks",
    "contacts",
    "rules",
    "roles",
    "dialer_campaigns",
    "numbering_plan",
    "channels",
    "pbx",
    "nat",
    "voice_biometrics",
    "smart_callback",
    "recording_retention",
    "security_whitelisted_ips",
)


def _make_silent_wav_bytes(duration_sec: float = 1.0, sample_rate: int = 8000) -> bytes:
    """Fallback 16-bit mono PCM WAV generator so offline/dev environments never fail TTS file creation."""
    import struct
    num_samples = int(duration_sec * sample_rate)
    data_size = num_samples * 2
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        1,
        sample_rate,
        sample_rate * 2,
        2,
        16,
        b"data",
        data_size,
    )
    return header + (b"\x00\x00" * num_samples)


def _sync_asterisk_dialplan_and_endpoints() -> None:
    """Regenerates PJSIP, Queues, and Extensions configs and runs sync_asterisk.py with safe timeout."""
    try:
        from backend.main import (
            regenerate_extensions_custom_conf,
            regenerate_pjsip_custom_conf,
            regenerate_queues_conf,
        )
        try:
            regenerate_pjsip_custom_conf(None)
        except Exception as e1:
            print(f"[AI Config Assistant PJSIP Sync]: {e1}")
        try:
            regenerate_queues_conf(None)
        except Exception as e2:
            print(f"[AI Config Assistant Queues Sync]: {e2}")
        try:
            regenerate_extensions_custom_conf(None)
        except Exception as e3:
            print(f"[AI Config Assistant Extensions Sync]: {e3}")
    except Exception:
        pass
    try:
        subprocess.run(
            ["python3", "backend/scripts/sync_asterisk.py"],
            timeout=2.0,
            capture_output=True,
        )
    except Exception:
        pass


def _build_visual_call_flow_graph(
    name: str,
    did_number: str,
    work_start: str,
    work_end: str,
    welcome_ann_id: str,
    welcome_ann_name: str,
    menu_routes: Dict[str, Dict[str, Any]],
    after_hours_ann_id: str = "",
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Builds a valid CallFlowEditor.js compatible visual workflow graph (`nodes` + `connections`)."""
    nodes: List[Dict[str, Any]] = []
    conns: List[Dict[str, Any]] = []

    did_node_id = f"node-did-{uuid.uuid4().hex[:6]}"
    nodes.append({
        "id": did_node_id,
        "type": "did",
        "title": f"DID Giriş ({did_number or 'Tümü'})",
        "x": 80,
        "y": 200,
        "config": {
            "number": did_number or "*",
            "extra_fields": {
                "did_numbers": [did_number] if did_number else [],
                "is_wildcard": not bool(did_number),
            },
        },
    })

    tr_node_id = f"node-time-{uuid.uuid4().hex[:6]}"
    nodes.append({
        "id": tr_node_id,
        "type": "timerule",
        "title": f"Mesai Kontrolü ({work_start}-{work_end})",
        "x": 360,
        "y": 200,
        "config": {
            "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "start_time": work_start or "09:00",
            "end_time": work_end or "18:00",
        },
    })
    conns.append({"id": f"c-{uuid.uuid4().hex[:6]}", "from": did_node_id, "fromPort": "output", "to": tr_node_id, "toPort": "input"})

    prev_active_id = tr_node_id
    prev_active_port = "active"
    cur_x = 660

    if welcome_ann_id or welcome_ann_name:
        play_id = f"node-play-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": play_id,
            "type": "play",
            "title": welcome_ann_name or "Karşılama Anonsu",
            "x": cur_x,
            "y": 140,
            "config": {"announcement_id": welcome_ann_id, "file": welcome_ann_name},
        })
        conns.append({"id": f"c-{uuid.uuid4().hex[:6]}", "from": prev_active_id, "fromPort": prev_active_port, "to": play_id, "toPort": "input"})
        prev_active_id = play_id
        prev_active_port = "output"
        cur_x += 280

    if menu_routes:
        opts = sorted(list(menu_routes.keys()))
        if "timeout" not in opts:
            opts.append("timeout")
        menu_id = f"node-menu-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": menu_id,
            "type": "menu",
            "title": f"{name} IVR Menüsü",
            "x": cur_x,
            "y": 140,
            "options": opts,
            "config": {"timeout": 8, "max_retries": 2},
        })
        conns.append({"id": f"c-{uuid.uuid4().hex[:6]}", "from": prev_active_id, "fromPort": prev_active_port, "to": menu_id, "toPort": "input"})
        cur_x += 300
        for r_idx, (digit, dest_meta) in enumerate(menu_routes.items()):
            tf_id = f"node-xfer-{digit}-{uuid.uuid4().hex[:5]}"
            nodes.append({
                "id": tf_id,
                "type": "transfer",
                "title": f"Tuş {digit} -> {dest_meta.get('label') or dest_meta.get('target')}",
                "x": cur_x,
                "y": 60 + r_idx * 130,
                "config": {
                    "target_type": dest_meta.get("type") or "queue",
                    "target": str(dest_meta.get("target") or ""),
                    "extension": str(dest_meta.get("extension") or dest_meta.get("target") or ""),
                },
            })
            conns.append({"id": f"c-{uuid.uuid4().hex[:6]}", "from": menu_id, "fromPort": str(digit), "to": tf_id, "toPort": "input"})

    # After-hours hangup / announcement node
    ah_id = f"node-hangup-{uuid.uuid4().hex[:6]}"
    if after_hours_ann_id:
        ah_play = f"node-ahplay-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": ah_play,
            "type": "play",
            "title": "Mesai Dışı Anons",
            "x": 660,
            "y": 360,
            "config": {"announcement_id": after_hours_ann_id},
        })
        conns.append({"id": f"c-{uuid.uuid4().hex[:6]}", "from": tr_node_id, "fromPort": "inactive", "to": ah_play, "toPort": "input"})
        nodes.append({"id": ah_id, "type": "hangup", "title": "Çağrıyı Sonlandır", "x": 940, "y": 360, "config": {}})
        conns.append({"id": f"c-{uuid.uuid4().hex[:6]}", "from": ah_play, "fromPort": "output", "to": ah_id, "toPort": "input"})
    else:
        nodes.append({"id": ah_id, "type": "hangup", "title": "Mesai Dışı Kapat", "x": 660, "y": 360, "config": {}})
        conns.append({"id": f"c-{uuid.uuid4().hex[:6]}", "from": tr_node_id, "fromPort": "inactive", "to": ah_id, "toPort": "input"})

    return nodes, conns


@ai_config_assistant_router.post("/api/ai-config-assistant/apply")
async def apply_ai_configuration_plan(request: Request, payload: Dict[str, Any] = Body(...)):
    """Executes an approved AI Configuration Plan across all 26 modules, stores an Undo Snapshot, and syncs Asterisk."""
    from backend.main import (
        _convert_and_sync_announcement_wav,
        _calc_audio_duration_seconds,
        _format_duration_mmss,
        _sync_rules_to_settings,
        _synthesize_announcement_tts_async,
        compile_agent_scenario_to_instruction,
        create_tenant_restore_point,
        parse_scenario_semantically,
        save_settings,
        settings_db,
    )
    from backend.services.rag_service import delete_indexed_source, index_manual_text, index_website_url

    raw_actions = payload.get("actions")
    prompt = str(payload.get("prompt") or "").strip()
    if not isinstance(raw_actions, list) or not raw_actions:
        raise HTTPException(status_code=400, detail="Uygulanacak yapılandırma adımı bulunamadı.")

    tenant_id = _extract_tenant_id(request, payload)
    norm_tenant = "tenant-default" if _is_default_tenant(tenant_id) else tenant_id
    user_label, _role_code, _is_admin, user_perms = await _resolve_request_user_permissions(request, tenant_id)
    ctx = await _gather_pbx_context(tenant_id)

    validated_actions, _, blocked_perms = _validate_and_enrich_plan_actions(
        raw_actions, user_perms, ctx, _tr_norm(prompt)
    )
    if blocked_perms:
        raise HTTPException(
            status_code=403,
            detail=f"Bu planı uygulamak için eksik yetkileriniz var: {', '.join(blocked_perms)}",
        )

    # 1. Capture Lossless Undo Snapshot before mutating settings_db or PostgreSQL
    snapshot_id = f"cfg-snap-{uuid.uuid4().hex[:10]}"
    pre_snapshot_settings = {
        k: copy.deepcopy(settings_db.get(k, [] if k not in ("numbering_plan", "channels", "pbx", "nat", "voice_biometrics", "smart_callback", "recording_retention") else {}))
        for k in SNAPSHOT_SETTINGS_KEYS
    }

    created_db_records: Dict[str, List[Any]] = {
        "users": [],
        "queues": [],
        "blacklist": [],
        "block_words": [],
        "breaks": [],
        "trunks": [],
        "contacts": [],
        "canned_responses": [],
        "rules": [],
        "qa_questions": [],
        "appointments": [],
        "roles": [],
        "rag_sources": [],
        "tts_files": [],
    }
    modified_db_records: Dict[str, List[Dict[str, Any]]] = {
        "users": [], "queues": [], "breaks": [], "trunks": [], "contacts": [],
        "canned_responses": [], "rules": [], "qa_questions": [], "appointments": [], "roles": [],
    }
    deleted_db_records: Dict[str, List[Dict[str, Any]]] = {
        "users": [], "queues": [], "breaks": [], "trunks": [], "contacts": [],
        "canned_responses": [], "rules": [], "qa_questions": [], "appointments": [], "roles": [],
        "blacklist": [], "block_words": [],
    }

    applied_summaries: List[str] = []
    skipped_warnings: List[str] = []
    need_asterisk_sync = False

    # Cross-action live lookup maps within this apply transaction
    batch_ext_to_user_id: Dict[str, int] = {}
    batch_queue_ext_to_id: Dict[str, int] = {}
    batch_queue_name_to_id: Dict[str, int] = {}
    batch_ann_name_to_id: Dict[str, str] = {}
    batch_flow_name_to_id: Dict[str, str] = {}

    async with AsyncSessionLocal() as db:
        # Pre-index existing user extensions -> DB IDs and queue extensions -> DB IDs
        u_existing = (await db.execute(_apply_tenant_clause(select(SystemUser), SystemUser, tenant_id))).scalars().all()
        for ue in u_existing:
            if ue.extension:
                batch_ext_to_user_id[str(ue.extension)] = ue.id
        q_existing = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
        for qe in q_existing:
            if qe.extension:
                batch_queue_ext_to_id[str(qe.extension)] = qe.id
            if qe.name:
                batch_queue_name_to_id[_tr_norm(qe.name)] = qe.id

        for act in validated_actions:
            if not act.get("allowed"):
                continue
            a_type = act["action_type"]
            p = act.get("params") or {}

            # ==============================================================
            # 1. USERS & EXTENSIONS
            # ==============================================================
            if a_type == "create_user":
                ext = str(p.get("extension") or "").strip()
                full_name = str(p.get("full_name") or f"Dahili {ext}").strip()
                role = str(p.get("role") or "agent").lower()
                email = str(p.get("email") or f"ext{ext}@pbx.local").strip()
                dept = str(p.get("department") or "").strip()
                loc = str(p.get("location") or "").strip()
                pwd = str(p.get("password") or f"Pbx{ext}!").strip()
                sip_secret = f"Sip{ext}_{uuid.uuid4().hex[:6]}"
                rec_on = bool(p.get("call_recording", True))
                vm_on = bool(p.get("voicemail_enabled", False))
                out_perm = bool(p.get("outbound_permission", True))
                mob = str(p.get("mobile_phone") or "").strip()

                new_u = SystemUser(
                    tenant_id=norm_tenant,
                    full_name=full_name,
                    email=email,
                    password_hash=pwd,
                    extension=ext,
                    sip_secret=sip_secret,
                    role=role,
                    status="active",
                    call_recording=rec_on,
                    voicemail_enabled=vm_on,
                    outbound_permission=out_perm,
                    mobile_phone=mob or None,
                )
                db.add(new_u)
                await db.flush()
                created_db_records["users"].append(new_u.id)
                batch_ext_to_user_id[ext] = new_u.id

                settings_db.setdefault("users", []).append({
                    "id": new_u.id,
                    "tenant_id": norm_tenant,
                    "full_name": full_name,
                    "name": full_name,
                    "email": email,
                    "password": pwd,
                    "extension": ext,
                    "sip_secret": sip_secret,
                    "role": role,
                    "department": dept,
                    "location": loc,
                    "mobile_phone": mob,
                    "status": "active",
                    "call_recording": rec_on,
                    "voicemail_enabled": vm_on,
                    "outbound_permission": out_perm,
                })
                applied_summaries.append(f"Dahili {ext} ({full_name} - {role}) oluşturuldu.")
                need_asterisk_sync = True

            elif a_type == "update_user":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                u_rows = (await db.execute(_apply_tenant_clause(select(SystemUser), SystemUser, tenant_id))).scalars().all()
                matched_u = next(
                    (u for u in u_rows if _tr_norm(u.extension) == nt or _tr_norm(u.full_name) == nt or str(u.id) == target),
                    None,
                )
                if not matched_u and len(nt) >= 3:
                    matched_u = next((u for u in u_rows if nt in _tr_norm(u.full_name)), None)

                old_label = matched_u.full_name if matched_u else target
                updated_any = False
                if matched_u:
                    modified_db_records["users"].append({
                        "id": matched_u.id,
                        "full_name": matched_u.full_name,
                        "role": matched_u.role,
                        "email": matched_u.email,
                        "mobile_phone": matched_u.mobile_phone,
                        "call_recording": matched_u.call_recording,
                        "voicemail_enabled": matched_u.voicemail_enabled,
                        "outbound_permission": matched_u.outbound_permission,
                    })
                    if p.get("new_name"):
                        matched_u.full_name = str(p["new_name"]).strip()
                    if p.get("role"):
                        matched_u.role = str(p["role"]).strip().lower()
                    if p.get("email"):
                        matched_u.email = str(p["email"]).strip()
                    if p.get("password"):
                        matched_u.password_hash = str(p["password"]).strip()
                    if p.get("mobile_phone") is not None and str(p.get("mobile_phone")).strip():
                        matched_u.mobile_phone = str(p["mobile_phone"]).strip()
                    if "call_recording" in p and p["call_recording"] is not None:
                        matched_u.call_recording = bool(p["call_recording"])
                    if "voicemail_enabled" in p and p["voicemail_enabled"] is not None:
                        matched_u.voicemail_enabled = bool(p["voicemail_enabled"])
                    if "outbound_permission" in p and p["outbound_permission"] is not None:
                        matched_u.outbound_permission = bool(p["outbound_permission"])
                    updated_any = True

                for u_dict in settings_db.get("users", []) or []:
                    if not isinstance(u_dict, dict) or not _match_dict_tenant(u_dict, tenant_id):
                        continue
                    if (
                        (matched_u and u_dict.get("id") == matched_u.id)
                        or _tr_norm(u_dict.get("extension")) == nt
                        or _tr_norm(u_dict.get("full_name") or u_dict.get("name")) == nt
                    ):
                        if p.get("new_name"):
                            u_dict["full_name"] = str(p["new_name"]).strip()
                            u_dict["name"] = str(p["new_name"]).strip()
                        if p.get("role"):
                            u_dict["role"] = str(p["role"]).strip().lower()
                        if p.get("email"):
                            u_dict["email"] = str(p["email"]).strip()
                        if p.get("department"):
                            u_dict["department"] = str(p["department"]).strip()
                        if p.get("location"):
                            u_dict["location"] = str(p["location"]).strip()
                        if p.get("mobile_phone"):
                            u_dict["mobile_phone"] = str(p["mobile_phone"]).strip()
                        if "call_recording" in p and p["call_recording"] is not None:
                            u_dict["call_recording"] = bool(p["call_recording"])
                        if "voicemail_enabled" in p and p["voicemail_enabled"] is not None:
                            u_dict["voicemail_enabled"] = bool(p["voicemail_enabled"])
                        if "outbound_permission" in p and p["outbound_permission"] is not None:
                            u_dict["outbound_permission"] = bool(p["outbound_permission"])
                        updated_any = True

                if updated_any:
                    applied_summaries.append(f"Kullanıcı '{old_label}' bilgileri güncellendi.")
                    need_asterisk_sync = True
                else:
                    skipped_warnings.append(f"Güncellenecek kullanıcı bulunamadı: '{target}'")

            elif a_type == "delete_user":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                u_rows = (await db.execute(_apply_tenant_clause(select(SystemUser), SystemUser, tenant_id))).scalars().all()
                matched_u = next(
                    (u for u in u_rows if _tr_norm(u.extension) == nt or _tr_norm(u.full_name) == nt or str(u.id) == target),
                    None,
                )
                if matched_u:
                    deleted_db_records["users"].append({
                        "tenant_id": matched_u.tenant_id,
                        "full_name": matched_u.full_name,
                        "email": matched_u.email,
                        "password_hash": matched_u.password_hash,
                        "extension": matched_u.extension,
                        "sip_secret": matched_u.sip_secret,
                        "role": matched_u.role,
                        "status": matched_u.status,
                    })
                    await db.delete(matched_u)
                before_cnt = len(settings_db.get("users", []) or [])
                settings_db["users"] = [
                    u for u in (settings_db.get("users", []) or [])
                    if not (
                        isinstance(u, dict)
                        and _match_dict_tenant(u, tenant_id)
                        and (_tr_norm(u.get("extension")) == nt or _tr_norm(u.get("full_name") or u.get("name")) == nt or (matched_u and u.get("id") == matched_u.id))
                    )
                ]
                if matched_u or len(settings_db["users"]) < before_cnt:
                    applied_summaries.append(f"Kullanıcı / Dahili '{target}' silindi.")
                    need_asterisk_sync = True
                else:
                    skipped_warnings.append(f"Silinecek kullanıcı bulunamadı: '{target}'")

            elif a_type == "update_user_forwarding":
                ext = str(p.get("extension") or "").strip()
                mode = str(p.get("mode") or "always").lower()
                dest = str(p.get("destination") or "").strip()
                active = bool(p.get("active", True))
                timeout_s = int(p.get("timeout") or 25)
                fwd_field = {
                    "always": "forwarding_always",
                    "busy": "forwarding_busy",
                    "no_answer": "forwarding_no_answer",
                }.get(mode, "forwarding_always")
                fwd_obj = {"active": active, "destination": dest, "timeout": timeout_s}

                u_rows = (await db.execute(_apply_tenant_clause(select(SystemUser), SystemUser, tenant_id))).scalars().all()
                mu = next((u for u in u_rows if str(u.extension or "") == ext), None)
                if mu:
                    modified_db_records["users"].append({
                        "id": mu.id,
                        fwd_field: copy.deepcopy(getattr(mu, fwd_field, None)),
                    })
                    setattr(mu, fwd_field, fwd_obj)
                for u_dict in settings_db.get("users", []) or []:
                    if isinstance(u_dict, dict) and str(u_dict.get("extension") or "") == ext and _match_dict_tenant(u_dict, tenant_id):
                        u_dict[fwd_field] = fwd_obj
                applied_summaries.append(f"Dahili {ext} ({mode}) yönlendirmesi -> {dest} ({'Aktif' if active else 'Pasif'}) ayarlandı.")

            # ==============================================================
            # 2. ACD QUEUES
            # ==============================================================
            elif a_type == "create_queue":
                q_name = str(p.get("name") or "").strip()
                q_ext = str(p.get("extension") or "").strip()
                strat = str(p.get("strategy") or "ringall").strip()
                timeout_s = int(p.get("timeout") or 20)
                max_wait = int(p.get("max_wait_time") or 300)
                wrapup = int(p.get("wrapup_time") or 5)
                members = [str(m).strip() for m in (p.get("members") or []) if str(m).strip()]
                survey_on = bool(p.get("post_call_survey_enabled", False))
                cb_on = bool(p.get("callback_enabled", False))

                new_q = PBXQueue(
                    tenant_id=norm_tenant,
                    name=q_name,
                    extension=q_ext,
                    strategy=strat,
                    timeout=timeout_s,
                    max_wait_time=max_wait,
                    wrapup_time=wrapup,
                    queueMembers=members,
                    post_call_survey_enabled=survey_on,
                    callback_enabled=cb_on,
                )
                db.add(new_q)
                await db.flush()
                created_db_records["queues"].append(new_q.id)
                batch_queue_ext_to_id[q_ext] = new_q.id
                batch_queue_name_to_id[_tr_norm(q_name)] = new_q.id

                settings_db.setdefault("queues", []).append({
                    "id": new_q.id,
                    "tenant_id": norm_tenant,
                    "name": q_name,
                    "extension": q_ext,
                    "strategy": strat,
                    "timeout": timeout_s,
                    "max_wait_time": max_wait,
                    "wrapup_time": wrapup,
                    "queueMembers": members,
                    "members": members,
                    "post_call_survey_enabled": survey_on,
                    "callback_enabled": cb_on,
                })
                applied_summaries.append(f"ACD Kuyruğu '{q_name}' ({q_ext}) oluşturuldu (Üyeler: {', '.join(members) or 'Yok'}).")
                need_asterisk_sync = True

            elif a_type == "update_queue":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                q_rows = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
                mq = next((q for q in q_rows if _tr_norm(q.extension) == nt or _tr_norm(q.name) == nt or str(q.id) == target), None)
                updated_q = False
                if mq:
                    modified_db_records["queues"].append({
                        "id": mq.id,
                        "name": mq.name,
                        "strategy": mq.strategy,
                        "timeout": mq.timeout,
                        "max_wait_time": mq.max_wait_time,
                        "post_call_survey_enabled": mq.post_call_survey_enabled,
                        "callback_enabled": mq.callback_enabled,
                    })
                    if p.get("new_name"):
                        mq.name = str(p["new_name"]).strip()
                    if p.get("strategy"):
                        mq.strategy = str(p["strategy"]).strip()
                    if p.get("timeout"):
                        mq.timeout = int(p["timeout"])
                    if p.get("max_wait_time"):
                        mq.max_wait_time = int(p["max_wait_time"])
                    if "post_call_survey_enabled" in p and p["post_call_survey_enabled"] is not None:
                        mq.post_call_survey_enabled = bool(p["post_call_survey_enabled"])
                    if "callback_enabled" in p and p["callback_enabled"] is not None:
                        mq.callback_enabled = bool(p["callback_enabled"])
                    updated_q = True

                for qd in settings_db.get("queues", []) or []:
                    if isinstance(qd, dict) and _match_dict_tenant(qd, tenant_id) and (
                        (mq and qd.get("id") == mq.id) or _tr_norm(qd.get("extension")) == nt or _tr_norm(qd.get("name")) == nt
                    ):
                        if p.get("new_name"):
                            qd["name"] = str(p["new_name"]).strip()
                        if p.get("strategy"):
                            qd["strategy"] = str(p["strategy"]).strip()
                        if p.get("timeout"):
                            qd["timeout"] = int(p["timeout"])
                        if p.get("max_wait_time"):
                            qd["max_wait_time"] = int(p["max_wait_time"])
                        if "post_call_survey_enabled" in p and p["post_call_survey_enabled"] is not None:
                            qd["post_call_survey_enabled"] = bool(p["post_call_survey_enabled"])
                        if "callback_enabled" in p and p["callback_enabled"] is not None:
                            qd["callback_enabled"] = bool(p["callback_enabled"])
                        updated_q = True
                if updated_q:
                    applied_summaries.append(f"ACD Kuyruğu '{target}' güncellendi.")
                    need_asterisk_sync = True
                else:
                    skipped_warnings.append(f"Güncellenecek kuyruk bulunamadı: '{target}'")

            elif a_type in ("add_queue_members", "remove_queue_members"):
                q_ref = str(p.get("queue_extension") or p.get("target") or "").strip()
                nq = _tr_norm(q_ref)
                mems = [str(m).strip() for m in (p.get("members") or []) if str(m).strip()]
                is_add = a_type == "add_queue_members"

                q_rows = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
                mq = next((q for q in q_rows if _tr_norm(q.extension) == nq or _tr_norm(q.name) == nq), None)
                if mq:
                    cur = list(mq.queueMembers or [])
                    modified_db_records["queues"].append({"id": mq.id, "queueMembers": copy.deepcopy(cur)})
                    if is_add:
                        for m in mems:
                            if m not in cur:
                                cur.append(m)
                    else:
                        cur = [x for x in cur if x not in mems]
                    mq.queueMembers = cur

                for qd in settings_db.get("queues", []) or []:
                    if isinstance(qd, dict) and _match_dict_tenant(qd, tenant_id) and (
                        _tr_norm(qd.get("extension")) == nq or _tr_norm(qd.get("name")) == nq
                    ):
                        cur_d = list(qd.get("queueMembers") or qd.get("members") or [])
                        if is_add:
                            for m in mems:
                                if m not in cur_d:
                                    cur_d.append(m)
                        else:
                            cur_d = [x for x in cur_d if x not in mems]
                        qd["queueMembers"] = cur_d
                        qd["members"] = cur_d
                applied_summaries.append(
                    f"Kuyruk '{q_ref}' üyeleri {'eklendi' if is_add else 'çıkarıldı'}: {', '.join(mems)}."
                )
                need_asterisk_sync = True

            elif a_type == "delete_queue":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                q_rows = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
                mq = next((q for q in q_rows if _tr_norm(q.extension) == nt or _tr_norm(q.name) == nt or str(q.id) == target), None)
                if mq:
                    deleted_db_records["queues"].append({
                        "tenant_id": mq.tenant_id,
                        "name": mq.name,
                        "extension": mq.extension,
                        "strategy": mq.strategy,
                        "timeout": mq.timeout,
                        "max_wait_time": mq.max_wait_time,
                        "wrapup_time": mq.wrapup_time,
                        "queueMembers": list(mq.queueMembers or []),
                    })
                    await db.delete(mq)
                settings_db["queues"] = [
                    q for q in (settings_db.get("queues", []) or [])
                    if not (isinstance(q, dict) and _match_dict_tenant(q, tenant_id) and (_tr_norm(q.get("extension")) == nt or _tr_norm(q.get("name")) == nt))
                ]
                applied_summaries.append(f"ACD Kuyruğu '{target}' silindi.")
                need_asterisk_sync = True

            # ==============================================================
            # 3. AI AGENTS & VISUAL SCENARIO GENERATOR
            # ==============================================================
            elif a_type == "create_ai_agent":
                ag_id = f"agent-{uuid.uuid4().hex[:8]}"
                ag_name = str(p.get("name") or "Yeni AI Asistan").strip()
                voice = str(p.get("voice") or "Aoede").strip()
                greeting = str(p.get("greeting") or f"Merhaba, ben {ag_name}. Size nasıl yardımcı olabilirim?").strip()
                sys_prompt = str(p.get("system_prompt") or f"Sen {ag_name} isimli kurumsal müşteri temsilcisisin.").strip()
                ag_obj = {
                    "id": ag_id,
                    "tenant_id": norm_tenant,
                    "name": ag_name,
                    "voice": voice,
                    "language": str(p.get("language") or "tr-TR"),
                    "greeting": greeting,
                    "system_prompt": sys_prompt,
                    "provider": "google",
                    "llm_provider": "google",
                    "stt_provider": "google",
                    "tts_provider": "google",
                    "active": True,
                }
                if p.get("scenario_prompt"):
                    flow = parse_scenario_semantically(str(p["scenario_prompt"]))
                    ag_obj["scenario_flow"] = flow
                    ag_obj["compiled_scenario_instruction"] = compile_agent_scenario_to_instruction(flow)
                settings_db.setdefault("ai_agents", []).append(ag_obj)
                applied_summaries.append(f"Yapay Zeka Sesli Asistan '{ag_name}' ({voice}) oluşturuldu.")

            elif a_type == "update_ai_agent":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                found_ag = False
                for ag in settings_db.get("ai_agents", []) or []:
                    if isinstance(ag, dict) and _match_dict_tenant(ag, tenant_id) and (_tr_norm(ag.get("name")) == nt or str(ag.get("id")) == target):
                        if p.get("new_name"):
                            ag["name"] = str(p["new_name"]).strip()
                        if p.get("voice"):
                            ag["voice"] = str(p["voice"]).strip()
                        if p.get("greeting"):
                            ag["greeting"] = str(p["greeting"]).strip()
                        if p.get("system_prompt"):
                            ag["system_prompt"] = str(p["system_prompt"]).strip()
                        found_ag = True
                if found_ag:
                    applied_summaries.append(f"AI Asistan '{target}' güncellendi.")
                else:
                    skipped_warnings.append(f"AI Asistan bulunamadı: '{target}'")

            elif a_type == "generate_ai_agent_scenario":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                scen_prompt = str(p.get("scenario_prompt") or prompt).strip()
                flow = parse_scenario_semantically(scen_prompt)
                compiled = compile_agent_scenario_to_instruction(flow)
                matched_ag = None
                for ag in settings_db.get("ai_agents", []) or []:
                    if isinstance(ag, dict) and _match_dict_tenant(ag, tenant_id) and (_tr_norm(ag.get("name")) == nt or str(ag.get("id")) == target):
                        matched_ag = ag
                        break
                if not matched_ag and (settings_db.get("ai_agents") or []):
                    for ag in settings_db["ai_agents"]:
                        if isinstance(ag, dict) and _match_dict_tenant(ag, tenant_id):
                            matched_ag = ag
                            break
                if matched_ag:
                    matched_ag["scenario_flow"] = flow
                    matched_ag["compiled_scenario_instruction"] = compiled
                    applied_summaries.append(
                        f"'{matched_ag.get('name')}' asistanı için {len(flow.get('nodes') or [])} düğümlü görsel diyalog senaryosu derlendi."
                    )
                else:
                    skipped_warnings.append(f"Senaryo atanacak AI asistan bulunamadı: '{target}'")

            elif a_type == "delete_ai_agent":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["ai_agents"] = [
                    ag for ag in (settings_db.get("ai_agents", []) or [])
                    if not (isinstance(ag, dict) and _match_dict_tenant(ag, tenant_id) and (_tr_norm(ag.get("name")) == nt or str(ag.get("id")) == target))
                ]
                applied_summaries.append(f"AI Asistan '{target}' silindi.")

            # ==============================================================
            # 4. CONFERENCES (ConferencesPanel.js exact schema)
            # ==============================================================
            elif a_type == "create_conference":
                rm = str(p.get("room_number") or "").strip()
                nm = str(p.get("name") or f"Konferans {rm}").strip()
                pin = str(p.get("pin") or "").strip()
                admin_pin = str(p.get("admin_pin") or "").strip()
                internals = [str(x) for x in (p.get("internals") or [])]
                externals = [str(x) for x in (p.get("externals") or [])]
                rec = bool(p.get("recording_enabled", False))
                settings_db.setdefault("conferences", []).append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": norm_tenant,
                    "room_number": rm,
                    "extension": rm,
                    "room_name": nm,
                    "name": nm,
                    "pin": pin,
                    "admin_pin": admin_pin,
                    "internals": internals,
                    "externals": externals,
                    "recording_enabled": rec,
                })
                applied_summaries.append(f"Konferans odası {rm} ('{nm}') oluşturuldu.")
                need_asterisk_sync = True

            elif a_type == "update_conference":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for c in settings_db.get("conferences", []) or []:
                    if isinstance(c, dict) and _match_dict_tenant(c, tenant_id) and (
                        _tr_norm(c.get("room_number") or c.get("extension")) == nt or _tr_norm(c.get("room_name") or c.get("name")) == nt
                    ):
                        if p.get("new_name"):
                            c["room_name"] = str(p["new_name"]).strip()
                            c["name"] = str(p["new_name"]).strip()
                        if "pin" in p and p["pin"] is not None:
                            c["pin"] = str(p["pin"]).strip()
                        if p.get("internals"):
                            c["internals"] = [str(x) for x in p["internals"]]
                        if "recording_enabled" in p and p["recording_enabled"] is not None:
                            c["recording_enabled"] = bool(p["recording_enabled"])
                applied_summaries.append(f"Konferans odası '{target}' güncellendi.")
                need_asterisk_sync = True

            elif a_type == "delete_conference":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["conferences"] = [
                    c for c in (settings_db.get("conferences", []) or [])
                    if not (isinstance(c, dict) and _match_dict_tenant(c, tenant_id) and (_tr_norm(c.get("room_number") or c.get("extension")) == nt or _tr_norm(c.get("room_name") or c.get("name")) == nt))
                ]
                applied_summaries.append(f"Konferans odası '{target}' silindi.")
                need_asterisk_sync = True

            # ==============================================================
            # 5. BREAK TYPES (BreakDefinitions.js + BreakType DB)
            # ==============================================================
            elif a_type == "create_break_type":
                b_name = str(p.get("name") or "Yeni Mola").strip()
                max_dur = int(p.get("max_duration_minutes") or p.get("duration_minutes") or 15)
                quota = int(p.get("daily_quota_minutes") or max_dur * 2)
                raw_col = str(p.get("color") or "#f59e0b").strip()
                col = BREAK_COLOR_MAP.get(_tr_norm(raw_col), raw_col if raw_col.startswith("#") else "#f59e0b")

                new_bt = BreakType(
                    name=b_name,
                    max_duration_minutes=max_dur,
                    daily_quota_minutes=quota,
                    color=col,
                    icon="Coffee",
                    is_active=True,
                )
                db.add(new_bt)
                await db.flush()
                created_db_records["breaks"].append(new_bt.id)

                existing_ids = [int(b.get("id")) for b in (settings_db.get("breaks", []) or []) if isinstance(b, dict) and str(b.get("id", "")).isdigit()]
                next_bid = new_bt.id or ((max(existing_ids) + 1) if existing_ids else 1)
                settings_db.setdefault("breaks", []).append({
                    "id": next_bid,
                    "name": b_name,
                    "max_duration_minutes": max_dur,
                    "daily_quota_minutes": quota,
                    "color": col,
                    "icon": "Coffee",
                    "is_active": True,
                })
                applied_summaries.append(f"Mola tanımı '{b_name}' ({max_dur} dk / kota {quota} dk) eklendi.")

            elif a_type == "update_break_type":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                b_rows = (await db.execute(select(BreakType))).scalars().all()
                mb = next((b for b in b_rows if _tr_norm(b.name) == nt or str(b.id) == target), None)
                if mb:
                    modified_db_records["breaks"].append({
                        "id": mb.id,
                        "name": mb.name,
                        "max_duration_minutes": mb.max_duration_minutes,
                        "daily_quota_minutes": mb.daily_quota_minutes,
                        "color": mb.color,
                    })
                    if p.get("new_name"):
                        mb.name = str(p["new_name"]).strip()
                    if p.get("max_duration_minutes"):
                        mb.max_duration_minutes = int(p["max_duration_minutes"])
                    if p.get("daily_quota_minutes"):
                        mb.daily_quota_minutes = int(p["daily_quota_minutes"])
                    if p.get("color"):
                        rc = str(p["color"]).strip()
                        mb.color = BREAK_COLOR_MAP.get(_tr_norm(rc), rc if rc.startswith("#") else mb.color)
                for bd in settings_db.get("breaks", []) or []:
                    if isinstance(bd, dict) and (_tr_norm(bd.get("name")) == nt or str(bd.get("id")) == target):
                        if p.get("new_name"):
                            bd["name"] = str(p["new_name"]).strip()
                        if p.get("max_duration_minutes"):
                            bd["max_duration_minutes"] = int(p["max_duration_minutes"])
                        if p.get("daily_quota_minutes"):
                            bd["daily_quota_minutes"] = int(p["daily_quota_minutes"])
                        if p.get("color"):
                            rc = str(p["color"]).strip()
                            bd["color"] = BREAK_COLOR_MAP.get(_tr_norm(rc), rc if rc.startswith("#") else bd.get("color", "#f59e0b"))
                applied_summaries.append(f"Mola tanımı '{target}' güncellendi.")

            elif a_type == "delete_break_type":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                b_rows = (await db.execute(select(BreakType))).scalars().all()
                mb = next((b for b in b_rows if _tr_norm(b.name) == nt or str(b.id) == target), None)
                if mb:
                    deleted_db_records["breaks"].append({
                        "name": mb.name,
                        "max_duration_minutes": mb.max_duration_minutes,
                        "daily_quota_minutes": mb.daily_quota_minutes,
                        "color": mb.color,
                    })
                    await db.delete(mb)
                settings_db["breaks"] = [
                    b for b in (settings_db.get("breaks", []) or [])
                    if not (isinstance(b, dict) and (_tr_norm(b.get("name")) == nt or str(b.get("id")) == target))
                ]
                applied_summaries.append(f"Mola tanımı '{target}' silindi.")

            # ==============================================================
            # 6. DEPARTMENTS & LOCATIONS
            # ==============================================================
            elif a_type in ("create_department", "create_location"):
                key = "departments" if a_type == "create_department" else "locations"
                label_tr = "Departman" if a_type == "create_department" else "Lokasyon"
                nm = str(p.get("name") or "").strip()
                existing_ids = [int(d.get("id")) for d in (settings_db.get(key, []) or []) if isinstance(d, dict) and str(d.get("id", "")).isdigit()]
                next_id = (max(existing_ids) + 1) if existing_ids else 1
                settings_db.setdefault(key, []).append({"id": next_id, "tenant_id": norm_tenant, "name": nm})
                applied_summaries.append(f"{label_tr} '{nm}' eklendi.")

            elif a_type in ("update_department", "update_location"):
                key = "departments" if a_type == "update_department" else "locations"
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                nn = str(p.get("new_name") or "").strip()
                for d in settings_db.get(key, []) or []:
                    if isinstance(d, dict) and _match_dict_tenant(d, tenant_id) and (_tr_norm(d.get("name")) == nt or str(d.get("id")) == target):
                        if nn:
                            d["name"] = nn
                applied_summaries.append(f"'{target}' -> '{nn}' olarak güncellendi.")

            elif a_type in ("delete_department", "delete_location"):
                key = "departments" if a_type == "delete_department" else "locations"
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db[key] = [
                    d for d in (settings_db.get(key, []) or [])
                    if not (isinstance(d, dict) and _match_dict_tenant(d, tenant_id) and (_tr_norm(d.get("name")) == nt or str(d.get("id")) == target))
                ]
                applied_summaries.append(f"'{target}' kaydı silindi.")

            # ==============================================================
            # 7. SUBSCRIBER GROUPS (int id + extensions=[user.id]) & PICKUP GROUPS
            # ==============================================================
            elif a_type == "create_subscriber_group":
                g_name = str(p.get("name") or "Yeni Abone Grubu").strip()
                mem_exts = [str(m) for m in (p.get("members") or [])]
                user_ids = [batch_ext_to_user_id[e] for e in mem_exts if e in batch_ext_to_user_id]
                existing_ids = [int(g.get("id")) for g in (settings_db.get("subscriber_groups", []) or []) if isinstance(g, dict) and str(g.get("id", "")).isdigit()]
                next_gid = (max(existing_ids) + 1) if existing_ids else 1
                settings_db.setdefault("subscriber_groups", []).append({
                    "id": next_gid,
                    "tenant_id": norm_tenant,
                    "name": g_name,
                    "extensions": user_ids if user_ids else mem_exts,
                    "members": mem_exts,
                })
                applied_summaries.append(f"Abone grubu '{g_name}' oluşturuldu.")

            elif a_type == "update_subscriber_group":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for g in settings_db.get("subscriber_groups", []) or []:
                    if isinstance(g, dict) and _match_dict_tenant(g, tenant_id) and (_tr_norm(g.get("name")) == nt or str(g.get("id")) == target):
                        if p.get("new_name"):
                            g["name"] = str(p["new_name"]).strip()
                        if p.get("members"):
                            mem_exts = [str(m) for m in p["members"]]
                            uids = [batch_ext_to_user_id[e] for e in mem_exts if e in batch_ext_to_user_id]
                            g["extensions"] = uids if uids else mem_exts
                            g["members"] = mem_exts
                applied_summaries.append(f"Abone grubu '{target}' güncellendi.")

            elif a_type == "delete_subscriber_group":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["subscriber_groups"] = [
                    g for g in (settings_db.get("subscriber_groups", []) or [])
                    if not (isinstance(g, dict) and _match_dict_tenant(g, tenant_id) and (_tr_norm(g.get("name")) == nt or str(g.get("id")) == target))
                ]
                applied_summaries.append(f"Abone grubu '{target}' silindi.")

            elif a_type == "create_pickup_group":
                g_name = str(p.get("name") or "Çağrı Toplama Grubu").strip()
                exts = [str(x) for x in (p.get("members") or p.get("extensions") or [])]
                existing_ids = [int(g.get("id")) for g in (settings_db.get("call_pickup_groups", []) or []) if isinstance(g, dict) and str(g.get("id", "")).isdigit()]
                next_pid = (max(existing_ids) + 1) if existing_ids else 1
                settings_db.setdefault("call_pickup_groups", []).append({
                    "id": next_pid,
                    "tenant_id": norm_tenant,
                    "name": g_name,
                    "extensions": exts,
                })
                applied_summaries.append(f"Çağrı toplama grubu '{g_name}' oluşturuldu.")
                need_asterisk_sync = True

            elif a_type == "update_pickup_group":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for g in settings_db.get("call_pickup_groups", []) or []:
                    if isinstance(g, dict) and _match_dict_tenant(g, tenant_id) and (_tr_norm(g.get("name")) == nt or str(g.get("id")) == target):
                        if p.get("new_name"):
                            g["name"] = str(p["new_name"]).strip()
                        if p.get("members") or p.get("extensions"):
                            g["extensions"] = [str(x) for x in (p.get("members") or p.get("extensions"))]
                applied_summaries.append(f"Çağrı toplama grubu '{target}' güncellendi.")
                need_asterisk_sync = True

            elif a_type == "delete_pickup_group":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["call_pickup_groups"] = [
                    g for g in (settings_db.get("call_pickup_groups", []) or [])
                    if not (isinstance(g, dict) and _match_dict_tenant(g, tenant_id) and (_tr_norm(g.get("name")) == nt or str(g.get("id")) == target))
                ]
                applied_summaries.append(f"Çağrı toplama grubu '{target}' silindi.")
                need_asterisk_sync = True

            # ==============================================================
            # 8. SPEED DIALS (SpeedDialsPanel.js exact schema)
            # ==============================================================
            elif a_type == "create_speed_dial":
                sc = str(p.get("short_code") or "").strip().lstrip("*")
                ln = str(p.get("long_number") or "").strip()
                desc = str(p.get("description") or f"Hızlı Arama {sc}").strip()
                settings_db.setdefault("speed_dials", []).append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": norm_tenant,
                    "short_code": sc,
                    "code": sc,
                    "long_number": ln,
                    "target": ln,
                    "number": ln,
                    "description": desc,
                    "name": desc,
                })
                applied_summaries.append(f"Hızlı arama *{sc} -> {ln} ('{desc}') eklendi.")
                need_asterisk_sync = True

            elif a_type == "update_speed_dial":
                target = str(p.get("target") or "").strip().lstrip("*")
                nt = _tr_norm(target)
                for s in settings_db.get("speed_dials", []) or []:
                    if isinstance(s, dict) and _match_dict_tenant(s, tenant_id) and (
                        _tr_norm(s.get("short_code") or s.get("code")) == nt or _tr_norm(s.get("description") or s.get("name")) == nt
                    ):
                        if p.get("new_name"):
                            s["description"] = str(p["new_name"]).strip()
                            s["name"] = str(p["new_name"]).strip()
                        if p.get("long_number"):
                            s["long_number"] = str(p["long_number"]).strip()
                            s["target"] = str(p["long_number"]).strip()
                            s["number"] = str(p["long_number"]).strip()
                applied_summaries.append(f"Hızlı arama '{target}' güncellendi.")
                need_asterisk_sync = True

            elif a_type == "delete_speed_dial":
                target = str(p.get("target") or "").strip().lstrip("*")
                nt = _tr_norm(target)
                settings_db["speed_dials"] = [
                    s for s in (settings_db.get("speed_dials", []) or [])
                    if not (isinstance(s, dict) and _match_dict_tenant(s, tenant_id) and (_tr_norm(s.get("short_code") or s.get("code")) == nt or _tr_norm(s.get("description") or s.get("name")) == nt))
                ]
                applied_summaries.append(f"Hızlı arama '{target}' silindi.")
                need_asterisk_sync = True

            # ==============================================================
            # 9. SIP TRUNKS
            # ==============================================================
            elif a_type == "create_trunk":
                t_name = str(p.get("name") or "Yeni SIP Trunk").strip()
                host = str(p.get("host") or "").strip()
                uname = str(p.get("username") or "").strip()
                pwd = str(p.get("password") or "").strip()
                port = int(p.get("port") or 5060)
                did = str(p.get("did_number") or "").strip()
                proto = str(p.get("protocol") or "UDP").upper()

                new_tr = Trunk(
                    tenant_id=norm_tenant,
                    trunk_type="SIP",
                    trunk_name=t_name,
                    host=host,
                    username=uname,
                    password=pwd,
                    port=port,
                    did_number=did,
                    protocol=proto,
                )
                db.add(new_tr)
                await db.flush()
                created_db_records["trunks"].append(new_tr.id)

                settings_db.setdefault("trunks", []).append({
                    "id": new_tr.id,
                    "tenant_id": norm_tenant,
                    "trunk_type": "SIP",
                    "trunk_name": t_name,
                    "name": t_name,
                    "host": host,
                    "username": uname,
                    "password": pwd,
                    "port": port,
                    "did_number": did,
                    "protocol": proto,
                })
                applied_summaries.append(f"SIP Dış Hat (Trunk) '{t_name}' ({host}) oluşturuldu.")
                need_asterisk_sync = True

            elif a_type == "update_trunk":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                t_rows = (await db.execute(_apply_tenant_clause(select(Trunk), Trunk, tenant_id))).scalars().all()
                mt = next((t for t in t_rows if _tr_norm(t.trunk_name) == nt or str(t.id) == target), None)
                if mt:
                    modified_db_records["trunks"].append({
                        "id": mt.id, "trunk_name": mt.trunk_name, "host": mt.host,
                        "username": mt.username, "did_number": mt.did_number,
                    })
                    if p.get("new_name"):
                        mt.trunk_name = str(p["new_name"]).strip()
                    if p.get("host"):
                        mt.host = str(p["host"]).strip()
                    if p.get("username"):
                        mt.username = str(p["username"]).strip()
                    if p.get("password"):
                        mt.password = str(p["password"]).strip()
                    if p.get("did_number"):
                        mt.did_number = str(p["did_number"]).strip()
                for td in settings_db.get("trunks", []) or []:
                    if isinstance(td, dict) and _match_dict_tenant(td, tenant_id) and (
                        _tr_norm(td.get("trunk_name") or td.get("name")) == nt or str(td.get("id")) == target
                    ):
                        if p.get("new_name"):
                            td["trunk_name"] = str(p["new_name"]).strip()
                            td["name"] = str(p["new_name"]).strip()
                        if p.get("host"):
                            td["host"] = str(p["host"]).strip()
                        if p.get("did_number"):
                            td["did_number"] = str(p["did_number"]).strip()
                applied_summaries.append(f"SIP Trunk '{target}' güncellendi.")
                need_asterisk_sync = True

            elif a_type == "delete_trunk":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                t_rows = (await db.execute(_apply_tenant_clause(select(Trunk), Trunk, tenant_id))).scalars().all()
                mt = next((t for t in t_rows if _tr_norm(t.trunk_name) == nt or str(t.id) == target), None)
                if mt:
                    deleted_db_records["trunks"].append({
                        "tenant_id": mt.tenant_id, "trunk_type": mt.trunk_type, "trunk_name": mt.trunk_name,
                        "host": mt.host, "username": mt.username, "password": mt.password,
                        "port": mt.port, "did_number": mt.did_number, "protocol": mt.protocol,
                    })
                    await db.delete(mt)
                settings_db["trunks"] = [
                    td for td in (settings_db.get("trunks", []) or [])
                    if not (isinstance(td, dict) and _match_dict_tenant(td, tenant_id) and (_tr_norm(td.get("trunk_name") or td.get("name")) == nt or str(td.get("id")) == target))
                ]
                applied_summaries.append(f"SIP Trunk '{target}' silindi.")
                need_asterisk_sync = True

            # ==============================================================
            # 10. INBOUND DID RULES (InboundRulesPanel.js exact schema!)
            # ==============================================================
            elif a_type == "create_inbound_rule":
                did = str(p.get("did_number") or "").strip()
                r_name = str(p.get("name") or (f"DID {did}" if did else "Genel Gelen Kuralı")).strip()
                d_type = str(p.get("destination_type") or "queue").lower()
                d_target = str(p.get("destination_target") or "").strip()

                # Resolve destination_id to exact UI entity ID (queue.id / user.id / workflow.id)
                dest_id: Any = d_target
                if d_type == "queue":
                    if d_target in batch_queue_ext_to_id:
                        dest_id = batch_queue_ext_to_id[d_target]
                    elif _tr_norm(d_target) in batch_queue_name_to_id:
                        dest_id = batch_queue_name_to_id[_tr_norm(d_target)]
                    else:
                        for qd in settings_db.get("queues", []) or []:
                            if isinstance(qd, dict) and (str(qd.get("extension")) == d_target or _tr_norm(qd.get("name")) == _tr_norm(d_target)):
                                dest_id = qd.get("id")
                                break
                elif d_type == "user":
                    if d_target in batch_ext_to_user_id:
                        dest_id = batch_ext_to_user_id[d_target]
                elif d_type == "call_flow":
                    if _tr_norm(d_target) in batch_flow_name_to_id:
                        dest_id = batch_flow_name_to_id[_tr_norm(d_target)]
                    else:
                        for wf in settings_db.get("workflows", []) or []:
                            if isinstance(wf, dict) and (_tr_norm(wf.get("name")) == _tr_norm(d_target) or str(wf.get("id")) == d_target):
                                dest_id = wf.get("id")
                                break

                default_trunks = [int(t["id"]) for t in ctx.get("trunks", []) if str(t.get("id", "")).isdigit()]
                settings_db.setdefault("inbound_rules", []).append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": norm_tenant,
                    "name": r_name,
                    "trunk_ids": default_trunks,
                    "allowed_users": [],
                    "destination_type": d_type,
                    "destination_id": dest_id,
                    "destination_target": d_target,
                    "did_match_mode": "specific" if did else "all",
                    "did_patterns": [did] if did else [],
                    "did_number": did,
                })
                applied_summaries.append(f"Gelen arama kuralı '{r_name}' ({did or 'Tüm DID'}) -> {d_type}:{d_target} oluşturuldu.")
                need_asterisk_sync = True

            elif a_type == "update_inbound_rule":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for r in settings_db.get("inbound_rules", []) or []:
                    if isinstance(r, dict) and _match_dict_tenant(r, tenant_id) and (
                        _tr_norm(r.get("name")) == nt or _tr_norm(r.get("did_number")) == nt or target in (r.get("did_patterns") or [])
                    ):
                        if p.get("new_name"):
                            r["name"] = str(p["new_name"]).strip()
                        if p.get("destination_type"):
                            r["destination_type"] = str(p["destination_type"]).strip()
                        if p.get("destination_target"):
                            r["destination_target"] = str(p["destination_target"]).strip()
                applied_summaries.append(f"Gelen arama kuralı '{target}' güncellendi.")
                need_asterisk_sync = True

            elif a_type == "delete_inbound_rule":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["inbound_rules"] = [
                    r for r in (settings_db.get("inbound_rules", []) or [])
                    if not (isinstance(r, dict) and _match_dict_tenant(r, tenant_id) and (_tr_norm(r.get("name")) == nt or _tr_norm(r.get("did_number")) == nt or target in (r.get("did_patterns") or [])))
                ]
                applied_summaries.append(f"Gelen arama kuralı '{target}' silindi.")
                need_asterisk_sync = True

            # ==============================================================
            # 11. OUTBOUND RULES (OutboundRulesPanel.js exact schema!)
            # ==============================================================
            elif a_type == "create_outbound_rule":
                r_name = str(p.get("name") or "Giden Arama Kuralı").strip()
                pattern = str(p.get("pattern") or "05XXXXXXXXX").strip()
                strip_n = int(p.get("strip") or 0)
                prepend = str(p.get("prepend") or "").strip()
                cid = str(p.get("caller_id") or "").strip()
                default_trunks = [int(t["id"]) for t in ctx.get("trunks", []) if str(t.get("id", "")).isdigit()]
                allowed_exts = [str(x) for x in (p.get("allowed_extensions") or [])]
                allowed_uids = [batch_ext_to_user_id[e] for e in allowed_exts if e in batch_ext_to_user_id]

                settings_db.setdefault("outbound_rules", []).append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": norm_tenant,
                    "name": r_name,
                    "caller_id": cid,
                    "patterns": [{"pattern": pattern, "strip": strip_n, "prepend": prepend}],
                    "trunk_ids": default_trunks,
                    "allowed_users": allowed_uids,
                })
                applied_summaries.append(f"Giden arama kuralı '{r_name}' ({pattern}) oluşturuldu.")
                need_asterisk_sync = True

            elif a_type == "update_outbound_rule":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for r in settings_db.get("outbound_rules", []) or []:
                    if isinstance(r, dict) and _match_dict_tenant(r, tenant_id) and (_tr_norm(r.get("name")) == nt or str(r.get("id")) == target):
                        if p.get("new_name"):
                            r["name"] = str(p["new_name"]).strip()
                        if p.get("caller_id"):
                            r["caller_id"] = str(p["caller_id"]).strip()
                        if p.get("pattern"):
                            r["patterns"] = [{"pattern": str(p["pattern"]).strip(), "strip": int(p.get("strip") or 0), "prepend": str(p.get("prepend") or "")}]
                applied_summaries.append(f"Giden arama kuralı '{target}' güncellendi.")
                need_asterisk_sync = True

            elif a_type == "delete_outbound_rule":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["outbound_rules"] = [
                    r for r in (settings_db.get("outbound_rules", []) or [])
                    if not (isinstance(r, dict) and _match_dict_tenant(r, tenant_id) and (_tr_norm(r.get("name")) == nt or str(r.get("id")) == target))
                ]
                applied_summaries.append(f"Giden arama kuralı '{target}' silindi.")
                need_asterisk_sync = True

            # ==============================================================
            # 12. TTS ANNOUNCEMENTS (AnnouncementsPanel.js + real audio synthesis)
            # ==============================================================
            elif a_type == "create_tts_announcement":
                ann_name = str(p.get("name") or "AI Sesli Anons").strip()
                ann_text = str(p.get("text") or "").strip()
                ann_type = "moh" if str(p.get("type") or "").lower() == "moh" else "announcement"
                voice = str(p.get("voice") or "tr-TR-EmelNeural").strip()
                tts_prov = "edge_tts" if "neural" in voice.lower() else "google"
                ann_id = str(uuid.uuid4())
                os.makedirs("uploads/announcements", exist_ok=True)

                audio_bytes = b""
                try:
                    audio_bytes = await _synthesize_announcement_tts_async(
                        text=ann_text,
                        voice=voice,
                        tts_provider=tts_prov,
                        target_tenant=norm_tenant,
                    )
                except Exception as tts_err:
                    print(f"[AI Config Assistant TTS Fallback]: {tts_err}")

                if not audio_bytes:
                    audio_bytes = _make_silent_wav_bytes(1.5)

                is_wav = audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE"
                ext_sfx = ".wav" if is_wav else ".mp3"
                fname = f"{ann_id}{ext_sfx}"
                fpath = os.path.join("uploads/announcements", fname)
                with open(fpath, "wb") as af:
                    af.write(audio_bytes)
                created_db_records["tts_files"].append(fpath)

                try:
                    _convert_and_sync_announcement_wav(fpath, ann_id)
                except Exception:
                    pass
                dur_sec = _calc_audio_duration_seconds(fpath) or 2.0
                now_ts = datetime.datetime.now().timestamp()

                ann_obj = {
                    "id": ann_id,
                    "tenant_id": norm_tenant,
                    "name": ann_name,
                    "filename": fname,
                    "original_filename": f"{ann_name}{ext_sfx}",
                    "type": ann_type,
                    "text": ann_text,
                    "voice": voice,
                    "tts_provider": tts_prov,
                    "tone": "normal",
                    "speaking_rate": 1.0,
                    "tts_engine_v2": True,
                    "duration": dur_sec,
                    "duration_formatted": _format_duration_mmss(dur_sec),
                    "created_at": now_ts,
                    "updated_at": now_ts,
                }
                settings_db.setdefault("announcements", []).append(ann_obj)
                batch_ann_name_to_id[_tr_norm(ann_name)] = ann_id
                applied_summaries.append(f"AI Sesli Anons (TTS) '{ann_name}' seslendirilip kaydedildi.")

            elif a_type == "update_announcement":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for a in settings_db.get("announcements", []) or []:
                    if isinstance(a, dict) and _match_dict_tenant(a, tenant_id) and (_tr_norm(a.get("name")) == nt or str(a.get("id")) == target):
                        if p.get("new_name"):
                            a["name"] = str(p["new_name"]).strip()
                        if p.get("type") in ("announcement", "moh"):
                            a["type"] = p["type"]
                applied_summaries.append(f"Sesli anons '{target}' güncellendi.")

            elif a_type == "delete_announcement":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["announcements"] = [
                    a for a in (settings_db.get("announcements", []) or [])
                    if not (isinstance(a, dict) and _match_dict_tenant(a, tenant_id) and (_tr_norm(a.get("name")) == nt or str(a.get("id")) == target))
                ]
                applied_summaries.append(f"Sesli anons '{target}' silindi.")

            # ==============================================================
            # 13. VISUAL CALL FLOW / IVR (CallFlowEditor.js exact schema!)
            # ==============================================================
            elif a_type == "create_call_flow":
                wf_id = f"wf-{int(datetime.datetime.utcnow().timestamp() * 1000)}-{uuid.uuid4().hex[:4]}"
                wf_name = str(p.get("name") or "Ana Karşılama Akışı").strip()
                did_num = str(p.get("did_number") or "").strip()
                w_start = str(p.get("work_hours_start") or "09:00").strip()
                w_end = str(p.get("work_hours_end") or "18:00").strip()
                w_ann_ref = str(p.get("welcome_announcement") or "").strip()

                w_ann_id = batch_ann_name_to_id.get(_tr_norm(w_ann_ref), "")
                if not w_ann_id and batch_ann_name_to_id:
                    w_ann_id = list(batch_ann_name_to_id.values())[-1]
                elif not w_ann_id and w_ann_ref:
                    for a in settings_db.get("announcements", []) or []:
                        if isinstance(a, dict) and _tr_norm(a.get("name")) == _tr_norm(w_ann_ref):
                            w_ann_id = str(a.get("id") or "")
                            break

                raw_routes = p.get("menu_routes") or {}
                resolved_routes: Dict[str, Dict[str, Any]] = {}
                if isinstance(raw_routes, dict):
                    for digit, raw_dest in raw_routes.items():
                        d_clean = _clean_entity_ref(str(raw_dest))
                        nd = _tr_norm(d_clean)
                        q_ext_found = ""
                        for qd in settings_db.get("queues", []) or []:
                            if isinstance(qd, dict) and (_tr_norm(qd.get("name")) == nd or str(qd.get("extension")) == d_clean or (len(nd) >= 3 and nd in _tr_norm(qd.get("name")))):
                                q_ext_found = str(qd.get("extension") or "")
                                d_clean = qd.get("name") or d_clean
                                break
                        if q_ext_found:
                            resolved_routes[str(digit)] = {"type": "queue", "target": q_ext_found, "extension": q_ext_found, "label": d_clean}
                        else:
                            resolved_routes[str(digit)] = {"type": "extension" if d_clean.isdigit() else "queue", "target": d_clean, "extension": d_clean, "label": d_clean}

                nodes, conns = _build_visual_call_flow_graph(
                    name=wf_name,
                    did_number=did_num,
                    work_start=w_start,
                    work_end=w_end,
                    welcome_ann_id=w_ann_id,
                    welcome_ann_name=w_ann_ref or "Karşılama Anonsu",
                    menu_routes=resolved_routes,
                )
                trunk_id_default = ctx["trunks"][0]["id"] if ctx.get("trunks") else None
                settings_db.setdefault("workflows", []).append({
                    "id": wf_id,
                    "tenant_id": norm_tenant,
                    "name": wf_name,
                    "trunk_id": trunk_id_default,
                    "status": "active",
                    "nodes": nodes,
                    "connections": conns,
                })
                batch_flow_name_to_id[_tr_norm(wf_name)] = wf_id
                applied_summaries.append(f"Görsel Arama Akışı (IVR) '{wf_name}' ({len(nodes)} düğüm) oluşturuldu.")
                need_asterisk_sync = True

            elif a_type == "update_call_flow":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for wf in settings_db.get("workflows", []) or []:
                    if isinstance(wf, dict) and _match_dict_tenant(wf, tenant_id) and (_tr_norm(wf.get("name")) == nt or str(wf.get("id")) == target):
                        if p.get("new_name"):
                            wf["name"] = str(p["new_name"]).strip()
                        if p.get("status") in ("active", "draft"):
                            wf["status"] = p["status"]
                applied_summaries.append(f"Arama akışı '{target}' güncellendi.")
                need_asterisk_sync = True

            elif a_type == "delete_call_flow":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["workflows"] = [
                    wf for wf in (settings_db.get("workflows", []) or [])
                    if not (isinstance(wf, dict) and _match_dict_tenant(wf, tenant_id) and (_tr_norm(wf.get("name")) == nt or str(wf.get("id")) == target))
                ]
                applied_summaries.append(f"Arama akışı '{target}' silindi.")
                need_asterisk_sync = True

            # ==============================================================
            # 14. NUMBERING PLAN
            # ==============================================================
            elif a_type == "update_numbering_plan":
                np_cur = dict(settings_db.get("numbering_plan") or {})
                for rk in ("extension_range", "queue_range", "conference_range", "speed_dial_range"):
                    if isinstance(p.get(rk), dict):
                        np_cur[rk] = {"start": int(p[rk]["start"]), "end": int(p[rk]["end"])}
                if isinstance(p.get("prefixes"), dict):
                    prefs = dict(np_cur.get("prefixes") or {})
                    prefs.update(p["prefixes"])
                    np_cur["prefixes"] = prefs
                settings_db["numbering_plan"] = np_cur
                applied_summaries.append("Santral numara planı ve prefix aralıkları güncellendi.")
                need_asterisk_sync = True

            # ==============================================================
            # 15. CONTACTS (KURUMSAL REHBER)
            # ==============================================================
            elif a_type == "create_contact":
                fn = str(p.get("first_name") or "").strip()
                ln = str(p.get("last_name") or "").strip()
                ph = str(p.get("phone_number") or "").strip()
                em = str(p.get("email") or "").strip()
                comp = str(p.get("company") or "").strip()
                notes = str(p.get("notes") or "").strip()
                vip = bool(p.get("is_vip", False))

                new_c = Contact(
                    tenant_id=norm_tenant,
                    first_name=fn,
                    last_name=ln,
                    phone_number=ph,
                    email=em or None,
                    company=comp or None,
                    notes=notes or None,
                    is_vip=vip,
                )
                db.add(new_c)
                await db.flush()
                created_db_records["contacts"].append(new_c.id)
                settings_db.setdefault("contacts", []).append({
                    "id": new_c.id,
                    "tenant_id": norm_tenant,
                    "first_name": fn,
                    "last_name": ln,
                    "phone_number": ph,
                    "email": em,
                    "company": comp,
                    "is_vip": vip,
                })
                applied_summaries.append(f"Kurumsal rehbere '{fn} {ln}' ({ph}) kaydedildi.")

            elif a_type == "update_contact":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                c_rows = (await db.execute(select(Contact))).scalars().all()
                mc = next(
                    (c for c in c_rows if _tr_norm(f"{c.first_name or ''} {c.last_name or ''}") == nt or _tr_norm(c.phone_number) == nt or str(c.id) == target),
                    None,
                )
                if mc:
                    modified_db_records["contacts"].append({
                        "id": mc.id, "first_name": mc.first_name, "last_name": mc.last_name,
                        "phone_number": mc.phone_number, "company": mc.company, "is_vip": mc.is_vip,
                    })
                    if p.get("new_name"):
                        pts = str(p["new_name"]).strip().split(None, 1)
                        mc.first_name = pts[0]
                        mc.last_name = pts[1] if len(pts) > 1 else ""
                    if p.get("first_name"):
                        mc.first_name = str(p["first_name"]).strip()
                    if p.get("last_name"):
                        mc.last_name = str(p["last_name"]).strip()
                    if p.get("phone_number"):
                        mc.phone_number = str(p["phone_number"]).strip()
                    if p.get("company"):
                        mc.company = str(p["company"]).strip()
                    if "is_vip" in p and p["is_vip"] is not None:
                        mc.is_vip = bool(p["is_vip"])
                applied_summaries.append(f"Rehber kişisi '{target}' güncellendi.")

            elif a_type == "delete_contact":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                c_rows = (await db.execute(select(Contact))).scalars().all()
                mc = next(
                    (c for c in c_rows if _tr_norm(f"{c.first_name or ''} {c.last_name or ''}") == nt or _tr_norm(c.phone_number) == nt or str(c.id) == target),
                    None,
                )
                if mc:
                    deleted_db_records["contacts"].append({
                        "tenant_id": mc.tenant_id, "first_name": mc.first_name, "last_name": mc.last_name,
                        "phone_number": mc.phone_number, "email": mc.email, "company": mc.company, "is_vip": mc.is_vip,
                    })
                    await db.delete(mc)
                applied_summaries.append(f"Rehberden '{target}' silindi.")

            # ==============================================================
            # 16. CANNED RESPONSES
            # ==============================================================
            elif a_type == "create_canned_response":
                sc = str(p.get("shortcut") or "bilgi").strip().lstrip("/").lower()
                title = str(p.get("title") or sc.capitalize()).strip()
                content = str(p.get("content") or "").strip()
                new_cr = CannedResponse(shortcut=sc, title=title, content=content, category=str(p.get("category") or "Genel"))
                db.add(new_cr)
                await db.flush()
                created_db_records["canned_responses"].append(new_cr.id)
                applied_summaries.append(f"Hızlı cevap şablonu '/{sc}' ('{title}') oluşturuldu.")

            elif a_type == "update_canned_response":
                target = str(p.get("target") or "").strip().lstrip("/")
                nt = _tr_norm(target)
                crs = (await db.execute(select(CannedResponse))).scalars().all()
                mcr = next((c for c in crs if _tr_norm(c.shortcut) == nt or _tr_norm(c.title) == nt or str(c.id) == target), None)
                if mcr:
                    modified_db_records["canned_responses"].append({"id": mcr.id, "shortcut": mcr.shortcut, "title": mcr.title, "content": mcr.content})
                    if p.get("title") or p.get("new_name"):
                        mcr.title = str(p.get("title") or p.get("new_name")).strip()
                    if p.get("content"):
                        mcr.content = str(p["content"]).strip()
                applied_summaries.append(f"Hızlı cevap şablonu '/{target}' güncellendi.")

            elif a_type == "delete_canned_response":
                target = str(p.get("target") or "").strip().lstrip("/")
                nt = _tr_norm(target)
                crs = (await db.execute(select(CannedResponse))).scalars().all()
                mcr = next((c for c in crs if _tr_norm(c.shortcut) == nt or _tr_norm(c.title) == nt or str(c.id) == target), None)
                if mcr:
                    deleted_db_records["canned_responses"].append({"shortcut": mcr.shortcut, "title": mcr.title, "content": mcr.content, "category": mcr.category})
                    await db.delete(mcr)
                applied_summaries.append(f"Hızlı cevap şablonu '/{target}' silindi.")

            # ==============================================================
            # 17. BLACKLIST & BLOCK WORDS
            # ==============================================================
            elif a_type == "add_blacklist":
                val = str(p.get("value") or p.get("target") or "").strip()
                reason = str(p.get("reason") or "AI Konfigürasyon Asistanı ile engellendi").strip()
                new_bl = BlacklistItem(value=val, type="email" if "@" in val else "phone", reason=reason)
                db.add(new_bl)
                await db.flush()
                created_db_records["blacklist"].append(new_bl.id)
                settings_db.setdefault("blacklist", []).append({
                    "id": new_bl.id, "tenant_id": norm_tenant, "value": val, "reason": reason,
                })
                applied_summaries.append(f"Kara listeye '{val}' eklendi.")

            elif a_type == "remove_blacklist":
                val = str(p.get("target") or p.get("value") or "").strip()
                bls = (await db.execute(select(BlacklistItem))).scalars().all()
                for b in bls:
                    if str(b.value or "").strip() == val:
                        deleted_db_records["blacklist"].append({"value": b.value, "type": b.type, "reason": b.reason})
                        await db.delete(b)
                settings_db["blacklist"] = [
                    x for x in (settings_db.get("blacklist", []) or [])
                    if not (isinstance(x, dict) and str(x.get("value") or "").strip() == val)
                ]
                applied_summaries.append(f"Kara listeden '{val}' kaldırıldı.")

            elif a_type == "add_block_word":
                w = str(p.get("word") or p.get("target") or "").strip().lower()
                cat = str(p.get("category") or "profanity").strip()
                new_bw = BlockWord(word=w, category=cat)
                db.add(new_bw)
                await db.flush()
                created_db_records["block_words"].append(new_bw.id)
                settings_db.setdefault("block_words", []).append({"id": new_bw.id, "tenant_id": norm_tenant, "word": w, "category": cat})
                applied_summaries.append(f"Yasaklı kelime filtresine '{w}' eklendi.")

            elif a_type == "remove_block_word":
                w = str(p.get("target") or p.get("word") or "").strip().lower()
                bws = (await db.execute(select(BlockWord))).scalars().all()
                for bw in bws:
                    if str(bw.word or "").lower() == w:
                        deleted_db_records["block_words"].append({"word": bw.word, "category": bw.category})
                        await db.delete(bw)
                settings_db["block_words"] = [
                    x for x in (settings_db.get("block_words", []) or [])
                    if not (isinstance(x, dict) and str(x.get("word") or "").lower() == w)
                ]
                applied_summaries.append(f"Yasaklı kelimelerden '{w}' kaldırıldı.")

            # ==============================================================
            # 18. KNOWLEDGE BASE (RAG) & AI RULE EDITOR
            # ==============================================================
            elif a_type == "add_kb_text":
                title = str(p.get("title") or "Kurumsal Bilgi Notu").strip()
                content = str(p.get("content") or "").strip()
                if content:
                    res_kb = await index_manual_text(db, title, content, tenant_id=norm_tenant)
                    src_name = f"Manuel Giriş: {title}"
                    created_db_records["rag_sources"].append(src_name)
                    applied_summaries.append(f"Bilgi Bankasına '{title}' ({res_kb.get('chunks_added', 1)} parça) öğretildi.")

            elif a_type == "crawl_kb_url":
                url_val = str(p.get("url") or "").strip()
                if url_val:
                    res_url = await index_website_url(db, url_val, tenant_id=norm_tenant)
                    if res_url.get("status") == "success":
                        created_db_records["rag_sources"].append(url_val)
                        applied_summaries.append(f"Web adresi '{url_val}' taranarak Bilgi Bankasına eklendi.")
                    else:
                        skipped_warnings.append(f"URL taranamadı ({url_val}): {res_url.get('message')}")

            elif a_type == "delete_kb_source":
                target = str(p.get("target") or "").strip()
                await delete_indexed_source(db, target, tenant_id=norm_tenant)
                applied_summaries.append(f"Bilgi Bankası kaynağı '{target}' silindi.")

            elif a_type == "create_ai_rule":
                r_type = str(p.get("rule_type") or "faq").lower()
                kw = str(p.get("trigger_keyword") or "").strip()
                resp = str(p.get("response_text") or "").strip()
                act_tr = str(p.get("action_to_trigger") or "NONE").strip()
                new_rl = Rule(
                    tenant_id=norm_tenant,
                    rule_type=r_type,
                    trigger_keyword=kw,
                    response_text=resp,
                    action_to_trigger=act_tr,
                    is_active=True,
                )
                db.add(new_rl)
                await db.flush()
                created_db_records["rules"].append(new_rl.id)
                await _sync_rules_to_settings(db)
                applied_summaries.append(f"AI Kuralı ({r_type}: '{kw}') eklendi.")

            elif a_type == "update_ai_rule":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                rls = (await db.execute(_apply_tenant_clause(select(Rule), Rule, tenant_id))).scalars().all()
                mrl = next((r for r in rls if _tr_norm(r.trigger_keyword) == nt or str(r.id) == target), None)
                if mrl:
                    modified_db_records["rules"].append({
                        "id": mrl.id, "trigger_keyword": mrl.trigger_keyword,
                        "response_text": mrl.response_text, "action_to_trigger": mrl.action_to_trigger,
                    })
                    if p.get("response_text"):
                        mrl.response_text = str(p["response_text"]).strip()
                    if p.get("action_to_trigger"):
                        mrl.action_to_trigger = str(p["action_to_trigger"]).strip()
                    await _sync_rules_to_settings(db)
                applied_summaries.append(f"AI Kuralı '{target}' güncellendi.")

            elif a_type == "delete_ai_rule":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                rls = (await db.execute(_apply_tenant_clause(select(Rule), Rule, tenant_id))).scalars().all()
                mrl = next((r for r in rls if _tr_norm(r.trigger_keyword) == nt or str(r.id) == target), None)
                if mrl:
                    deleted_db_records["rules"].append({
                        "tenant_id": mrl.tenant_id, "rule_type": mrl.rule_type,
                        "trigger_keyword": mrl.trigger_keyword, "response_text": mrl.response_text,
                        "action_to_trigger": mrl.action_to_trigger,
                    })
                    await db.delete(mrl)
                    await db.flush()
                    await _sync_rules_to_settings(db)
                applied_summaries.append(f"AI Kuralı '{target}' silindi.")

            # ==============================================================
            # 19. QA QUESTIONS
            # ==============================================================
            elif a_type == "create_qa_question":
                q_txt = str(p.get("question") or "").strip()
                m_sc = int(p.get("max_score") or 20)
                new_qa = QAQuestion(question=q_txt, max_score=m_sc, is_active=True)
                db.add(new_qa)
                await db.flush()
                created_db_records["qa_questions"].append(new_qa.id)
                applied_summaries.append(f"Çağrı Kalite (QA) sorusu eklendi ({m_sc} puan): '{q_txt}'.")

            elif a_type == "update_qa_question":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                qas = (await db.execute(select(QAQuestion))).scalars().all()
                mqa = next((q for q in qas if _tr_norm(q.question) == nt or nt in _tr_norm(q.question) or str(q.id) == target), None)
                if mqa:
                    modified_db_records["qa_questions"].append({"id": mqa.id, "question": mqa.question, "max_score": mqa.max_score})
                    if p.get("question") or p.get("new_name"):
                        mqa.question = str(p.get("question") or p.get("new_name")).strip()
                    if p.get("max_score"):
                        mqa.max_score = int(p["max_score"])
                applied_summaries.append(f"QA sorusu '{target}' güncellendi.")

            elif a_type == "delete_qa_question":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                qas = (await db.execute(select(QAQuestion))).scalars().all()
                mqa = next((q for q in qas if _tr_norm(q.question) == nt or nt in _tr_norm(q.question) or str(q.id) == target), None)
                if mqa:
                    deleted_db_records["qa_questions"].append({"question": mqa.question, "max_score": mqa.max_score})
                    await db.delete(mqa)
                applied_summaries.append(f"QA sorusu '{target}' silindi.")

            # ==============================================================
            # 20. DIALER CAMPAIGNS (DialerSettings.js exact schema)
            # ==============================================================
            elif a_type == "create_dialer_campaign":
                c_id = f"camp-{uuid.uuid4().hex[:8]}"
                c_name = str(p.get("name") or "Yeni Dış Arama Kampanyası").strip()
                raw_nums = p.get("numbers") or []
                nums_objs = [
                    {"phone": str(n).strip(), "name": "", "status": "pending", "attempts": 0}
                    for n in raw_nums if str(n).strip()
                ]
                default_ag = ctx["ai_agents"][0]["id"] if ctx.get("ai_agents") else ""
                default_tr = ctx["trunks"][0]["id"] if ctx.get("trunks") else ""
                st = "running" if str(p.get("status") or "").lower() == "running" else "paused"
                settings_db.setdefault("dialer_campaigns", []).append({
                    "id": c_id,
                    "tenant_id": norm_tenant,
                    "name": c_name,
                    "agent_id": str(p.get("agent_target") or default_ag),
                    "trunk_id": p.get("trunk_target") or default_tr,
                    "max_concurrent": int(p.get("max_concurrent") or 2),
                    "retry_count": 2,
                    "retry_interval_sec": 300,
                    "work_hours_start": "09:00",
                    "work_hours_end": "20:00",
                    "status": st,
                    "numbers": nums_objs,
                    "created_at": datetime.datetime.utcnow().isoformat() + "Z",
                })
                applied_summaries.append(f"Dış arama kampanyası '{c_name}' ({len(nums_objs)} numara, durum: {st}) oluşturuldu.")

            elif a_type == "update_dialer_campaign":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for dc in settings_db.get("dialer_campaigns", []) or []:
                    if isinstance(dc, dict) and _match_dict_tenant(dc, tenant_id) and (_tr_norm(dc.get("name")) == nt or str(dc.get("id")) == target):
                        if p.get("new_name"):
                            dc["name"] = str(p["new_name"]).strip()
                        if p.get("status") in ("running", "paused", "completed"):
                            dc["status"] = p["status"]
                        if p.get("add_numbers"):
                            cur_n = list(dc.get("numbers") or [])
                            for n in p["add_numbers"]:
                                cur_n.append({"phone": str(n).strip(), "name": "", "status": "pending", "attempts": 0})
                            dc["numbers"] = cur_n
                applied_summaries.append(f"Dış arama kampanyası '{target}' güncellendi.")

            elif a_type == "delete_dialer_campaign":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["dialer_campaigns"] = [
                    dc for dc in (settings_db.get("dialer_campaigns", []) or [])
                    if not (isinstance(dc, dict) and _match_dict_tenant(dc, tenant_id) and (_tr_norm(dc.get("name")) == nt or str(dc.get("id")) == target))
                ]
                applied_summaries.append(f"Dış arama kampanyası '{target}' silindi.")

            # ==============================================================
            # 21. APPOINTMENTS
            # ==============================================================
            elif a_type == "create_appointment":
                c_nm = str(p.get("customer_name") or "Müşteri").strip()
                c_ph = str(p.get("customer_phone") or "").strip()
                dt_str = str(p.get("date") or "").strip()
                tm_str = str(p.get("time") or "14:00").strip()
                try:
                    if dt_str and "-" in dt_str:
                        ap_dt = datetime.datetime.fromisoformat(f"{dt_str}T{tm_str}:00")
                    elif dt_str and ("." in dt_str or "/" in dt_str):
                        sep = "." if "." in dt_str else "/"
                        d_p, m_p, y_p = dt_str.split(sep)
                        ap_dt = datetime.datetime(int(y_p), int(m_p), int(d_p), int(tm_str.split(":")[0]), int(tm_str.split(":")[1]))
                    else:
                        ap_dt = datetime.datetime.utcnow() + datetime.timedelta(days=1)
                except Exception:
                    ap_dt = datetime.datetime.utcnow() + datetime.timedelta(days=1)

                new_ap = Appointment(
                    tenant_id=norm_tenant,
                    customer_name=c_nm,
                    customer_phone=c_ph,
                    appointment_date=ap_dt,
                    notes=str(p.get("notes") or ""),
                    status="confirmed",
                )
                db.add(new_ap)
                await db.flush()
                created_db_records["appointments"].append(new_ap.id)
                applied_summaries.append(f"'{c_nm}' için randevu ({ap_dt.strftime('%Y-%m-%d %H:%M')}) oluşturuldu.")

            elif a_type == "update_appointment":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                aps = (await db.execute(_apply_tenant_clause(select(Appointment), Appointment, tenant_id))).scalars().all()
                map_row = next((a for a in aps if _tr_norm(a.customer_name) == nt or _tr_norm(a.customer_phone) == nt or str(a.id) == target), None)
                if map_row:
                    modified_db_records["appointments"].append({"id": map_row.id, "status": map_row.status, "notes": map_row.notes})
                    if p.get("status"):
                        map_row.status = str(p["status"]).strip()
                    if p.get("notes"):
                        map_row.notes = str(p["notes"]).strip()
                applied_summaries.append(f"Randevu '{target}' güncellendi.")

            elif a_type == "cancel_appointment":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                aps = (await db.execute(_apply_tenant_clause(select(Appointment), Appointment, tenant_id))).scalars().all()
                map_row = next((a for a in aps if _tr_norm(a.customer_name) == nt or _tr_norm(a.customer_phone) == nt or str(a.id) == target), None)
                if map_row:
                    modified_db_records["appointments"].append({"id": map_row.id, "status": map_row.status})
                    map_row.status = "cancelled"
                applied_summaries.append(f"Randevu '{target}' iptal edildi.")

            # ==============================================================
            # 22. ROLES & PERMISSIONS
            # ==============================================================
            elif a_type == "create_role":
                r_name = str(p.get("name") or "Özel Rol").strip()
                r_code = str(p.get("role_code") or re.sub(r"[^a-z0-9_]", "_", _tr_norm(r_name))).strip("_") or f"role_{uuid.uuid4().hex[:4]}"
                base_perms = list(p.get("add_permissions") or ["dashboard:access", "call_logs:access"])
                new_sr = SystemRole(role_code=r_code, name=r_name, permissions=base_perms, is_system=False)
                db.add(new_sr)
                await db.flush()
                created_db_records["roles"].append(new_sr.id)
                settings_db.setdefault("roles", []).append({
                    "id": new_sr.id, "role_code": r_code, "name": r_name, "permissions": base_perms, "is_system": False,
                })
                applied_summaries.append(f"Yetki rolü '{r_name}' ({r_code}) oluşturuldu.")

            elif a_type == "update_role":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                srs = (await db.execute(select(SystemRole))).scalars().all()
                msr = next((r for r in srs if _tr_norm(r.role_code) == nt or _tr_norm(r.name) == nt), None)
                if msr:
                    cur_p = list(msr.permissions or [])
                    modified_db_records["roles"].append({"id": msr.id, "name": msr.name, "permissions": copy.deepcopy(cur_p)})
                    if p.get("new_name"):
                        msr.name = str(p["new_name"]).strip()
                    for ap_c in p.get("add_permissions") or []:
                        if ap_c not in cur_p:
                            cur_p.append(ap_c)
                    for rp_c in p.get("remove_permissions") or []:
                        cur_p = [x for x in cur_p if x != rp_c]
                    msr.permissions = cur_p
                applied_summaries.append(f"Rol '{target}' yetkileri güncellendi.")

            elif a_type == "delete_role":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                srs = (await db.execute(select(SystemRole))).scalars().all()
                msr = next((r for r in srs if (_tr_norm(r.role_code) == nt or _tr_norm(r.name) == nt) and not r.is_system), None)
                if msr:
                    deleted_db_records["roles"].append({"role_code": msr.role_code, "name": msr.name, "permissions": list(msr.permissions or [])})
                    await db.delete(msr)
                settings_db["roles"] = [
                    r for r in (settings_db.get("roles", []) or [])
                    if not (isinstance(r, dict) and (_tr_norm(r.get("role_code")) == nt or _tr_norm(r.get("name")) == nt) and not r.get("is_system"))
                ]
                applied_summaries.append(f"Rol '{target}' silindi.")

            # ==============================================================
            # 23. SCHEDULED REPORTS
            # ==============================================================
            elif a_type == "create_scheduled_report":
                sr_name = str(p.get("name") or "Zamanlanmış Rapor").strip()
                settings_db.setdefault("scheduled_reports", []).append({
                    "id": f"sched-{uuid.uuid4().hex[:8]}",
                    "tenant_id": norm_tenant,
                    "name": sr_name,
                    "report_type": str(p.get("report_type") or "executive_summary"),
                    "frequency": str(p.get("frequency") or "daily"),
                    "send_time": str(p.get("send_time") or "09:00"),
                    "recipients": list(p.get("recipients") or []),
                    "format": "excel",
                    "enabled": True,
                })
                applied_summaries.append(f"Zamanlanmış rapor '{sr_name}' planlandı.")

            elif a_type == "update_scheduled_report":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                for sr in settings_db.get("scheduled_reports", []) or []:
                    if isinstance(sr, dict) and _match_dict_tenant(sr, tenant_id) and (_tr_norm(sr.get("name")) == nt or str(sr.get("id")) == target):
                        if p.get("new_name"):
                            sr["name"] = str(p["new_name"]).strip()
                        if p.get("send_time"):
                            sr["send_time"] = str(p["send_time"]).strip()
                        if p.get("recipients"):
                            sr["recipients"] = list(p["recipients"])
                applied_summaries.append(f"Zamanlanmış rapor '{target}' güncellendi.")

            elif a_type == "delete_scheduled_report":
                target = str(p.get("target") or "").strip()
                nt = _tr_norm(target)
                settings_db["scheduled_reports"] = [
                    sr for sr in (settings_db.get("scheduled_reports", []) or [])
                    if not (isinstance(sr, dict) and _match_dict_tenant(sr, tenant_id) and (_tr_norm(sr.get("name")) == nt or str(sr.get("id")) == target))
                ]
                applied_summaries.append(f"Zamanlanmış rapor '{target}' silindi.")

            # ==============================================================
            # 24. WHATSAPP CHANNEL & SYSTEM / AI MODULE SETTINGS
            # ==============================================================
            elif a_type == "update_whatsapp_settings":
                ch = dict(settings_db.get("channels") or {})
                if p.get("persona"):
                    ch["whatsapp_persona"] = str(p["persona"]).strip()
                if p.get("work_hours_start"):
                    ch["whatsapp_work_hours_start"] = str(p["work_hours_start"]).strip()
                if p.get("work_hours_end"):
                    ch["whatsapp_work_hours_end"] = str(p["work_hours_end"]).strip()
                if "welcome_menu_enabled" in p and p["welcome_menu_enabled"] is not None:
                    ch["whatsapp_welcome_menu_enabled"] = bool(p["welcome_menu_enabled"])
                if "missed_call_whatsapp_enabled" in p and p["missed_call_whatsapp_enabled"] is not None:
                    ch["missed_call_whatsapp_enabled"] = bool(p["missed_call_whatsapp_enabled"])
                if p.get("after_hours_message"):
                    ch["whatsapp_after_hours_message"] = str(p["after_hours_message"]).strip()
                settings_db["channels"] = ch
                applied_summaries.append("WhatsApp kanal (persona / mesai / karşılama) ayarları güncellendi.")

            elif a_type == "update_pbx_ai_features":
                if "voice_biometrics_enabled" in p and p["voice_biometrics_enabled"] is not None:
                    vb = dict(settings_db.get("voice_biometrics") or {})
                    vb["enabled"] = bool(p["voice_biometrics_enabled"])
                    settings_db["voice_biometrics"] = vb
                if "smart_callback_enabled" in p and p["smart_callback_enabled"] is not None:
                    scb = dict(settings_db.get("smart_callback") or {})
                    scb["enabled"] = bool(p["smart_callback_enabled"])
                    settings_db["smart_callback"] = scb
                if p.get("recording_retention_days"):
                    rr = dict(settings_db.get("recording_retention") or {})
                    rr["retention_days"] = int(p["recording_retention_days"])
                    rr["enabled"] = True
                    settings_db["recording_retention"] = rr
                if "nat_enabled" in p or p.get("extern_ip"):
                    nat_cfg = dict(settings_db.get("nat") or {})
                    if "nat_enabled" in p and p["nat_enabled"] is not None:
                        nat_cfg["enabled"] = bool(p["nat_enabled"])
                    if p.get("extern_ip"):
                        nat_cfg["extern_ip"] = str(p["extern_ip"]).strip()
                    settings_db["nat"] = nat_cfg
                    need_asterisk_sync = True
                applied_summaries.append("Santral & AI modül parametreleri güncellendi.")

            # ==============================================================
            # 25. SECURITY WHITELIST, RESTORE POINT & LIVE AGENT SUPERVISOR
            # ==============================================================
            elif a_type == "add_security_whitelist":
                ip_v = str(p.get("ip_address") or p.get("target") or "").strip()
                wl = list(settings_db.get("security_whitelisted_ips") or [])
                if ip_v and ip_v not in wl:
                    wl.append(ip_v)
                settings_db["security_whitelisted_ips"] = wl
                applied_summaries.append(f"Güvenlik Kalkanı güvenli IP listesine '{ip_v}' eklendi.")

            elif a_type == "remove_security_whitelist":
                ip_v = str(p.get("target") or p.get("ip_address") or "").strip()
                settings_db["security_whitelisted_ips"] = [
                    x for x in (settings_db.get("security_whitelisted_ips") or []) if str(x).strip() != ip_v
                ]
                applied_summaries.append(f"Güvenli IP listesinden '{ip_v}' çıkarıldı.")

            elif a_type == "create_restore_point":
                rp_title = str(p.get("title") or "AI Asistan Yedeği").strip()
                rp_desc = str(p.get("description") or "").strip()
                rp_obj = create_tenant_restore_point(
                    tenant_id=norm_tenant,
                    title=rp_title,
                    description=rp_desc,
                    created_by=user_label or "AI Asistan",
                    is_auto=False,
                    point_type="manual",
                )
                applied_summaries.append(f"Sistem Geri Yükleme Noktası '{rp_obj.get('title')}' oluşturuldu.")

            elif a_type == "set_agent_live_status":
                target = str(p.get("target") or "").strip()
                ext = _resolve_target_in_category(target, "users", ctx)
                st = "ready" if str(p.get("status") or "").lower() in ("ready", "available", "online") else "paused"
                reason = str(p.get("reason") or ("Müsait" if st == "ready" else "Kısa Mola")).strip()
                try:
                    from backend.services.agent_presence import update_agent_state
                    update_agent_state(ext, state=st, reason=reason if st == "paused" else "")
                except Exception:
                    pass
                applied_summaries.append(f"Temsilci {ext} canlı durumu '{st}' ({reason}) olarak güncellendi.")

        await db.commit()

    # Save History & Undo Snapshot entry (compatible with both old & new UI schemas)
    now_tr_str = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
    history_list = settings_db.setdefault("ai_config_snapshots", [])
    snapshot_entry = {
        "id": snapshot_id,
        "tenant_id": norm_tenant,
        "prompt": prompt,
        "created_by": user_label or "admin",
        "applied_by": user_label or "admin",
        "created_at": now_tr_str,
        "applied_at": now_tr_str,
        "reverted": False,
        "undone": False,
        "applied_summaries": applied_summaries,
        "summaries": applied_summaries,
        "pre_settings": pre_snapshot_settings,
        "created_db_records": created_db_records,
        "modified_db_records": modified_db_records,
        "deleted_db_records": deleted_db_records,
    }
    history_list.insert(0, snapshot_entry)
    settings_db["ai_config_snapshots"] = history_list[:25]
    save_settings(settings_db)

    if need_asterisk_sync:
        _sync_asterisk_dialplan_and_endpoints()

    try:
        from backend.main import log_event
        asyncio.create_task(
            log_event(
                user_id=user_label or "admin",
                action="AI_CONFIG_APPLY",
                module="AIConfigAssistant",
                details={"snapshot_id": snapshot_id, "prompt": prompt, "applied_summaries": applied_summaries},
            )
        )
    except Exception:
        pass

    return {
        "status": "success",
        "snapshot_id": snapshot_id,
        "applied_count": len(applied_summaries),
        "applied": [{"summary": s} for s in applied_summaries],
        "summaries": applied_summaries,
        "warnings": skipped_warnings,
    }


# ============================================================================
# 7. HISTORY & LOSSLESS UNDO ENGINE
# ============================================================================

@ai_config_assistant_router.get("/api/ai-config-assistant/history")
async def list_ai_config_history(request: Request):
    """Returns recent AI Configuration Assistant snapshots for Undo/Audit."""
    from backend.main import settings_db

    tenant_id = _extract_tenant_id(request)
    snaps = []
    for s in settings_db.get("ai_config_snapshots", []) or []:
        if not isinstance(s, dict) or not _match_dict_tenant(s, tenant_id):
            continue
        is_rev = bool(s.get("reverted") or s.get("undone") or False)
        rev_at = s.get("reverted_at") or s.get("undone_at")
        sums = s.get("applied_summaries") or s.get("summaries") or []
        snaps.append({
            "id": s.get("id"),
            "prompt": s.get("prompt"),
            "created_by": s.get("created_by") or s.get("applied_by") or "admin",
            "applied_by": s.get("applied_by") or s.get("created_by") or "admin",
            "created_at": s.get("created_at") or s.get("applied_at") or "",
            "applied_at": s.get("applied_at") or s.get("created_at") or "",
            "reverted": is_rev,
            "undone": is_rev,
            "reverted_at": rev_at,
            "undone_at": rev_at,
            "applied_summaries": sums,
            "summaries": sums,
        })
    return {"status": "ok", "history": snaps[:20]}


@ai_config_assistant_router.post("/api/ai-config-assistant/undo/{snapshot_id}")
async def undo_ai_configuration_snapshot(snapshot_id: str, request: Request):
    """Rolls back a previously applied AI Configuration Assistant plan across PostgreSQL, settings_db, and Asterisk."""
    from backend.main import _sync_rules_to_settings, log_event, save_settings, settings_db
    from backend.services.rag_service import delete_indexed_source

    tenant_id = _extract_tenant_id(request)
    norm_tenant = "tenant-default" if _is_default_tenant(tenant_id) else tenant_id
    user_label, _role_code, is_admin, user_perms = await _resolve_request_user_permissions(request, tenant_id)
    if not (
        is_admin
        or "*" in user_perms
        or _has_perm(is_admin, user_perms, "ai_config_assistant:write")
        or _has_perm(is_admin, user_perms, "restore_points:write")
    ):
        raise HTTPException(status_code=403, detail="Yapılandırma geri alma (Undo) yetkiniz bulunmuyor.")

    snaps = settings_db.get("ai_config_snapshots", []) or []
    target = next((s for s in snaps if isinstance(s, dict) and s.get("id") == snapshot_id and _match_dict_tenant(s, tenant_id)), None)
    if not target:
        raise HTTPException(status_code=404, detail="Geri alınacak işlem kaydı bulunamadı.")
    if target.get("reverted") or target.get("undone"):
        raise HTTPException(status_code=400, detail="Bu işlem zaten daha önce geri alınmış.")

    # Support both new `pre_settings` and legacy `pre_settings_snapshot` keys
    pre_settings = target.get("pre_settings") or target.get("pre_settings_snapshot") or {}
    for k, val in pre_settings.items():
        settings_db[k] = copy.deepcopy(val)

    created_db = target.get("created_db_records") or target.get("created_db_ids") or {}
    modified_db = target.get("modified_db_records") or {}
    deleted_db = target.get("deleted_db_records") or {}

    for fp in created_db.get("tts_files") or []:
        if fp and os.path.exists(fp):
            try:
                os.remove(fp)
            except Exception:
                pass

    async with AsyncSessionLocal() as db:
        model_map = [
            ("users", SystemUser),
            ("queues", PBXQueue),
            ("blacklist", BlacklistItem),
            ("block_words", BlockWord),
            ("breaks", BreakType),
            ("trunks", Trunk),
            ("contacts", Contact),
            ("canned_responses", CannedResponse),
            ("rules", Rule),
            ("qa_questions", QAQuestion),
            ("appointments", Appointment),
            ("roles", SystemRole),
        ]
        for key, mdl in model_map:
            ids = created_db.get(key) or []
            if ids:
                await db.execute(delete(mdl).where(mdl.id.in_(ids)))

        for rag_src in created_db.get("rag_sources") or []:
            try:
                await delete_indexed_source(db, rag_src, tenant_id=norm_tenant)
            except Exception:
                pass

        for key, mdl in model_map:
            for snap_row in modified_db.get(key) or []:
                row_id = snap_row.get("id")
                if not row_id:
                    continue
                obj = (await db.execute(select(mdl).where(mdl.id == row_id))).scalars().first()
                if obj:
                    for col_k, col_v in snap_row.items():
                        if col_k != "id" and hasattr(obj, col_k):
                            setattr(obj, col_k, col_v)

        for key, mdl in model_map:
            for d_row in deleted_db.get(key) or []:
                db.add(mdl(**d_row))

        if created_db.get("rules") or modified_db.get("rules") or deleted_db.get("rules"):
            await db.flush()
            await _sync_rules_to_settings(db)

        await db.commit()

    rev_ts = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
    target["reverted"] = True
    target["undone"] = True
    target["reverted_at"] = rev_ts
    target["undone_at"] = rev_ts
    target["undone_by"] = user_label or "admin"
    save_settings(settings_db)

    _sync_asterisk_dialplan_and_endpoints()

    try:
        asyncio.create_task(
            log_event(
                user_id=user_label or "admin",
                action="AI_CONFIG_UNDO",
                module="AIConfigAssistant",
                details={"summary": f"AI Konfigürasyon paketi geri alındı ({snapshot_id})", "prompt": target.get("prompt")},
            )
        )
    except Exception:
        pass

    return {"status": "success", "snapshot_id": snapshot_id, "reverted_at": rev_ts, "message": "Yapılandırma değişiklikleri eksiksiz olarak geri alındı."}
