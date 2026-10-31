import asyncio
import copy
import datetime
import json
import re
import subprocess
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Body, HTTPException, Request
from sqlalchemy import delete, or_, select

from backend.database.config import AsyncSessionLocal
from backend.database.models import (
    AIAgent,
    AgentBreakLog,
    Appointment,
    BlacklistItem,
    BreakType,
    Call,
    ChatSession,
    EventLog,
    PBXQueue,
    QueueSurveyResponse,
    SystemUser,
    Trunk,
    VoipQualityLog,
)
from backend.services.advanced_reports_service import (
    _apply_tenant_clause,
    _call_talk_sec,
    _call_wait_sec,
    _extract_tenant_id,
    _is_answered_call,
    _is_default_tenant,
    _is_global_tenant,
    _match_dict_tenant,
    _parse_tr_date_range,
)

ai_copilot_router = APIRouter()

TR_WEEKDAYS = [
    "1 - Pazartesi",
    "2 - Salı",
    "3 - Çarşamba",
    "4 - Perşembe",
    "5 - Cuma",
    "6 - Cumartesi",
    "7 - Pazar",
]


def _to_tr_dt(dt_val: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    if not dt_val:
        return None
    return dt_val + datetime.timedelta(hours=3)


def _tr_weekday_label(tr_dt: Optional[datetime.datetime]) -> str:
    if not tr_dt:
        return "-"
    idx = tr_dt.weekday()
    return TR_WEEKDAYS[idx] if 0 <= idx < 7 else "-"


def _last10_digits(num: Any) -> str:
    digits = re.sub(r"\D", "", str(num or ""))
    return digits[-10:] if len(digits) >= 10 else digits


# ============================================================================
# 1. CUSTOM REPORT BUILDER METADATA & SAFE QUERY ENGINE (9 DATASETS)
# ============================================================================

CUSTOM_REPORT_DATASETS: Dict[str, Dict[str, Any]] = {
    "calls": {
        "id": "calls",
        "label": "Çağrı Kayıtları & Performans (CDR & AI)",
        "description": "Gelen, giden ve dahili tüm telefon görüşmeleri, SLA, FCR, bekleme/konuşma süreleri, duygu analizi ve QA puanları.",
        "default_group_by": "agent",
        "default_metrics": [
            "total_calls",
            "answered_calls",
            "missed_calls",
            "answer_rate_pct",
            "sla_20s_pct",
            "total_talk_min",
            "avg_talk_sec",
        ],
        "dimensions": [
            {"id": "agent", "label": "Temsilci / Dahili Bazlı"},
            {"id": "department", "label": "Departman Bazlı"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
            {"id": "weekday", "label": "Haftanın Günü Bazlı (Pzt - Paz)"},
            {"id": "hour", "label": "Saat Dilimi Bazlı (00:00 - 23:00)"},
            {"id": "trunk_name", "label": "SIP Dış Hat / Trunk Bazlı"},
            {"id": "callee_did", "label": "Aranan Numara / DID Bazlı"},
            {"id": "direction", "label": "Çağrı Yönü Bazlı (Gelen / Giden / Dahili)"},
            {"id": "status", "label": "Çağrı Durumu Bazlı"},
            {"id": "sentiment", "label": "Müşteri Duygu Durumu Bazlı"},
            {"id": "topic", "label": "Konu / Sonuç Kodu Bazlı"},
            {"id": "hangup_source", "label": "Kapanış / Aktarım Kaynağı Bazlı"},
        ],
        "metrics": [
            {"id": "total_calls", "label": "Toplam Çağrı Adedi", "unit": "adet"},
            {"id": "answered_calls", "label": "Cevaplanan Çağrı Adedi", "unit": "adet"},
            {"id": "missed_calls", "label": "Kaçan / Cevapsız Çağrı Adedi", "unit": "adet"},
            {"id": "answer_rate_pct", "label": "Cevaplanma Oranı (%)", "unit": "%"},
            {"id": "sla_20s_pct", "label": "SLA Oranı ≤20 sn (%)", "unit": "%"},
            {"id": "fcr_pct", "label": "İlk Aramada Çözüm / FCR (%)", "unit": "%"},
            {"id": "total_talk_min", "label": "Toplam Konuşma Süresi (dk)", "unit": "dk"},
            {"id": "avg_talk_sec", "label": "Ortalama Konuşma Süresi (sn)", "unit": "sn"},
            {"id": "avg_wait_sec", "label": "Ortalama Bekleme Süresi (sn)", "unit": "sn"},
            {"id": "max_wait_sec", "label": "En Uzun Bekleme Süresi (sn)", "unit": "sn"},
            {"id": "avg_qa_score", "label": "Ortalama Kalite (QA) Puanı", "unit": "puan"},
            {"id": "positive_count", "label": "Olumlu Duygu Adedi", "unit": "adet"},
            {"id": "negative_count", "label": "Olumsuz / Kızgın Duygu Adedi", "unit": "adet"},
            {"id": "recorded_calls", "label": "Ses Kayıtlı Çağrı Adedi", "unit": "adet"},
            {"id": "unique_callers", "label": "Tekil Arayan Numara Sayısı", "unit": "kişi"},
        ],
        "filter_fields": [
            {"id": "agent", "label": "Temsilci Adı / Dahili", "type": "text"},
            {"id": "department", "label": "Departman", "type": "text"},
            {"id": "direction", "label": "Çağrı Yönü (Gelen / Giden / Dahili)", "type": "text"},
            {"id": "status", "label": "Çağrı Durumu (Cevaplandı / Cevapsız)", "type": "text"},
            {"id": "sentiment", "label": "Duygu Durumu (Olumlu / Nötr / Olumsuz)", "type": "text"},
            {"id": "trunk_name", "label": "SIP Trunk Adı", "type": "text"},
            {"id": "caller_number", "label": "Arayan Numara", "type": "text"},
            {"id": "callee_number", "label": "Aranan Numara / DID", "type": "text"},
            {"id": "talk_sec", "label": "Konuşma Süresi (sn)", "type": "number"},
            {"id": "wait_sec", "label": "Bekleme Süresi (sn)", "type": "number"},
            {"id": "qa_score", "label": "QA Kalite Puanı", "type": "number"},
        ],
    },
    "queues": {
        "id": "queues",
        "label": "ACD Kuyruk & SLA Performansı",
        "description": "Çağrı kuyruklarına giren, cevaplanan, terk edilen çağrılar, 20 sn SLA yüzdeleri ve kuyruk bekleme süreleri.",
        "default_group_by": "queue_name",
        "default_metrics": [
            "total_calls",
            "answered_calls",
            "abandoned_calls",
            "answer_rate_pct",
            "sla_20s_pct",
            "avg_wait_sec",
        ],
        "dimensions": [
            {"id": "queue_name", "label": "Kuyruk Adı / Numarası Bazlı"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
            {"id": "hour", "label": "Saat Dilimi Bazlı"},
            {"id": "status", "label": "Çağrı Sonucu Bazlı"},
        ],
        "metrics": [
            {"id": "total_calls", "label": "Kuyruğa Giren Çağrı", "unit": "adet"},
            {"id": "answered_calls", "label": "Cevaplanan Çağrı", "unit": "adet"},
            {"id": "abandoned_calls", "label": "Kuyrukta Terk Edilen Çağrı", "unit": "adet"},
            {"id": "answer_rate_pct", "label": "Kuyruk Cevaplama Oranı (%)", "unit": "%"},
            {"id": "sla_20s_pct", "label": "Kuyruk SLA Oranı ≤20 sn (%)", "unit": "%"},
            {"id": "avg_wait_sec", "label": "Ortalama Bekleme Süresi (sn)", "unit": "sn"},
            {"id": "max_wait_sec", "label": "Maksimum Bekleme Süresi (sn)", "unit": "sn"},
            {"id": "avg_talk_sec", "label": "Ortalama Görüşme Süresi (sn)", "unit": "sn"},
        ],
        "filter_fields": [
            {"id": "queue_name", "label": "Kuyruk Adı / Dahili", "type": "text"},
            {"id": "status", "label": "Durum (Cevaplandı / Terk Edildi)", "type": "text"},
            {"id": "wait_sec", "label": "Bekleme Süresi (sn)", "type": "number"},
            {"id": "talk_sec", "label": "Konuşma Süresi (sn)", "type": "number"},
        ],
    },
    "breaks": {
        "id": "breaks",
        "label": "Mola & Puantaj Kayıtları",
        "description": "Temsilcilerin yemek, ihtiyaç ve özel mola süreleri ile günlük mola sıklıkları.",
        "default_group_by": "agent",
        "default_metrics": ["break_count", "total_break_min", "avg_break_min", "max_break_min"],
        "dimensions": [
            {"id": "agent", "label": "Temsilci Bazlı"},
            {"id": "break_name", "label": "Mola Türü Bazlı"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
            {"id": "weekday", "label": "Haftanın Günü Bazlı"},
        ],
        "metrics": [
            {"id": "break_count", "label": "Toplam Mola Adedi", "unit": "adet"},
            {"id": "total_break_min", "label": "Toplam Mola Süresi (dk)", "unit": "dk"},
            {"id": "avg_break_min", "label": "Ortalama Mola Süresi (dk)", "unit": "dk"},
            {"id": "max_break_min", "label": "En Uzun Mola Süresi (dk)", "unit": "dk"},
        ],
        "filter_fields": [
            {"id": "agent", "label": "Temsilci Adı / Dahili", "type": "text"},
            {"id": "break_name", "label": "Mola Türü", "type": "text"},
            {"id": "duration_min", "label": "Mola Süresi (dk)", "type": "number"},
        ],
    },
    "omnichannel": {
        "id": "omnichannel",
        "label": "Omnichannel Yazılı Sohbetler (WhatsApp / Sosyal / E-Posta)",
        "description": "WhatsApp, Telegram, Instagram, Facebook ve E-Posta oturumları, AI otonom karşılama ve kalite skorları.",
        "default_group_by": "channel",
        "default_metrics": [
            "total_sessions",
            "ai_sessions",
            "human_sessions",
            "closed_sessions",
            "ai_resolution_pct",
            "avg_qa_score",
        ],
        "dimensions": [
            {"id": "channel", "label": "İletişim Kanalı Bazlı"},
            {"id": "assigned_agent", "label": "Atanan Birim Bazlı (AI / Temsilci)"},
            {"id": "status", "label": "Oturum Durumu Bazlı"},
            {"id": "recipient_line", "label": "Hat / Alıcı Hesap Bazlı"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
        ],
        "metrics": [
            {"id": "total_sessions", "label": "Toplam Sohbet Oturumu", "unit": "oturum"},
            {"id": "ai_sessions", "label": "AI Karşılanan Oturum", "unit": "oturum"},
            {"id": "human_sessions", "label": "Canlı Temsilci Oturumu", "unit": "oturum"},
            {"id": "closed_sessions", "label": "Tamamlanan / Kapatılan Oturum", "unit": "oturum"},
            {"id": "ai_resolution_pct", "label": "AI Karşılama Oranı (%)", "unit": "%"},
            {"id": "avg_qa_score", "label": "Ortalama Sohbet QA Puanı", "unit": "puan"},
        ],
        "filter_fields": [
            {"id": "channel", "label": "Kanal (WHATSAPP / TELEGRAM / INSTAGRAM / EMAIL)", "type": "text"},
            {"id": "assigned_agent", "label": "Atanan Birim (AI / Temsilci)", "type": "text"},
            {"id": "status", "label": "Durum (active / closed)", "type": "text"},
            {"id": "sender_info", "label": "Müşteri Telefon / Kullanıcı", "type": "text"},
        ],
    },
    "surveys": {
        "id": "surveys",
        "label": "Müşteri Memnuniyet Anketleri (CSAT)",
        "description": "Kuyruk ve görüşme sonrası tuşlanan 1-5 arası müşteri memnuniyet anket sonuçları.",
        "default_group_by": "queue_name",
        "default_metrics": ["survey_count", "avg_csat_score", "high_sat_pct", "low_sat_count"],
        "dimensions": [
            {"id": "queue_name", "label": "Kuyruk Adı Bazlı"},
            {"id": "agent_ext", "label": "Temsilci / Dahili Bazlı"},
            {"id": "score", "label": "Verilen Puan Bazlı (1-5)"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
        ],
        "metrics": [
            {"id": "survey_count", "label": "Yanıtlanan Anket Adedi", "unit": "adet"},
            {"id": "avg_csat_score", "label": "Ortalama CSAT Puanı (1-5)", "unit": "puan"},
            {"id": "high_sat_pct", "label": "Memnuniyet Oranı (4-5 Puan %)", "unit": "%"},
            {"id": "low_sat_count", "label": "Düşük Memnuniyet (1-2 Puan) Adedi", "unit": "adet"},
        ],
        "filter_fields": [
            {"id": "queue_name", "label": "Kuyruk Adı", "type": "text"},
            {"id": "agent_ext", "label": "Temsilci / Dahili", "type": "text"},
            {"id": "score", "label": "Anket Puanı (1-5)", "type": "number"},
        ],
    },
    "voip_quality": {
        "id": "voip_quality",
        "label": "VoIP & Ses Kalitesi (MOS / Jitter / RTT / Paket Kaybı)",
        "description": "RTP ses paketlerinin MOS skoru, gecikme (RTT), dalgalanma (jitter), kodek ve paket kaybı analizleri.",
        "default_group_by": "extension",
        "default_metrics": [
            "sample_count",
            "avg_mos",
            "avg_jitter_ms",
            "avg_rtt_ms",
            "avg_packet_loss_pct",
            "poor_calls_count",
        ],
        "dimensions": [
            {"id": "extension", "label": "Dahili / Temsilci Bazlı"},
            {"id": "codec", "label": "Ses Kodeği (Codec) Bazlı"},
            {"id": "direction", "label": "Çağrı Yönü Bazlı"},
            {"id": "quality_grade", "label": "Kalite Sınıfı Bazlı"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
        ],
        "metrics": [
            {"id": "sample_count", "label": "Ölçüm Sayısı", "unit": "adet"},
            {"id": "avg_mos", "label": "Ortalama MOS Skoru", "unit": "MOS"},
            {"id": "avg_jitter_ms", "label": "Ortalama Jitter (ms)", "unit": "ms"},
            {"id": "avg_rtt_ms", "label": "Ortalama Gecikme / RTT (ms)", "unit": "ms"},
            {"id": "avg_packet_loss_pct", "label": "Ortalama Paket Kaybı (%)", "unit": "%"},
            {"id": "poor_calls_count", "label": "Düşük Kaliteli Çağrı (MOS < 3.6)", "unit": "adet"},
        ],
        "filter_fields": [
            {"id": "extension", "label": "Dahili / Hat", "type": "text"},
            {"id": "codec", "label": "Ses Kodeği (opus / alaw / g722)", "type": "text"},
            {"id": "mos_score", "label": "MOS Skoru", "type": "number"},
            {"id": "jitter_ms", "label": "Jitter (ms)", "type": "number"},
            {"id": "packet_loss_pct", "label": "Paket Kaybı (%)", "type": "number"},
        ],
    },
    "dialer_campaigns": {
        "id": "dialer_campaigns",
        "label": "Dış Arama Kampanyaları (Auto-Dialer)",
        "description": "Otomatik dış arama kampanyalarının hedef numara, aranan, ulaşılan, bekleyen ve tamamlanma oranları.",
        "default_group_by": "campaign_name",
        "default_metrics": [
            "total_numbers",
            "called_numbers",
            "completed_numbers",
            "pending_numbers",
            "completion_rate_pct",
        ],
        "dimensions": [
            {"id": "campaign_name", "label": "Kampanya Adı Bazlı"},
            {"id": "status", "label": "Kampanya Durumu Bazlı"},
            {"id": "agent_id", "label": "Atanan AI / Temsilci Bazlı"},
        ],
        "metrics": [
            {"id": "campaign_count", "label": "Kampanya Sayısı", "unit": "adet"},
            {"id": "total_numbers", "label": "Toplam Hedef Numara", "unit": "kişi"},
            {"id": "called_numbers", "label": "Arama Yapılan Numara", "unit": "kişi"},
            {"id": "completed_numbers", "label": "Başarılı / Ulaşılan Numara", "unit": "kişi"},
            {"id": "pending_numbers", "label": "Sırada Bekleyen Numara", "unit": "kişi"},
            {"id": "completion_rate_pct", "label": "Tamamlanma Oranı (%)", "unit": "%"},
        ],
        "filter_fields": [
            {"id": "campaign_name", "label": "Kampanya Adı", "type": "text"},
            {"id": "status", "label": "Durum (running / paused / completed)", "type": "text"},
            {"id": "total_numbers", "label": "Hedef Numara Sayısı", "type": "number"},
        ],
    },
    "appointments": {
        "id": "appointments",
        "label": "AI Randevu Kayıtları",
        "description": "Sesli ve yazılı AI asistanların oluşturduğu müşteri randevu kayıtları ve onay durumları.",
        "default_group_by": "date",
        "default_metrics": ["total_appointments", "confirmed_appointments", "cancelled_appointments"],
        "dimensions": [
            {"id": "date", "label": "Randevu Tarihi Bazlı"},
            {"id": "status", "label": "Randevu Durumu Bazlı"},
            {"id": "customer_name", "label": "Müşteri Adı Bazlı"},
        ],
        "metrics": [
            {"id": "total_appointments", "label": "Toplam Randevu Adedi", "unit": "adet"},
            {"id": "confirmed_appointments", "label": "Onaylı Randevu Adedi", "unit": "adet"},
            {"id": "cancelled_appointments", "label": "İptal Edilen Randevu Adedi", "unit": "adet"},
        ],
        "filter_fields": [
            {"id": "status", "label": "Durum (Onaylandı / İptal Edildi)", "type": "text"},
            {"id": "customer_name", "label": "Müşteri Adı", "type": "text"},
            {"id": "customer_phone", "label": "Müşteri Telefonu", "type": "text"},
        ],
    },
    "audit_logs": {
        "id": "audit_logs",
        "label": "Sistem & Denetim Günlükleri (Audit Logs)",
        "description": "Yönetici ve kullanıcıların santral üzerinde yaptığı yapılandırma, giriş ve güvenlik işlemleri.",
        "default_group_by": "module",
        "default_metrics": ["event_count", "unique_users", "unique_ips"],
        "dimensions": [
            {"id": "module", "label": "Sistem Modülü Bazlı"},
            {"id": "action", "label": "İşlem Türü Bazlı"},
            {"id": "user_id", "label": "Kullanıcı Bazlı"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
        ],
        "metrics": [
            {"id": "event_count", "label": "Toplam İşlem Adedi", "unit": "işlem"},
            {"id": "unique_users", "label": "Tekil Kullanıcı Sayısı", "unit": "kullanıcı"},
            {"id": "unique_ips", "label": "Tekil IP Adresi Sayısı", "unit": "IP"},
        ],
        "filter_fields": [
            {"id": "module", "label": "Modül Adı", "type": "text"},
            {"id": "action", "label": "İşlem Kodu (LOGIN / UPDATE / DELETE)", "type": "text"},
            {"id": "user_id", "label": "Kullanıcı", "type": "text"},
            {"id": "ip_address", "label": "IP Adresi", "type": "text"},
        ],
    },
}


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


def _normalize_report_definition(raw_def: Dict[str, Any]) -> Dict[str, Any]:
    ds_id = str(raw_def.get("dataset") or "calls").strip().lower()
    if ds_id not in CUSTOM_REPORT_DATASETS:
        ds_id = "calls"
    ds_meta = CUSTOM_REPORT_DATASETS[ds_id]

    valid_dims = {d["id"] for d in ds_meta["dimensions"]}
    group_by = str(raw_def.get("group_by") or ds_meta["default_group_by"]).strip()
    if group_by not in valid_dims:
        group_by = ds_meta["default_group_by"]

    valid_metrics = {m["id"] for m in ds_meta["metrics"]}
    raw_metrics = raw_def.get("metrics") or ds_meta["default_metrics"]
    metrics = [str(m).strip() for m in raw_metrics if str(m).strip() in valid_metrics]
    if not metrics:
        metrics = list(ds_meta["default_metrics"])

    valid_filter_fields = {f["id"] for f in ds_meta["filter_fields"]}
    valid_ops = ("eq", "neq", "contains", "gt", "gte", "lt", "lte")
    filters_out = []
    for f_item in raw_def.get("filters") or []:
        if not isinstance(f_item, dict):
            continue
        f_field = str(f_item.get("field") or "").strip()
        f_op = str(f_item.get("op") or "contains").strip().lower()
        f_val = f_item.get("value")
        if f_field in valid_filter_fields and f_op in valid_ops and f_val not in (None, ""):
            filters_out.append({"field": f_field, "op": f_op, "value": f_val})

    filter_logic = str(raw_def.get("filter_logic") or "and").strip().lower()
    if filter_logic not in ("and", "or"):
        filter_logic = "and"

    chart_type = str(raw_def.get("chart_type") or "bar").strip().lower()
    if chart_type not in ("bar", "line", "pie", "table"):
        chart_type = "bar"

    chart_metric = str(raw_def.get("chart_metric") or metrics[0]).strip()
    if chart_metric not in metrics:
        chart_metric = metrics[0]

    sort_by = str(raw_def.get("sort_by") or metrics[0]).strip()
    if sort_by not in valid_metrics and sort_by != "group_key":
        sort_by = metrics[0]

    sort_dir = str(raw_def.get("sort_dir") or "desc").strip().lower()
    if sort_dir not in ("asc", "desc"):
        sort_dir = "desc"

    try:
        limit = max(5, min(500, int(raw_def.get("limit") or 150)))
    except Exception:
        limit = 150

    title = str(raw_def.get("title") or "").strip()
    if not title:
        dim_lbl = next((d["label"] for d in ds_meta["dimensions"] if d["id"] == group_by), group_by)
        title = f"{ds_meta['label'].split('(')[0].strip()} — {dim_lbl}"

    return {
        "title": title,
        "description": str(raw_def.get("description") or "").strip(),
        "dataset": ds_id,
        "group_by": group_by,
        "metrics": metrics,
        "filters": filters_out,
        "filter_logic": filter_logic,
        "chart_type": chart_type,
        "chart_metric": chart_metric,
        "sort_by": sort_by,
        "sort_dir": sort_dir,
        "limit": limit,
    }


def _eval_single_filter(rec: Dict[str, Any], flt: Dict[str, Any]) -> bool:
    field = flt["field"]
    op = flt["op"]
    target_val = flt["value"]
    actual_val = rec.get(field)

    if op in ("gt", "gte", "lt", "lte"):
        try:
            a_num = float(actual_val if actual_val is not None else 0)
            t_num = float(target_val)
            if op == "gt":
                return a_num > t_num
            if op == "gte":
                return a_num >= t_num
            if op == "lt":
                return a_num < t_num
            if op == "lte":
                return a_num <= t_num
        except Exception:
            return False
    else:
        a_str = str(actual_val if actual_val is not None else "").strip().lower()
        t_str = str(target_val).strip().lower()
        if op == "eq":
            return a_str == t_str
        if op == "neq":
            return a_str != t_str
        if op == "contains":
            return t_str in a_str
    return True


def _match_record_filters(rec: Dict[str, Any], filters: List[Dict[str, Any]], logic: str = "and") -> bool:
    if not filters:
        return True
    if logic == "or":
        return any(_eval_single_filter(rec, f) for f in filters)
    return all(_eval_single_filter(rec, f) for f in filters)


def _infer_call_direction(caller: str, callee: str) -> str:
    c_in = str(caller or "").strip()
    c_out = str(callee or "").strip()
    in_is_ext = c_in.isdigit() and len(c_in) <= 5
    out_is_ext = c_out.isdigit() and len(c_out) <= 5
    if in_is_ext and out_is_ext:
        return "Dahili"
    if in_is_ext and not out_is_ext:
        return "Giden"
    return "Gelen"


def _compute_dataset_metrics(ds_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    if ds_id == "calls":
        tot = len(items)
        ans = sum(1 for x in items if x["answered"])
        missed = tot - ans
        ans_pct = round((ans / tot) * 100.0, 1) if tot > 0 else 0.0
        sla_ok = sum(1 for x in items if x["answered"] and float(x["wait_sec"] or 0) <= 20.0)
        sla_pct = round((sla_ok / tot) * 100.0, 1) if tot > 0 else 0.0

        caller_counts: Dict[str, int] = {}
        for x in items:
            l10 = _last10_digits(x["caller_number"])
            if len(l10) >= 7:
                caller_counts[l10] = caller_counts.get(l10, 0) + 1
        uniq_c = len(caller_counts)
        fcr_c = sum(1 for cnt in caller_counts.values() if cnt == 1)
        fcr_pct = round((fcr_c / uniq_c) * 100.0, 1) if uniq_c > 0 else (100.0 if ans > 0 else 0.0)

        talk_sum_sec = sum(float(x["talk_sec"] or 0) for x in items)
        waits = [float(x["wait_sec"] or 0) for x in items]
        wait_sum_sec = sum(waits)
        qa_vals = [x["qa_score"] for x in items if x["qa_score"] is not None]
        pos_cnt = sum(1 for x in items if any(w in x["sentiment"].lower() for w in ("olumlu", "memnun", "positive", "mutlu", "pozitif")))
        neg_cnt = sum(1 for x in items if any(w in x["sentiment"].lower() for w in ("olumsuz", "kızgın", "negative", "gergin", "şikayet", "negatif", "öfkeli")))
        rec_cnt = sum(1 for x in items if x.get("has_recording"))

        return {
            "total_calls": tot,
            "answered_calls": ans,
            "missed_calls": missed,
            "answer_rate_pct": ans_pct,
            "sla_20s_pct": sla_pct,
            "fcr_pct": fcr_pct,
            "total_talk_min": round(talk_sum_sec / 60.0, 1),
            "avg_talk_sec": round(talk_sum_sec / ans, 1) if ans > 0 else 0.0,
            "avg_wait_sec": round(wait_sum_sec / tot, 1) if tot > 0 else 0.0,
            "max_wait_sec": round(max(waits), 1) if waits else 0.0,
            "avg_qa_score": round(sum(qa_vals) / len(qa_vals), 1) if qa_vals else 0.0,
            "positive_count": pos_cnt,
            "negative_count": neg_cnt,
            "recorded_calls": rec_cnt,
            "unique_callers": uniq_c,
        }

    if ds_id == "queues":
        tot = len(items)
        ans = sum(1 for x in items if x["answered"])
        aban = tot - ans
        sla_ok = sum(1 for x in items if x["answered"] and float(x["wait_sec"] or 0) <= 20.0)
        waits = [float(x["wait_sec"] or 0) for x in items]
        talk_sum = sum(float(x["talk_sec"] or 0) for x in items)
        return {
            "total_calls": tot,
            "answered_calls": ans,
            "abandoned_calls": aban,
            "answer_rate_pct": round((ans / tot) * 100.0, 1) if tot > 0 else 0.0,
            "sla_20s_pct": round((sla_ok / tot) * 100.0, 1) if tot > 0 else 0.0,
            "avg_wait_sec": round(sum(waits) / tot, 1) if tot > 0 else 0.0,
            "max_wait_sec": round(max(waits), 1) if waits else 0.0,
            "avg_talk_sec": round(talk_sum / ans, 1) if ans > 0 else 0.0,
        }

    if ds_id == "breaks":
        cnt = len(items)
        durs = [float(x["duration_min"] or 0) for x in items]
        return {
            "break_count": cnt,
            "total_break_min": round(sum(durs), 1),
            "avg_break_min": round(sum(durs) / cnt, 1) if cnt > 0 else 0.0,
            "max_break_min": round(max(durs), 1) if durs else 0.0,
        }

    if ds_id == "omnichannel":
        tot = len(items)
        ai_c = sum(1 for x in items if x["is_ai"])
        hum_c = tot - ai_c
        closed_c = sum(1 for x in items if str(x.get("status") or "").lower() in ("closed", "resolved", "kapalı"))
        qas = [x["qa_score"] for x in items if x["qa_score"] is not None]
        return {
            "total_sessions": tot,
            "ai_sessions": ai_c,
            "human_sessions": hum_c,
            "closed_sessions": closed_c,
            "ai_resolution_pct": round((ai_c / tot) * 100.0, 1) if tot > 0 else 0.0,
            "avg_qa_score": round(sum(qas) / len(qas), 1) if qas else 0.0,
        }

    if ds_id == "surveys":
        cnt = len(items)
        scores = [int(x["score"] or 0) for x in items if int(x["score"] or 0) > 0]
        high_c = sum(1 for sc in scores if sc >= 4)
        low_c = sum(1 for sc in scores if 1 <= sc <= 2)
        s_den = len(scores)
        return {
            "survey_count": cnt,
            "avg_csat_score": round(sum(scores) / s_den, 2) if s_den > 0 else 0.0,
            "high_sat_pct": round((high_c / s_den) * 100.0, 1) if s_den > 0 else 0.0,
            "low_sat_count": low_c,
        }

    if ds_id == "voip_quality":
        cnt = len(items)
        mos_l = [x["mos_score"] for x in items]
        jit_l = [x["jitter_ms"] for x in items]
        rtt_l = [x["rtt_ms"] for x in items]
        pl_l = [x["packet_loss_pct"] for x in items]
        poor_c = sum(1 for m in mos_l if m < 3.6)
        return {
            "sample_count": cnt,
            "avg_mos": round(sum(mos_l) / cnt, 2) if cnt > 0 else 0.0,
            "avg_jitter_ms": round(sum(jit_l) / cnt, 1) if cnt > 0 else 0.0,
            "avg_rtt_ms": round(sum(rtt_l) / cnt, 1) if cnt > 0 else 0.0,
            "avg_packet_loss_pct": round(sum(pl_l) / cnt, 2) if cnt > 0 else 0.0,
            "poor_calls_count": poor_c,
        }

    if ds_id == "dialer_campaigns":
        cnt = len(items)
        tot_n = sum(int(x["total_numbers"] or 0) for x in items)
        called_n = sum(int(x["called_numbers"] or 0) for x in items)
        comp_n = sum(int(x["completed_numbers"] or 0) for x in items)
        pend_n = sum(int(x["pending_numbers"] or 0) for x in items)
        return {
            "campaign_count": cnt,
            "total_numbers": tot_n,
            "called_numbers": called_n,
            "completed_numbers": comp_n,
            "pending_numbers": pend_n,
            "completion_rate_pct": round((comp_n / tot_n) * 100.0, 1) if tot_n > 0 else 0.0,
        }

    if ds_id == "audit_logs":
        cnt = len(items)
        u_users = len({x["user_id"] for x in items if x.get("user_id")})
        u_ips = len({x["ip_address"] for x in items if x.get("ip_address") and x.get("ip_address") != "-"})
        return {
            "event_count": cnt,
            "unique_users": u_users,
            "unique_ips": u_ips,
        }

    # appointments
    tot = len(items)
    canc = sum(1 for x in items if x["raw_status"] == "cancelled")
    return {
        "total_appointments": tot,
        "confirmed_appointments": tot - canc,
        "cancelled_appointments": canc,
    }


async def execute_custom_report_definition(
    raw_definition: Dict[str, Any],
    tenant_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    start_time: Optional[str] = "00:00",
    end_time: Optional[str] = "23:59",
) -> Dict[str, Any]:
    from backend.main import settings_db

    defn = _normalize_report_definition(raw_definition)
    ds_id = defn["dataset"]
    group_by = defn["group_by"]
    metrics = defn["metrics"]
    filters = defn["filters"]
    filter_logic = defn.get("filter_logic") or "and"

    ds_meta = CUSTOM_REPORT_DATASETS[ds_id]
    dim_label = next((d["label"] for d in ds_meta["dimensions"] if d["id"] == group_by), "Grup")
    metric_meta_map = {m["id"]: m for m in ds_meta["metrics"]}

    start_utc, end_utc = _parse_tr_date_range(start_date, end_date, start_time, end_time)
    buckets: Dict[str, List[Dict[str, Any]]] = {}
    all_matched_items: List[Dict[str, Any]] = []

    # Build department map from settings_db if available
    dept_id_to_name: Dict[str, str] = {}
    for d_obj in settings_db.get("departments", []) or []:
        if isinstance(d_obj, dict) and d_obj.get("id") is not None:
            dept_id_to_name[str(d_obj.get("id"))] = str(d_obj.get("name") or "")
    ext_to_dept_disk: Dict[str, str] = {}
    for du in settings_db.get("users", []) or []:
        if isinstance(du, dict) and du.get("extension"):
            raw_d = str(du.get("department") or du.get("department_id") or "").strip()
            ext_to_dept_disk[str(du["extension"]).strip()] = dept_id_to_name.get(raw_d, raw_d)

    async with AsyncSessionLocal() as db:
        if ds_id == "calls":
            stmt_u = _apply_tenant_clause(select(SystemUser), SystemUser, tenant_id)
            users_db = (await db.execute(stmt_u)).scalars().all()
            ext_to_name: Dict[str, str] = {}
            ext_to_dept: Dict[str, str] = dict(ext_to_dept_disk)
            for u in users_db:
                if u.extension:
                    ext_k = str(u.extension).strip()
                    ext_to_name[ext_k] = str(u.full_name or f"Dahili {ext_k}").strip()
                    if u.department_id and not ext_to_dept.get(ext_k):
                        ext_to_dept[ext_k] = dept_id_to_name.get(str(u.department_id), str(u.department_id))

            stmt = _apply_tenant_clause(
                select(Call).where(Call.start_time >= start_utc, Call.start_time <= end_utc),
                Call,
                tenant_id,
            )
            calls = (await db.execute(stmt)).scalars().all()
            for c in calls:
                tr_dt = _to_tr_dt(c.start_time)
                caller_s = str(c.caller_number or "").strip()
                callee_s = str(c.callee_number or "").strip()
                ag_lbl = str(c.agent_name or "").strip()
                matched_ext = ""
                if callee_s in ext_to_name:
                    matched_ext = callee_s
                elif caller_s in ext_to_name:
                    matched_ext = caller_s

                if not ag_lbl:
                    if matched_ext:
                        ag_lbl = f"{ext_to_name[matched_ext]} ({matched_ext})"
                    elif callee_s.isdigit() and len(callee_s) <= 5:
                        ag_lbl = f"Dahili {callee_s}"
                    else:
                        ag_lbl = "AI / Santral Karşılama"

                dept_lbl = ext_to_dept.get(matched_ext) or "Genel Merkez"
                direction = _infer_call_direction(caller_s, callee_s)
                answered = _is_answered_call(c)
                talk_s = _call_talk_sec(c)
                wait_s = _call_wait_sec(c)
                sent_raw = str(c.sentiment or "Nötr").strip()
                qa_val = c.qa_score if c.qa_score is not None else None

                rec = {
                    "agent": ag_lbl,
                    "department": dept_lbl,
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "weekday": _tr_weekday_label(tr_dt),
                    "hour": f"{tr_dt.hour:02d}:00" if tr_dt else "00:00",
                    "trunk_name": str(c.trunk_name or "Dahili / WebRTC").strip() or "Dahili / WebRTC",
                    "status": "Cevaplandı" if answered else (str(c.status or "Cevapsız").strip() or "Cevapsız"),
                    "sentiment": sent_raw or "Nötr",
                    "topic": str(c.agent_topic or "Genel Görüşme").strip() or "Genel Görüşme",
                    "callee_did": callee_s or "-",
                    "direction": direction,
                    "hangup_source": str(c.hangup_source or "Normal Kapanış").strip() or "Normal Kapanış",
                    "caller_number": caller_s,
                    "callee_number": callee_s,
                    "answered": answered,
                    "has_recording": bool(str(c.recording_path or "").strip()),
                    "talk_sec": talk_s,
                    "wait_sec": wait_s,
                    "qa_score": float(qa_val) if qa_val is not None else None,
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "queues":
            q_rows = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
            q_ext_map = {str(q.extension).strip(): f"{q.name} ({q.extension})" for q in q_rows if q.extension}
            for qd in settings_db.get("queues", []) or []:
                if isinstance(qd, dict) and qd.get("extension") and str(qd["extension"]) not in q_ext_map:
                    q_ext_map[str(qd["extension"])] = f"{qd.get('name') or 'Kuyruk'} ({qd['extension']})"

            stmt = _apply_tenant_clause(
                select(Call).where(Call.start_time >= start_utc, Call.start_time <= end_utc),
                Call,
                tenant_id,
            )
            calls = (await db.execute(stmt)).scalars().all()
            for c in calls:
                hs = str(c.hangup_source or "").strip()
                callee_s = str(c.callee_number or "").strip()
                q_ext = ""
                if hs.startswith("queue:"):
                    q_ext = hs.split(":", 1)[1].split(":")[0].strip()
                elif callee_s in q_ext_map or (callee_s.isdigit() and 2000 <= int(callee_s) <= 2999):
                    q_ext = callee_s
                if not q_ext:
                    continue

                tr_dt = _to_tr_dt(c.start_time)
                answered = _is_answered_call(c)
                rec = {
                    "queue_name": q_ext_map.get(q_ext, f"Kuyruk {q_ext}"),
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "hour": f"{tr_dt.hour:02d}:00" if tr_dt else "00:00",
                    "status": "Cevaplandı" if answered else "Terk Edildi",
                    "answered": answered,
                    "wait_sec": _call_wait_sec(c),
                    "talk_sec": _call_talk_sec(c),
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "breaks":
            stmt = _apply_tenant_clause(
                select(AgentBreakLog).where(AgentBreakLog.start_time >= start_utc, AgentBreakLog.start_time <= end_utc),
                AgentBreakLog,
                tenant_id,
            )
            b_rows = (await db.execute(stmt)).scalars().all()
            for b in b_rows:
                b_name = str(b.break_name or "").strip()
                if b_name.startswith("__ACTION__:"):
                    continue
                tr_dt = _to_tr_dt(b.start_time)
                dur_min = round(float(b.duration_seconds or 0) / 60.0, 2)
                ag_lbl = str(b.agent_name or "").strip() or (f"Dahili {b.extension}" if b.extension else "Temsilci")
                rec = {
                    "agent": ag_lbl,
                    "break_name": b_name or "Genel Mola",
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "weekday": _tr_weekday_label(tr_dt),
                    "duration_min": dur_min,
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "omnichannel":
            stmt = _apply_tenant_clause(
                select(ChatSession).where(ChatSession.last_message_time >= start_utc, ChatSession.last_message_time <= end_utc),
                ChatSession,
                tenant_id,
            )
            s_rows = (await db.execute(stmt)).scalars().all()
            for s in s_rows:
                tr_dt = _to_tr_dt(s.last_message_time)
                assigned = str(s.assigned_agent or "ai").strip().lower()
                human_label = str(getattr(s, "assigned_user", "") or s.assigned_agent or "Temsilci").strip()
                rec = {
                    "channel": str(s.channel or "whatsapp").strip().upper(),
                    "assigned_agent": "AI Asistan" if assigned == "ai" else f"Temsilci ({human_label})",
                    "is_ai": assigned == "ai",
                    "status": str(s.status or "active").strip(),
                    "sender_info": str(s.sender_info or "").strip(),
                    "recipient_line": str(getattr(s, "recipient_info", "") or "Varsayılan Hat").strip() or "Varsayılan Hat",
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "qa_score": float(s.qa_score) if getattr(s, "qa_score", None) is not None else None,
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "surveys":
            stmt = _apply_tenant_clause(
                select(QueueSurveyResponse).where(QueueSurveyResponse.timestamp >= start_utc, QueueSurveyResponse.timestamp <= end_utc),
                QueueSurveyResponse,
                tenant_id,
            )
            sv_rows = (await db.execute(stmt)).scalars().all()
            for sv in sv_rows:
                tr_dt = _to_tr_dt(sv.timestamp)
                sc_val = int(sv.score or 0)
                ag_ext_s = str(sv.agent_extension or "").strip()
                ag_nm_s = str(sv.agent_name or "").strip()
                ag_disp = f"{ag_nm_s} ({ag_ext_s})" if (ag_nm_s and ag_ext_s) else (ag_nm_s or ag_ext_s or "Belirtilmemiş")
                rec = {
                    "queue_name": str(sv.queue_name or sv.queue_extension or "Genel Kuyruk").strip(),
                    "agent_ext": ag_disp,
                    "score": sc_val,
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = f"{sc_val} Puan" if group_by == "score" else str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "voip_quality":
            stmt = _apply_tenant_clause(
                select(VoipQualityLog).where(VoipQualityLog.timestamp >= start_utc, VoipQualityLog.timestamp <= end_utc),
                VoipQualityLog,
                tenant_id,
            )
            q_rows = (await db.execute(stmt)).scalars().all()
            for q in q_rows:
                tr_dt = _to_tr_dt(q.timestamp)
                mos = float(q.mos_score or 4.2)
                grade = "Mükemmel (4.2+)" if mos >= 4.2 else ("İyi (3.6 - 4.1)" if mos >= 3.6 else "Zayıf (< 3.6)")
                ext_s = str(q.extension or "").strip()
                ag_s = str(q.agent_name or "").strip()
                ext_disp = f"{ag_s} ({ext_s})" if (ag_s and ext_s) else (ext_s or str(q.remote_number or "Genel Hat").strip())
                dir_raw = str(q.direction or "outbound").lower()
                dir_lbl = "Gelen" if dir_raw == "inbound" else "Giden"
                rec = {
                    "extension": ext_disp,
                    "codec": str(q.codec or "opus/48000").strip(),
                    "direction": dir_lbl,
                    "quality_grade": grade,
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "mos_score": mos,
                    "jitter_ms": float(q.jitter_ms or 0),
                    "rtt_ms": float(q.rtt_ms or 0),
                    "packet_loss_pct": float(q.packet_loss_pct or 0),
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "dialer_campaigns":
            ai_name_map = {
                str(a.get("id")): str(a.get("name") or a.get("id"))
                for a in (settings_db.get("ai_agents", []) or [])
                if isinstance(a, dict) and a.get("id")
            }
            for dc in settings_db.get("dialer_campaigns", []) or []:
                if not isinstance(dc, dict) or not _match_dict_tenant(dc, tenant_id):
                    continue
                nums = dc.get("numbers") if isinstance(dc.get("numbers"), list) else (dc.get("contacts") or [])
                tot_n = len(nums) if isinstance(nums, list) else 0
                comp_n = sum(
                    1
                    for n in (nums if isinstance(nums, list) else [])
                    if isinstance(n, dict) and str(n.get("status") or "").lower() in ("completed", "answered", "success")
                )
                pend_n = sum(
                    1
                    for n in (nums if isinstance(nums, list) else [])
                    if isinstance(n, dict) and str(n.get("status") or "pending").lower() == "pending"
                )
                called_n = max(0, tot_n - pend_n)
                raw_ag = str(dc.get("agent_id") or dc.get("route_destination") or "-").strip()
                rec = {
                    "campaign_name": str(dc.get("name") or dc.get("id") or "Kampanya").strip(),
                    "status": str(dc.get("status") or "paused").strip(),
                    "agent_id": ai_name_map.get(raw_ag, raw_ag),
                    "total_numbers": tot_n,
                    "called_numbers": called_n,
                    "completed_numbers": comp_n,
                    "pending_numbers": pend_n,
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "appointments":
            stmt = _apply_tenant_clause(
                select(Appointment).where(Appointment.appointment_time >= start_utc, Appointment.appointment_time <= end_utc),
                Appointment,
                tenant_id,
            )
            ap_rows = (await db.execute(stmt)).scalars().all()
            for ap in ap_rows:
                tr_dt = _to_tr_dt(ap.appointment_time)
                st_str = str(ap.status or "confirmed").strip().lower()
                rec = {
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "status": "İptal Edildi" if st_str == "cancelled" else "Onaylandı",
                    "raw_status": st_str,
                    "customer_name": str(ap.customer_name or "Müşteri").strip(),
                    "customer_phone": str(ap.customer_phone or "").strip(),
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "audit_logs":
            ev_rows = (
                await db.execute(
                    select(EventLog).where(EventLog.timestamp >= start_utc, EventLog.timestamp <= end_utc)
                )
            ).scalars().all()
            for ev in ev_rows:
                tr_dt = _to_tr_dt(ev.timestamp)
                rec = {
                    "module": str(ev.module or "System").strip(),
                    "action": str(ev.action or "INFO").strip(),
                    "user_id": str(ev.user_id or "system").strip(),
                    "ip_address": str(ev.ip_address or "-").strip(),
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                }
                if not _match_record_filters(rec, filters, filter_logic):
                    continue
                all_matched_items.append(rec)
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

    rows_out: List[Dict[str, Any]] = []
    total_records_matched = len(all_matched_items)

    for g_key, items in buckets.items():
        row: Dict[str, Any] = {"group_key": g_key}
        computed = _compute_dataset_metrics(ds_id, items)
        for m_id in metrics:
            row[m_id] = computed.get(m_id, 0)
        rows_out.append(row)

    sort_key = defn["sort_by"]
    reverse_sort = defn["sort_dir"] == "desc"
    if sort_key == "group_key" or (group_by in ("date", "hour", "weekday") and sort_key == metrics[0] and raw_definition.get("sort_by") is None):
        rows_out.sort(
            key=lambda r: str(r.get("group_key") or ""),
            reverse=(reverse_sort if sort_key == "group_key" else False),
        )
    else:
        rows_out.sort(key=lambda r: float(r.get(sort_key) or 0), reverse=reverse_sort)

    rows_out = rows_out[: defn["limit"]]

    columns = [{"key": "group_key", "label": dim_label}] + [
        {
            "key": m_id,
            "label": metric_meta_map[m_id]["label"],
            "unit": metric_meta_map[m_id].get("unit", ""),
        }
        for m_id in metrics
        if m_id in metric_meta_map
    ]

    # Overall weighted totals / averages across all matched records
    totals_computed = _compute_dataset_metrics(ds_id, all_matched_items) if all_matched_items else {}
    totals_row: Dict[str, Any] = {"group_key": f"TOPLAM / GENEL ({len(rows_out)} Grup)"}
    for m_id in metrics:
        totals_row[m_id] = totals_computed.get(m_id, 0)

    primary_metric = defn.get("chart_metric") or metrics[0]
    if primary_metric not in metrics:
        primary_metric = metrics[0]
    primary_metric_label = metric_meta_map.get(primary_metric, {}).get("label", primary_metric)
    chart_data = [
        {
            "label": str(r.get("group_key") or "-"),
            "value": float(r.get(primary_metric) or 0),
        }
        for r in rows_out[:20]
    ]

    summary_cards = [
        {"label": "Toplam Grup / Satır", "value": len(rows_out)},
        {"label": "İncelenen Ham Kayıt", "value": total_records_matched},
    ]
    for m_id in metrics[:2]:
        m_info = metric_meta_map.get(m_id, {})
        agg_val = totals_computed.get(m_id, 0) if all_matched_items else 0
        summary_cards.append({"label": m_info.get("label", m_id), "value": agg_val, "unit": m_info.get("unit", "")})

    return {
        "definition": defn,
        "columns": columns,
        "rows": rows_out,
        "totals_row": totals_row,
        "chart_data": chart_data,
        "primary_metric": primary_metric,
        "primary_metric_label": primary_metric_label,
        "summary_cards": summary_cards,
        "total_records": total_records_matched,
    }


def _parse_custom_report_prompt_semantically(prompt: str) -> Dict[str, Any]:
    p = (prompt or "").lower()

    if any(k in p for k in ("mola", "puantaj", "yemek", "dinlenme")):
        dataset = "breaks"
        group_by = "break_name" if ("tür" in p or "tip" in p) else ("weekday" if "haftanın gün" in p else ("date" if any(k in p for k in ("günlük", "tarih", "gün bazlı")) else "agent"))
        metrics = ["break_count", "total_break_min", "avg_break_min", "max_break_min"]
        title = "Temsilci Mola & Süre Analizi"
    elif any(k in p for k in ("kuyruk sla", "kuyruk bazlı", "kuyruk performans", "terk edilen", "acd kuyruk")):
        dataset = "queues"
        group_by = "hour" if ("saatlik" in p or "saat bazlı" in p) else ("date" if any(k in p for k in ("günlük", "tarih", "gün bazlı")) else "queue_name")
        metrics = ["total_calls", "answered_calls", "abandoned_calls", "answer_rate_pct", "sla_20s_pct", "avg_wait_sec"]
        title = "ACD Kuyruk & SLA Performans Raporu"
    elif any(k in p for k in ("kampanya", "dialer", "otomatik dış arama")):
        dataset = "dialer_campaigns"
        group_by = "status" if "durum" in p else "campaign_name"
        metrics = ["total_numbers", "called_numbers", "completed_numbers", "pending_numbers", "completion_rate_pct"]
        title = "Dış Arama Kampanya Performans Raporu"
    elif any(k in p for k in ("denetim", "audit", "olay günlük", "işlem geçmişi", "log")):
        dataset = "audit_logs"
        group_by = "module" if "modül" in p else ("user_id" if "kullanıcı" in p else ("action" if "işlem" in p else "module"))
        metrics = ["event_count", "unique_users", "unique_ips"]
        title = "Sistem & Denetim Günlükleri Raporu"
    elif any(k in p for k in ("whatsapp", "omnichannel", "yazılı", "telegram", "instagram", "sohbet", "mesaj")):
        dataset = "omnichannel"
        group_by = "date" if any(k in p for k in ("günlük", "tarih", "gün bazlı")) else ("assigned_agent" if "temsilci" in p else "channel")
        metrics = ["total_sessions", "ai_sessions", "human_sessions", "closed_sessions", "ai_resolution_pct", "avg_qa_score"]
        title = "Omnichannel Kanal & AI Karşılama Raporu"
    elif any(k in p for k in ("anket", "csat", "memnuniyet puan")):
        dataset = "surveys"
        group_by = "agent_ext" if ("temsilci" in p or "dahili" in p) else "queue_name"
        metrics = ["survey_count", "avg_csat_score", "high_sat_pct", "low_sat_count"]
        title = "Müşteri Memnuniyet Anketi (CSAT) Raporu"
    elif any(k in p for k in ("mos", "jitter", "paket kaybı", "voip", "ses kalitesi", "rtt", "codec", "kodek")):
        dataset = "voip_quality"
        group_by = "codec" if ("codec" in p or "kodek" in p) else ("quality_grade" if "sınıf" in p else "extension")
        metrics = ["sample_count", "avg_mos", "avg_jitter_ms", "avg_rtt_ms", "avg_packet_loss_pct", "poor_calls_count"]
        title = "VoIP Ses Kalitesi & MOS Raporu"
    elif any(k in p for k in ("randevu", "appointment")):
        dataset = "appointments"
        group_by = "status" if "durum" in p else ("customer_name" if "müşteri" in p else "date")
        metrics = ["total_appointments", "confirmed_appointments", "cancelled_appointments"]
        title = "AI Randevu Dağılım Raporu"
    else:
        dataset = "calls"
        if "saatlik" in p or "saat bazlı" in p:
            group_by = "hour"
            title = "Saatlik Çağrı Yoğunluk & Performans Raporu"
        elif "haftanın gün" in p or "günlerine göre" in p:
            group_by = "weekday"
            title = "Haftanın Günlerine Göre Çağrı Dağılımı"
        elif any(k in p for k in ("trunk", "dış hat", "operatör")):
            group_by = "trunk_name"
            title = "SIP Dış Hat (Trunk) Çağrı Trafik Raporu"
        elif "departman" in p:
            group_by = "department"
            title = "Departman Bazlı Çağrı Performans Raporu"
        elif any(k in p for k in ("günlük", "tarih", "gün bazlı", "trend")):
            group_by = "date"
            title = "Günlük Çağrı Trend Raporu"
        elif any(k in p for k in ("duygu", "kızgın", "memnun", "sentiment")):
            group_by = "sentiment"
            title = "Müşteri Duygu Durumu Dağılım Raporu"
        elif any(k in p for k in ("did", "aranan numara", "hat bazlı")):
            group_by = "callee_did"
            title = "Aranan Hat (DID) Trafik Raporu"
        elif any(k in p for k in ("çağrı konusu", "konu bazlı", "konulara göre", "sonuç kodu", "niyet")):
            group_by = "topic"
            title = "Çağrı Konusu & Sonuç Kodu Raporu"
        elif any(k in p for k in ("yön", "gelen giden")):
            group_by = "direction"
            title = "Çağrı Yönü Dağılım Raporu"
        else:
            group_by = "agent"
            title = "Temsilci Çağrı Performans Raporu"

        metrics = ["total_calls", "answered_calls", "missed_calls", "answer_rate_pct", "sla_20s_pct", "total_talk_min", "avg_talk_sec"]
        if any(k in p for k in ("fcr", "ilk aramada")):
            metrics.append("fcr_pct")
        if any(k in p for k in ("kalite", "qa", "puan")):
            metrics.append("avg_qa_score")
        if any(k in p for k in ("duygu", "olumsuz", "kızgın", "olumlu")):
            metrics.extend(["positive_count", "negative_count"])
        if "bekleme" in p:
            metrics.extend(["avg_wait_sec", "max_wait_sec"])

    filters = []
    if dataset == "calls":
        if "gelen" in p and "giden" not in p:
            filters.append({"field": "direction", "op": "eq", "value": "Gelen"})
        elif "giden" in p and "gelen" not in p:
            filters.append({"field": "direction", "op": "eq", "value": "Giden"})
        if any(k in p for k in ("sadece kaçan", "sadece cevapsız", "cevapsız çağrı")):
            filters.append({"field": "status", "op": "neq", "value": "Cevaplandı"})
        dur_match = re.search(r"(\d+)\s*(saniye|sn|dakika|dk)\s*(üzeri|üstü|fazla|uzun)", p)
        if dur_match:
            val_num = int(dur_match.group(1))
            if dur_match.group(2) in ("dakika", "dk"):
                val_num *= 60
            filters.append({"field": "talk_sec", "op": "gt", "value": val_num})
        ext_match = re.search(r"\b(1\d{2,3})\b", p)
        if ext_match and any(k in p for k in ("dahili", "nolu", "numaralı", "temsilci")):
            filters.append({"field": "agent", "op": "contains", "value": ext_match.group(1)})

    if "pasta" in p or "dağılım" in p or "donut" in p:
        chart_type = "pie"
    elif "çizgi" in p or "trend" in p or group_by in ("date", "hour", "weekday"):
        chart_type = "line"
    elif "sadece tablo" in p:
        chart_type = "table"
    else:
        chart_type = "bar"

    sort_dir = "asc" if any(k in p for k in ("küçükten büyüğe", "artan", "en düşük")) else "desc"

    return _normalize_report_definition(
        {
            "title": title,
            "description": prompt.strip(),
            "dataset": dataset,
            "group_by": group_by,
            "metrics": metrics,
            "filters": filters,
            "chart_type": chart_type,
            "sort_dir": sort_dir,
        }
    )


def _detect_prompt_date_period(prompt: str) -> Optional[str]:
    p = (prompt or "").lower()
    if any(k in p for k in ("son 30", "bir ay", "1 ay", "bu ay", "aylık", "geçen ay")):
        return "last_30_days"
    if any(k in p for k in ("son 7", "bir hafta", "1 hafta", "bu hafta", "haftalık", "geçen hafta")):
        return "last_7_days"
    if "dün" in p:
        return "yesterday"
    if "bugün" in p:
        return "today"
    return None


def _detect_prompt_time_window(prompt: str) -> Tuple[Optional[str], Optional[str]]:
    p = (prompt or "").lower()
    m = re.search(r"(\d{1,2}:\d{2})\s*[-–/]\s*(\d{1,2}:\d{2})", p)
    if m:
        s_t = m.group(1).zfill(5)
        e_t = m.group(2).zfill(5)
        return s_t, e_t
    if any(k in p for k in ("mesai içi", "mesai saat", "mesai (")):
        return "09:00", "18:00"
    if "mesai dışı" in p or "akşam" in p:
        return "18:00", "23:59"
    return None, None


@ai_copilot_router.get("/api/reports/custom/metadata")
async def get_custom_report_metadata(request: Request):
    from backend.services.ai_task_router import get_ai_task_routing_config

    tenant_id = _extract_tenant_id(request)
    ai_cfg = get_ai_task_routing_config(tenant_id)
    task_cfg = (ai_cfg.get("tasks") or {}).get("custom_report_generator") or {
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    }
    return {
        "datasets": list(CUSTOM_REPORT_DATASETS.values()),
        "ai_routing": {
            "provider": task_cfg.get("provider", "gemini"),
            "model": task_cfg.get("model", "gemini-2.5-flash"),
            "ollama_base_url": ai_cfg.get("ollama_base_url", "http://127.0.0.1:11434"),
            "cloud_fallback_enabled": bool(ai_cfg.get("cloud_fallback_enabled", True)),
        },
    }


@ai_copilot_router.post("/api/reports/custom/execute")
async def execute_custom_report_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    tenant_id = _extract_tenant_id(request)
    definition = payload.get("definition") or payload
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    start_time = payload.get("start_time") or "00:00"
    end_time = payload.get("end_time") or "23:59"

    result = await execute_custom_report_definition(
        raw_definition=definition,
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        start_time=start_time,
        end_time=end_time,
    )
    return result


@ai_copilot_router.post("/api/reports/custom/ai-generate")
async def ai_generate_custom_report_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    from backend.services.ai_task_router import generate_routed_text

    tenant_id = _extract_tenant_id(request)
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Lütfen oluşturmak istediğiniz raporu kısaca tarif edin.")

    schema_summary = {
        ds_k: {
            "dimensions": [d["id"] for d in ds_v["dimensions"]],
            "metrics": [m["id"] for m in ds_v["metrics"]],
            "filter_fields": [f["id"] for f in ds_v["filter_fields"]],
        }
        for ds_k, ds_v in CUSTOM_REPORT_DATASETS.items()
    }

    sys_inst = (
        "Sen AIDA Kurumsal Santral ve AI Çağrı Merkezi sisteminin Özel Rapor Tasarımcı yapay zekasısın.\n"
        "Kullanıcının Türkçe doğal dildeki rapor isteğini aşağıdaki 9 veri kaynağı ve metrik şemasına uygun SADECE geçerli bir JSON nesnesine dönüştür.\n"
        f"ŞEMA: {json.dumps(schema_summary, ensure_ascii=False)}\n"
        "JSON FORMATI:\n"
        '{"title": "Rapor Başlığı", "dataset": "calls|queues|breaks|omnichannel|surveys|voip_quality|dialer_campaigns|appointments|audit_logs", '
        '"group_by": "boyut_id", "metrics": ["metrik1", "metrik2"], '
        '"filters": [{"field": "alan", "op": "eq|neq|contains|gt|gte|lt|lte", "value": "değer"}], '
        '"filter_logic": "and|or", "chart_type": "bar|line|pie|table", "chart_metric": "metrik1", "sort_by": "metrik1", "sort_dir": "desc|asc"}\n'
        "Sadece JSON döndür, açıklama yazma."
    )

    provider_used = "semantic_engine"
    model_used = "Yerleşik Türkçe Analiz Motoru"
    fallback_used = False
    defn: Optional[Dict[str, Any]] = None

    try:
        llm_res = await generate_routed_text(
            task_id="custom_report_generator",
            prompt=prompt,
            system_instruction=sys_inst,
            json_mode=True,
            tenant_id=tenant_id,
            interactive=True,
        )
        parsed = _extract_json_dict(llm_res.get("text") or "")
        if parsed and parsed.get("dataset"):
            defn = _normalize_report_definition({**parsed, "description": prompt})
            provider_used = str(llm_res.get("provider_used") or "gemini")
            model_used = str(llm_res.get("model_used") or "")
            fallback_used = bool(llm_res.get("fallback_used", False))
    except Exception as e_ai:
        print(f"[CustomReport AI Fallback Notice]: {e_ai}")

    if not defn:
        defn = _parse_custom_report_prompt_semantically(prompt)
        fallback_used = True

    suggested_period = _detect_prompt_date_period(prompt)
    det_start_t, det_end_t = _detect_prompt_time_window(prompt)
    now_tr = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    start_time = det_start_t or payload.get("start_time") or "00:00"
    end_time = det_end_t or payload.get("end_time") or "23:59"

    if suggested_period == "last_7_days":
        start_date = (now_tr - datetime.timedelta(days=6)).strftime("%Y-%m-%d")
        end_date = now_tr.strftime("%Y-%m-%d")
    elif suggested_period == "last_30_days":
        start_date = (now_tr - datetime.timedelta(days=29)).strftime("%Y-%m-%d")
        end_date = now_tr.strftime("%Y-%m-%d")
    elif suggested_period == "yesterday":
        y_str = (now_tr - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        start_date = y_str
        end_date = y_str
    elif suggested_period == "today":
        t_str = now_tr.strftime("%Y-%m-%d")
        start_date = t_str
        end_date = t_str

    execution = await execute_custom_report_definition(
        raw_definition=defn,
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        start_time=start_time,
        end_time=end_time,
    )

    return {
        **execution,
        "provider_used": provider_used,
        "model_used": model_used,
        "fallback_used": fallback_used,
        "suggested_period": suggested_period,
        "applied_start_date": start_date,
        "applied_end_date": end_date,
        "applied_start_time": start_time,
        "applied_end_time": end_time,
    }


@ai_copilot_router.get("/api/reports/custom/saved")
async def list_saved_custom_reports(request: Request):
    from backend.main import settings_db

    tenant_id = _extract_tenant_id(request)
    items = [
        r
        for r in (settings_db.get("custom_reports", []) or [])
        if isinstance(r, dict) and _match_dict_tenant(r, tenant_id)
    ]
    return {"reports": items}


@ai_copilot_router.post("/api/reports/custom/saved")
async def save_custom_report_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    from backend.main import save_settings, settings_db

    tenant_id = _extract_tenant_id(request)
    if _is_global_tenant(tenant_id):
        tenant_id = "tenant-default"

    raw_def = payload.get("definition") or payload
    defn = _normalize_report_definition(raw_def)
    rep_id = str(payload.get("id") or "").strip() or f"crep-{int(datetime.datetime.utcnow().timestamp() * 1000)}"
    now_str = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M")

    record = {
        "id": rep_id,
        "tenant_id": tenant_id,
        "title": str(payload.get("title") or defn["title"]).strip(),
        "description": str(payload.get("description") or defn.get("description") or "").strip(),
        "definition": {**defn, "title": str(payload.get("title") or defn["title"]).strip()},
        "created_by": request.headers.get("X-User-ID", "admin"),
        "updated_at": now_str,
    }

    all_reps = list(settings_db.get("custom_reports", []) or [])
    replaced = False
    for idx, ex in enumerate(all_reps):
        if isinstance(ex, dict) and str(ex.get("id")) == rep_id:
            all_reps[idx] = record
            replaced = True
            break
    if not replaced:
        all_reps.insert(0, record)

    settings_db["custom_reports"] = all_reps
    save_settings(settings_db)
    return {"status": "success", "report": record}


@ai_copilot_router.delete("/api/reports/custom/saved/{report_id}")
async def delete_saved_custom_report_endpoint(report_id: str, request: Request):
    from backend.main import save_settings, settings_db

    tenant_id = _extract_tenant_id(request)
    all_reps = list(settings_db.get("custom_reports", []) or [])
    filtered = [
        r
        for r in all_reps
        if not (isinstance(r, dict) and str(r.get("id")) == str(report_id) and _match_dict_tenant(r, tenant_id))
    ]
    settings_db["custom_reports"] = filtered
    save_settings(settings_db)
    return {"status": "success"}


# ============================================================================
# 2. AI KONFİGÜRASYON ASİSTANI (MODULAR FULL-SCOPE ENGINE MOUNT)
# ============================================================================
from backend.services.ai_config_assistant_engine import (  # noqa: E402
    ACTION_PERMISSION_MAP,
    ai_config_assistant_router,
)

ai_copilot_router.include_router(ai_config_assistant_router)
