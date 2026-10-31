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
    AgentBreakLog,
    Appointment,
    BlacklistItem,
    BreakType,
    Call,
    ChatSession,
    PBXQueue,
    QueueSurveyResponse,
    SystemUser,
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


def _to_tr_dt(dt_val: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    if not dt_val:
        return None
    return dt_val + datetime.timedelta(hours=3)

# ============================================================================
# 1. CUSTOM REPORT BUILDER METADATA & SAFE QUERY ENGINE
# ============================================================================

CUSTOM_REPORT_DATASETS: Dict[str, Dict[str, Any]] = {
    "calls": {
        "id": "calls",
        "label": "Çağrı Kayıtları & Performans (CDR & AI)",
        "description": "Gelen, giden ve dahili tüm telefon görüşmeleri, bekleme/konuşma süreleri, duygu analizi ve QA puanları.",
        "default_group_by": "agent",
        "default_metrics": ["total_calls", "answered_calls", "missed_calls", "answer_rate_pct", "total_talk_min", "avg_talk_sec"],
        "dimensions": [
            {"id": "agent", "label": "Temsilci / Dahili Bazlı"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
            {"id": "hour", "label": "Saat Dilimi Bazlı (00:00 - 23:00)"},
            {"id": "status", "label": "Çağrı Durumu Bazlı"},
            {"id": "sentiment", "label": "Müşteri Duygu Durumu Bazlı"},
            {"id": "topic", "label": "Konu / Sonuç Kodu Bazlı"},
            {"id": "callee_did", "label": "Aranan Numara / DID Bazlı"},
            {"id": "direction", "label": "Çağrı Yönü Bazlı (Gelen / Giden / Dahili)"},
            {"id": "hangup_source", "label": "Kapanış / Aktarım Kaynağı Bazlı"},
        ],
        "metrics": [
            {"id": "total_calls", "label": "Toplam Çağrı Adedi", "unit": "adet"},
            {"id": "answered_calls", "label": "Cevaplanan Çağrı Adedi", "unit": "adet"},
            {"id": "missed_calls", "label": "Kaçan / Cevapsız Çağrı Adedi", "unit": "adet"},
            {"id": "answer_rate_pct", "label": "Cevaplanma Oranı (%)", "unit": "%"},
            {"id": "total_talk_min", "label": "Toplam Konuşma Süresi (dk)", "unit": "dk"},
            {"id": "avg_talk_sec", "label": "Ortalama Konuşma Süresi (sn)", "unit": "sn"},
            {"id": "avg_wait_sec", "label": "Ortalama Bekleme Süresi (sn)", "unit": "sn"},
            {"id": "avg_qa_score", "label": "Ortalama Kalite (QA) Puanı", "unit": "puan"},
            {"id": "positive_count", "label": "Olumlu Duygu Adedi", "unit": "adet"},
            {"id": "negative_count", "label": "Olumsuz / Kızgın Duygu Adedi", "unit": "adet"},
            {"id": "unique_callers", "label": "Tekil Arayan Numara Sayısı", "unit": "kişi"},
        ],
        "filter_fields": [
            {"id": "agent", "label": "Temsilci Adı / Dahili", "type": "text"},
            {"id": "direction", "label": "Çağrı Yönü (Gelen / Giden / Dahili)", "type": "text"},
            {"id": "status", "label": "Çağrı Durumu (answered / missed / busy)", "type": "text"},
            {"id": "sentiment", "label": "Duygu Durumu (Olumlu / Nötr / Olumsuz)", "type": "text"},
            {"id": "caller_number", "label": "Arayan Numara", "type": "text"},
            {"id": "callee_number", "label": "Aranan Numara / DID", "type": "text"},
            {"id": "talk_sec", "label": "Konuşma Süresi (sn)", "type": "number"},
            {"id": "wait_sec", "label": "Bekleme Süresi (sn)", "type": "number"},
            {"id": "qa_score", "label": "QA Kalite Puanı", "type": "number"},
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
        "default_metrics": ["total_sessions", "ai_sessions", "human_sessions", "ai_resolution_pct", "avg_qa_score"],
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
            {"id": "ai_resolution_pct", "label": "AI Karşılama Oranı (%)", "unit": "%"},
            {"id": "avg_qa_score", "label": "Ortalama Sohbet QA Puanı", "unit": "puan"},
        ],
        "filter_fields": [
            {"id": "channel", "label": "Kanal (whatsapp / telegram / instagram / email)", "type": "text"},
            {"id": "assigned_agent", "label": "Atanan Birim (ai / human)", "type": "text"},
            {"id": "status", "label": "Durum (open / closed)", "type": "text"},
        ],
    },
    "surveys": {
        "id": "surveys",
        "label": "Müşteri Memnuniyet Anketleri (CSAT)",
        "description": "Kuyruk ve görüşme sonrası tuşlanan 1-5 arası müşteri memnuniyet anket sonuçları.",
        "default_group_by": "queue_name",
        "default_metrics": ["survey_count", "avg_csat_score", "high_sat_pct"],
        "dimensions": [
            {"id": "queue_name", "label": "Kuyruk Adı Bazlı"},
            {"id": "agent_ext", "label": "Temsilci Dahili Bazlı"},
            {"id": "score", "label": "Verilen Puan Bazlı (1-5)"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
        ],
        "metrics": [
            {"id": "survey_count", "label": "Yanıtlanan Anket Adedi", "unit": "adet"},
            {"id": "avg_csat_score", "label": "Ortalama CSAT Puanı (1-5)", "unit": "puan"},
            {"id": "high_sat_pct", "label": "Memnuniyet Oranı (4-5 Puan %)", "unit": "%"},
        ],
        "filter_fields": [
            {"id": "queue_name", "label": "Kuyruk Adı", "type": "text"},
            {"id": "agent_ext", "label": "Temsilci Dahili", "type": "text"},
            {"id": "score", "label": "Anket Puanı (1-5)", "type": "number"},
        ],
    },
    "voip_quality": {
        "id": "voip_quality",
        "label": "VoIP & Ses Kalitesi (MOS / Jitter / Paket Kaybı)",
        "description": "RTP ses paketlerinin MOS skoru, gecikme dalgalanması (jitter) ve paket kaybı analizleri.",
        "default_group_by": "extension",
        "default_metrics": ["sample_count", "avg_mos", "avg_jitter_ms", "avg_packet_loss_pct", "poor_calls_count"],
        "dimensions": [
            {"id": "extension", "label": "Dahili / Hat Bazlı"},
            {"id": "quality_grade", "label": "Kalite Sınıfı Bazlı"},
            {"id": "date", "label": "Günlük Tarih Bazlı"},
        ],
        "metrics": [
            {"id": "sample_count", "label": "Ölçüm Sayısı", "unit": "adet"},
            {"id": "avg_mos", "label": "Ortalama MOS Skoru", "unit": "MOS"},
            {"id": "avg_jitter_ms", "label": "Ortalama Jitter (ms)", "unit": "ms"},
            {"id": "avg_packet_loss_pct", "label": "Ortalama Paket Kaybı (%)", "unit": "%"},
            {"id": "poor_calls_count", "label": "Düşük Kaliteli Çağrı (MOS < 3.6)", "unit": "adet"},
        ],
        "filter_fields": [
            {"id": "extension", "label": "Dahili / Hat", "type": "text"},
            {"id": "mos_score", "label": "MOS Skoru", "type": "number"},
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
        ],
        "metrics": [
            {"id": "total_appointments", "label": "Toplam Randevu Adedi", "unit": "adet"},
            {"id": "confirmed_appointments", "label": "Onaylı Randevu Adedi", "unit": "adet"},
            {"id": "cancelled_appointments", "label": "İptal Edilen Randevu Adedi", "unit": "adet"},
        ],
        "filter_fields": [
            {"id": "status", "label": "Durum (confirmed / cancelled)", "type": "text"},
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
    filters_out = []
    for f_item in raw_def.get("filters") or []:
        if not isinstance(f_item, dict):
            continue
        f_field = str(f_item.get("field") or "").strip()
        f_op = str(f_item.get("op") or "contains").strip().lower()
        f_val = f_item.get("value")
        if f_field in valid_filter_fields and f_op in ("eq", "neq", "contains", "gt", "lt") and f_val not in (None, ""):
            filters_out.append({"field": f_field, "op": f_op, "value": f_val})

    chart_type = str(raw_def.get("chart_type") or "bar").strip().lower()
    if chart_type not in ("bar", "line", "pie", "table"):
        chart_type = "bar"

    sort_by = str(raw_def.get("sort_by") or metrics[0]).strip()
    if sort_by not in valid_metrics and sort_by != "group_key":
        sort_by = metrics[0]

    sort_dir = str(raw_def.get("sort_dir") or "desc").strip().lower()
    if sort_dir not in ("asc", "desc"):
        sort_dir = "desc"

    try:
        limit = max(5, min(500, int(raw_def.get("limit") or 100)))
    except Exception:
        limit = 100

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
        "chart_type": chart_type,
        "sort_by": sort_by,
        "sort_dir": sort_dir,
        "limit": limit,
    }


def _match_record_filters(rec: Dict[str, Any], filters: List[Dict[str, Any]]) -> bool:
    for flt in filters:
        field = flt["field"]
        op = flt["op"]
        target_val = flt["value"]
        actual_val = rec.get(field)

        if op in ("gt", "lt"):
            try:
                a_num = float(actual_val or 0)
                t_num = float(target_val)
                if op == "gt" and not (a_num > t_num):
                    return False
                if op == "lt" and not (a_num < t_num):
                    return False
            except Exception:
                return False
        else:
            a_str = str(actual_val if actual_val is not None else "").strip().lower()
            t_str = str(target_val).strip().lower()
            if op == "eq" and a_str != t_str:
                return False
            if op == "neq" and a_str == t_str:
                return False
            if op == "contains" and t_str not in a_str:
                return False
    return True


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


async def execute_custom_report_definition(
    raw_definition: Dict[str, Any],
    tenant_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    start_time: Optional[str] = "00:00",
    end_time: Optional[str] = "23:59",
) -> Dict[str, Any]:
    defn = _normalize_report_definition(raw_definition)
    ds_id = defn["dataset"]
    group_by = defn["group_by"]
    metrics = defn["metrics"]
    filters = defn["filters"]

    ds_meta = CUSTOM_REPORT_DATASETS[ds_id]
    dim_label = next((d["label"] for d in ds_meta["dimensions"] if d["id"] == group_by), "Grup")
    metric_meta_map = {m["id"]: m for m in ds_meta["metrics"]}

    start_utc, end_utc = _parse_tr_date_range(start_date, end_date, start_time, end_time)
    buckets: Dict[str, List[Dict[str, Any]]] = {}

    async with AsyncSessionLocal() as db:
        if ds_id == "calls":
            stmt_u = _apply_tenant_clause(select(SystemUser), SystemUser, tenant_id)
            users_db = (await db.execute(stmt_u)).scalars().all()
            ext_to_name = {
                str(u.extension).strip(): str(u.full_name or f"Dahili {u.extension}").strip()
                for u in users_db
                if u.extension
            }

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
                if not ag_lbl:
                    if callee_s in ext_to_name:
                        ag_lbl = f"{ext_to_name[callee_s]} ({callee_s})"
                    elif caller_s in ext_to_name:
                        ag_lbl = f"{ext_to_name[caller_s]} ({caller_s})"
                    elif callee_s.isdigit() and len(callee_s) <= 5:
                        ag_lbl = f"Dahili {callee_s}"
                    else:
                        ag_lbl = "AI / Santral Karşılama"

                direction = _infer_call_direction(caller_s, callee_s)
                answered = _is_answered_call(c)
                talk_s = _call_talk_sec(c)
                wait_s = _call_wait_sec(c)
                sent_raw = str(c.sentiment or "Nötr").strip()
                qa_val = c.qa_score if c.qa_score is not None else None

                rec = {
                    "agent": ag_lbl,
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "hour": f"{tr_dt.hour:02d}:00" if tr_dt else "00:00",
                    "status": "Cevaplandı" if answered else (str(c.status or "Cevapsız").strip() or "Cevapsız"),
                    "sentiment": sent_raw or "Nötr",
                    "topic": str(c.agent_topic or "Genel Görüşme").strip() or "Genel Görüşme",
                    "callee_did": callee_s or "-",
                    "direction": direction,
                    "hangup_source": str(c.hangup_source or "Normal Kapanış").strip() or "Normal Kapanış",
                    "caller_number": caller_s,
                    "callee_number": callee_s,
                    "answered": answered,
                    "talk_sec": talk_s,
                    "wait_sec": wait_s,
                    "qa_score": float(qa_val) if qa_val is not None else None,
                }
                if not _match_record_filters(rec, filters):
                    continue
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
                    "duration_min": dur_min,
                }
                if not _match_record_filters(rec, filters):
                    continue
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
                rec = {
                    "channel": str(s.channel or "whatsapp").strip().upper(),
                    "assigned_agent": "AI Asistan" if assigned == "ai" else f"Temsilci ({s.assigned_agent})",
                    "is_ai": assigned == "ai",
                    "status": str(s.status or "open").strip(),
                    "recipient_line": str(getattr(s, "recipient_info", "") or "Varsayılan Hat").strip() or "Varsayılan Hat",
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "qa_score": float(s.qa_score) if getattr(s, "qa_score", None) is not None else None,
                }
                if not _match_record_filters(rec, filters):
                    continue
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
                rec = {
                    "queue_name": str(sv.queue_name or sv.queue_number or "Genel Kuyruk").strip(),
                    "agent_ext": str(sv.agent_ext or "Belirtilmemiş").strip(),
                    "score": sc_val,
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                }
                if not _match_record_filters(rec, filters):
                    continue
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
                rec = {
                    "extension": str(q.extension or q.caller or "Genel Hat").strip(),
                    "quality_grade": grade,
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "mos_score": mos,
                    "jitter_ms": float(q.jitter_ms or 0),
                    "packet_loss_pct": float(q.packet_loss_pct or 0),
                }
                if not _match_record_filters(rec, filters):
                    continue
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

        elif ds_id == "appointments":
            stmt = _apply_tenant_clause(
                select(Appointment).where(Appointment.appointment_date >= start_utc, Appointment.appointment_date <= end_utc),
                Appointment,
                tenant_id,
            )
            ap_rows = (await db.execute(stmt)).scalars().all()
            for ap in ap_rows:
                tr_dt = _to_tr_dt(ap.appointment_date)
                st_str = str(ap.status or "confirmed").strip().lower()
                rec = {
                    "date": tr_dt.strftime("%Y-%m-%d") if tr_dt else "-",
                    "status": "İptal Edildi" if st_str == "cancelled" else "Onaylandı",
                    "raw_status": st_str,
                }
                if not _match_record_filters(rec, filters):
                    continue
                g_key = str(rec.get(group_by) or "Belirtilmemiş")
                buckets.setdefault(g_key, []).append(rec)

    rows_out: List[Dict[str, Any]] = []
    total_records_matched = 0

    for g_key, items in buckets.items():
        total_records_matched += len(items)
        row: Dict[str, Any] = {"group_key": g_key}

        if ds_id == "calls":
            tot = len(items)
            ans = sum(1 for x in items if x["answered"])
            missed = tot - ans
            ans_pct = round((ans / tot) * 100.0, 1) if tot > 0 else 0.0
            talk_sum_sec = sum(float(x["talk_sec"] or 0) for x in items)
            wait_sum_sec = sum(float(x["wait_sec"] or 0) for x in items)
            qa_vals = [x["qa_score"] for x in items if x["qa_score"] is not None]
            pos_cnt = sum(1 for x in items if any(w in x["sentiment"].lower() for w in ("olumlu", "memnun", "positive", "mutlu")))
            neg_cnt = sum(1 for x in items if any(w in x["sentiment"].lower() for w in ("olumsuz", "kızgın", "negative", "gergin", "şikayet")))
            uniq_c = len({x["caller_number"] for x in items if x["caller_number"]})

            computed = {
                "total_calls": tot,
                "answered_calls": ans,
                "missed_calls": missed,
                "answer_rate_pct": ans_pct,
                "total_talk_min": round(talk_sum_sec / 60.0, 1),
                "avg_talk_sec": round(talk_sum_sec / ans, 1) if ans > 0 else 0.0,
                "avg_wait_sec": round(wait_sum_sec / tot, 1) if tot > 0 else 0.0,
                "avg_qa_score": round(sum(qa_vals) / len(qa_vals), 1) if qa_vals else 0.0,
                "positive_count": pos_cnt,
                "negative_count": neg_cnt,
                "unique_callers": uniq_c,
            }
        elif ds_id == "breaks":
            cnt = len(items)
            durs = [float(x["duration_min"] or 0) for x in items]
            computed = {
                "break_count": cnt,
                "total_break_min": round(sum(durs), 1),
                "avg_break_min": round(sum(durs) / cnt, 1) if cnt > 0 else 0.0,
                "max_break_min": round(max(durs), 1) if durs else 0.0,
            }
        elif ds_id == "omnichannel":
            tot = len(items)
            ai_c = sum(1 for x in items if x["is_ai"])
            hum_c = tot - ai_c
            qas = [x["qa_score"] for x in items if x["qa_score"] is not None]
            computed = {
                "total_sessions": tot,
                "ai_sessions": ai_c,
                "human_sessions": hum_c,
                "ai_resolution_pct": round((ai_c / tot) * 100.0, 1) if tot > 0 else 0.0,
                "avg_qa_score": round(sum(qas) / len(qas), 1) if qas else 0.0,
            }
        elif ds_id == "surveys":
            cnt = len(items)
            scores = [int(x["score"] or 0) for x in items]
            high_c = sum(1 for sc in scores if sc >= 4)
            computed = {
                "survey_count": cnt,
                "avg_csat_score": round(sum(scores) / cnt, 2) if cnt > 0 else 0.0,
                "high_sat_pct": round((high_c / cnt) * 100.0, 1) if cnt > 0 else 0.0,
            }
        elif ds_id == "voip_quality":
            cnt = len(items)
            mos_l = [x["mos_score"] for x in items]
            jit_l = [x["jitter_ms"] for x in items]
            pl_l = [x["packet_loss_pct"] for x in items]
            poor_c = sum(1 for m in mos_l if m < 3.6)
            computed = {
                "sample_count": cnt,
                "avg_mos": round(sum(mos_l) / cnt, 2) if cnt > 0 else 0.0,
                "avg_jitter_ms": round(sum(jit_l) / cnt, 1) if cnt > 0 else 0.0,
                "avg_packet_loss_pct": round(sum(pl_l) / cnt, 2) if cnt > 0 else 0.0,
                "poor_calls_count": poor_c,
            }
        else:
            tot = len(items)
            canc = sum(1 for x in items if x["raw_status"] == "cancelled")
            computed = {
                "total_appointments": tot,
                "confirmed_appointments": tot - canc,
                "cancelled_appointments": canc,
            }

        for m_id in metrics:
            row[m_id] = computed.get(m_id, 0)
        rows_out.append(row)

    sort_key = defn["sort_by"]
    reverse_sort = defn["sort_dir"] == "desc"
    if sort_key == "group_key" or group_by in ("date", "hour"):
        rows_out.sort(key=lambda r: str(r.get("group_key") or ""), reverse=(reverse_sort if sort_key == "group_key" else False))
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
        vals = [float(r.get(m_id) or 0) for r in rows_out]
        if not vals:
            agg_val = 0
        elif m_id.startswith("avg_") or m_id.endswith("_pct"):
            agg_val = round(sum(vals) / len(vals), 1)
        elif m_id.startswith("max_"):
            agg_val = round(max(vals), 1)
        else:
            agg_val = round(sum(vals), 1) if any(isinstance(r.get(m_id), float) for r in rows_out) else int(sum(vals))
        summary_cards.append({"label": m_info.get("label", m_id), "value": agg_val, "unit": m_info.get("unit", "")})

    return {
        "definition": defn,
        "columns": columns,
        "rows": rows_out,
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
        group_by = "break_name" if "tür" in p or "tip" in p else ("date" if "gün" in p else "agent")
        metrics = ["break_count", "total_break_min", "avg_break_min", "max_break_min"]
        title = "Temsilci Mola & Süre Analizi"
    elif any(k in p for k in ("whatsapp", "omnichannel", "yazılı", "telegram", "instagram", "sohbet", "mesaj")):
        dataset = "omnichannel"
        group_by = "date" if "gün" in p else ("assigned_agent" if "temsilci" in p else "channel")
        metrics = ["total_sessions", "ai_sessions", "human_sessions", "ai_resolution_pct", "avg_qa_score"]
        title = "Omnichannel Kanal & AI Karşılama Raporu"
    elif any(k in p for k in ("anket", "csat", "memnuniyet puan")):
        dataset = "surveys"
        group_by = "agent_ext" if "temsilci" in p or "dahili" in p else "queue_name"
        metrics = ["survey_count", "avg_csat_score", "high_sat_pct"]
        title = "Müşteri Memnuniyet Anketi (CSAT) Raporu"
    elif any(k in p for k in ("mos", "jitter", "paket kaybı", "voip", "ses kalitesi")):
        dataset = "voip_quality"
        group_by = "quality_grade" if "sınıf" in p else "extension"
        metrics = ["sample_count", "avg_mos", "avg_jitter_ms", "avg_packet_loss_pct", "poor_calls_count"]
        title = "VoIP Ses Kalitesi & MOS Raporu"
    elif any(k in p for k in ("randevu", "appointment")):
        dataset = "appointments"
        group_by = "status" if "durum" in p else "date"
        metrics = ["total_appointments", "confirmed_appointments", "cancelled_appointments"]
        title = "AI Randevu Dağılım Raporu"
    else:
        dataset = "calls"
        if "saat" in p:
            group_by = "hour"
            title = "Saatlik Çağrı Yoğunluk & Performans Raporu"
        elif any(k in p for k in ("günlük", "tarih", "gün bazlı", "trend")):
            group_by = "date"
            title = "Günlük Çağrı Trend Raporu"
        elif any(k in p for k in ("duygu", "kızgın", "memnun", "sentiment")):
            group_by = "sentiment"
            title = "Müşteri Duygu Durumu Dağılım Raporu"
        elif any(k in p for k in ("did", "aranan numara", "hat bazlı")):
            group_by = "callee_did"
            title = "Aranan Hat (DID) Trafik Raporu"
        elif any(k in p for k in ("konu", "sonuç kodu", "niyet")):
            group_by = "topic"
            title = "Çağrı Konusu & Sonuç Kodu Raporu"
        elif any(k in p for k in ("yön", "gelen giden")):
            group_by = "direction"
            title = "Çağrı Yönü Dağılım Raporu"
        else:
            group_by = "agent"
            title = "Temsilci Çağrı Performans Raporu"

        metrics = ["total_calls", "answered_calls", "missed_calls", "answer_rate_pct", "total_talk_min", "avg_talk_sec"]
        if any(k in p for k in ("kalite", "qa", "puan")):
            metrics.append("avg_qa_score")
        if any(k in p for k in ("duygu", "olumsuz", "kızgın", "olumlu")):
            metrics.extend(["positive_count", "negative_count"])
        if "bekleme" in p:
            metrics.append("avg_wait_sec")

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

    if "pasta" in p or "dağılım" in p:
        chart_type = "pie"
    elif "çizgi" in p or "trend" in p or group_by in ("date", "hour"):
        chart_type = "line"
    elif "sadece tablo" in p:
        chart_type = "table"
    else:
        chart_type = "bar"

    return _normalize_report_definition(
        {
            "title": title,
            "description": prompt.strip(),
            "dataset": dataset,
            "group_by": group_by,
            "metrics": metrics,
            "filters": filters,
            "chart_type": chart_type,
        }
    )


def _detect_prompt_date_period(prompt: str) -> Optional[str]:
    p = (prompt or "").lower()
    if "son 30" in p or "bu ay" in p or "aylık" in p:
        return "last_30_days"
    if "son 7" in p or "bu hafta" in p or "haftalık" in p or "geçen hafta" in p:
        return "last_7_days"
    if "dün" in p:
        return "yesterday"
    if "bugün" in p:
        return "today"
    return None


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
        "Kullanıcının Türkçe doğal dildeki rapor isteğini aşağıdaki veri kaynakları ve metrik şemasına uygun SADECE geçerli bir JSON nesnesine dönüştür.\n"
        f"ŞEMA: {json.dumps(schema_summary, ensure_ascii=False)}\n"
        "JSON FORMATI:\n"
        '{"title": "Rapor Başlığı", "dataset": "calls|breaks|omnichannel|surveys|voip_quality|appointments", '
        '"group_by": "boyut_id", "metrics": ["metrik1", "metrik2"], '
        '"filters": [{"field": "alan", "op": "eq|neq|contains|gt|lt", "value": "değer"}], '
        '"chart_type": "bar|line|pie|table", "sort_by": "metrik1", "sort_dir": "desc"}\n'
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
    now_tr = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
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
        start_time=payload.get("start_time") or "00:00",
        end_time=payload.get("end_time") or "23:59",
    )

    return {
        **execution,
        "provider_used": provider_used,
        "model_used": model_used,
        "fallback_used": fallback_used,
        "suggested_period": suggested_period,
        "applied_start_date": start_date,
        "applied_end_date": end_date,
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
# 2. AI KONFİGÜRASYON ASİSTANI (DRY-RUN PLANNER, RBAC, EXECUTOR & UNDO)
# ============================================================================

ACTION_PERMISSION_MAP: Dict[str, Tuple[str, str]] = {
    "create_user": ("users:write", "Kullanıcı & Dahili Oluşturma"),
    "create_queue": ("acd_queues:write", "ACD Çağrı Kuyruğu Oluşturma"),
    "add_queue_members": ("acd_queues:write", "Kuyruğa Temsilci Atama"),
    "create_conference": ("conferences:write", "Konferans Odası Oluşturma"),
    "add_blacklist": ("blacklist:write", "Kara Liste Numara Engelleme"),
    "create_inbound_rule": ("inbound_rules:write", "Gelen Arama (DID) Kuralı Oluşturma"),
    "update_user_forwarding": ("users:write", "Abone Çağrı Yönlendirme & GSM Ayarı"),
    "create_scheduled_report": ("scheduled_reports:write", "Zamanlanmış Rapor Planlama"),
    "create_break_type": ("breaks:write", "Mola Tanımı Ekleme"),
}


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
            stmt = select(SystemUser)
            users_db = (await db.execute(stmt)).scalars().all()
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


async def _gather_pbx_context(tenant_id: str) -> Dict[str, Any]:
    from backend.main import settings_db

    used_extensions = set()
    users_summary = []
    queues_summary = []

    try:
        async with AsyncSessionLocal() as db:
            u_rows = (await db.execute(_apply_tenant_clause(select(SystemUser), SystemUser, tenant_id))).scalars().all()
            for u in u_rows:
                ext = str(u.extension or "").strip()
                if ext:
                    used_extensions.add(ext)
                users_summary.append({"id": u.id, "extension": ext, "full_name": u.full_name or "", "role": u.role or "agent"})

            q_rows = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
            for q in q_rows:
                ext = str(q.extension or "").strip()
                if ext:
                    used_extensions.add(ext)
                queues_summary.append({"id": q.id, "extension": ext, "name": q.name or ""})
    except Exception:
        pass

    for u in settings_db.get("users", []) or []:
        if isinstance(u, dict) and u.get("extension"):
            used_extensions.add(str(u["extension"]).strip())
    for q in settings_db.get("queues", []) or []:
        if isinstance(q, dict) and (q.get("extension") or q.get("queue_number")):
            used_extensions.add(str(q.get("extension") or q.get("queue_number")).strip())
    for c in settings_db.get("conferences", []) or []:
        if isinstance(c, dict) and (c.get("room_number") or c.get("extension")):
            used_extensions.add(str(c.get("room_number") or c.get("extension")).strip())

    confs_summary = [
        {"room_number": str(c.get("room_number") or c.get("extension") or ""), "name": c.get("name") or ""}
        for c in (settings_db.get("conferences", []) or [])
        if isinstance(c, dict) and _match_dict_tenant(c, tenant_id)
    ]

    return {
        "used_extensions": used_extensions,
        "users": users_summary[:60],
        "queues": queues_summary[:30],
        "conferences": confs_summary[:20],
    }


def _next_free_number(used: set, start: int, end: int) -> str:
    for n in range(start, end + 1):
        s = str(n)
        if s not in used:
            used.add(s)
            return s
    return str(start)


def _parse_config_prompt_semantically(prompt: str, ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Deterministic Turkish NLP fallback parser for multi-step PBX configuration prompts."""
    text = (prompt or "").strip()
    low = text.lower()
    used = set(ctx.get("used_extensions") or set())
    actions: List[Dict[str, Any]] = []
    batch_created_exts: List[str] = []

    # 1. Blacklist detection
    if any(k in low for k in ("kara liste", "engelle", "blokla", "spam", "yasakla")):
        phones = re.findall(r"(?:\+?90|0)?\s*5\d{2}[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}|\b0?(?:850|212|216|312|232|224)\d{7}\b", text)
        for ph in phones:
            clean_ph = re.sub(r"[^\d+]", "", ph)
            actions.append(
                {
                    "type": "add_blacklist",
                    "params": {
                        "type": "phone",
                        "value": clean_ph,
                        "reason": "AI Konfigürasyon Asistanı ile engellendi",
                    },
                }
            )

    # 2. User / Extension creation detection
    if any(k in low for k in ("dahili", "kullanıcı", "temsilci", "abone", "personel")) and any(
        k in low for k in ("oluştur", "ekle", "aç", "tanımla", "kur")
    ):
        # Check explicit Name + Extension pairs or comma-separated names or count
        explicit_ext_matches = re.findall(
            r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)+)\s*(?:\(?(\d{3,4})\)?)?",
            text,
        )
        filtered_names = [
            (nm.strip(), ex.strip())
            for nm, ex in explicit_ext_matches
            if nm.lower() not in ("ai konfigürasyon", "çağrı kuyruğu", "satış kuyruğu", "destek kuyruğu", "konferans odası")
        ]

        count_match = re.search(r"(\d+)\s*(?:adet|tane|yeni)?\s*(?:dahili|kullanıcı|temsilci|abone)", low)
        role_hint = "supervisor" if ("şef" in low or "süpervizör" in low or "supervisor" in low) else "agent"
        dept_hint = "Satış" if "satış" in low else ("Destek" if "destek" in low or "teknik" in low else ("Muhasebe" if "muhasebe" in low else ""))

        if filtered_names:
            for nm, ex in filtered_names[:15]:
                ext_final = ex if (ex and ex not in used) else _next_free_number(used, 1001, 1999)
                used.add(ext_final)
                batch_created_exts.append(ext_final)
                actions.append(
                    {
                        "type": "create_user",
                        "params": {
                            "full_name": nm,
                            "extension": ext_final,
                            "role": role_hint,
                            "department": dept_hint,
                        },
                    }
                )
        elif count_match:
            cnt = max(1, min(20, int(count_match.group(1))))
            prefix_lbl = dept_hint or "Temsilci"
            for i in range(1, cnt + 1):
                ext_final = _next_free_number(used, 1001, 1999)
                batch_created_exts.append(ext_final)
                actions.append(
                    {
                        "type": "create_user",
                        "params": {
                            "full_name": f"{prefix_lbl} {i}",
                            "extension": ext_final,
                            "role": role_hint,
                            "department": dept_hint,
                        },
                    }
                )
        else:
            ext_m = re.search(r"\b(1\d{3})\b", low)
            ext_final = ext_m.group(1) if (ext_m and ext_m.group(1) not in used) else _next_free_number(used, 1001, 1999)
            used.add(ext_final)
            batch_created_exts.append(ext_final)
            actions.append(
                {
                    "type": "create_user",
                    "params": {
                        "full_name": f"{dept_hint + ' ' if dept_hint else ''}Temsilcisi ({ext_final})",
                        "extension": ext_final,
                        "role": role_hint,
                        "department": dept_hint,
                    },
                }
            )

    # 3. Queue creation or member assignment
    if "kuyruk" in low or "kuyruğ" in low:
        strat = "rrmemory"
        if "hepsi" in low or "aynı anda" in low or "ringall" in low:
            strat = "ringall"
        elif "en az konuşan" in low or "fewest" in low:
            strat = "fewestcalls"
        elif "en uzun" in low or "leastrecent" in low:
            strat = "leastrecent"

        q_ext_m = re.search(r"\b(2\d{3}|8\d{2,3})\b", low)
        q_ext = q_ext_m.group(1) if (q_ext_m and q_ext_m.group(1) not in used) else _next_free_number(used, 2000, 2999)
        used.add(q_ext)

        if "satış" in low:
            q_name = "Satış Kuyruğu"
        elif "destek" in low or "teknik" in low:
            q_name = "Teknik Destek Kuyruğu"
        elif "muhasebe" in low or "finans" in low:
            q_name = "Muhasebe Kuyruğu"
        elif "vip" in low:
            q_name = "VIP Müşteri Kuyruğu"
        else:
            q_name = f"Çağrı Kuyruğu {q_ext}"

        explicit_member_exts = re.findall(r"\b(1\d{2,3})\b", low)
        members = list(dict.fromkeys(batch_created_exts + explicit_member_exts))

        actions.append(
            {
                "type": "create_queue",
                "params": {
                    "name": q_name,
                    "extension": q_ext,
                    "strategy": strat,
                    "timeout": 20,
                    "members": members,
                },
            }
        )

    # 4. Conference Room creation
    if "konferans" in low or "toplantı odası" in low:
        c_ext_m = re.search(r"\b(3\d{3})\b", low)
        c_ext = c_ext_m.group(1) if (c_ext_m and c_ext_m.group(1) not in used) else _next_free_number(used, 3000, 3999)
        used.add(c_ext)
        pin_m = re.search(r"(?:pin|şifre)\s*[:=]?\s*(\d{4,6})", low)
        pin_val = pin_m.group(1) if pin_m else ""
        actions.append(
            {
                "type": "create_conference",
                "params": {
                    "name": "Yönetim Toplantı Odası" if "yönetim" in low else f"Konferans Odası {c_ext}",
                    "room_number": c_ext,
                    "pin": pin_val,
                },
            }
        )

    # 5. Subscriber Call Forwarding / GSM
    if any(k in low for k in ("yönlendir", "cep telefonuna", "gsm", "follow-me", "meşgulde", "cevapsızda")):
        ext_m = re.search(r"\b(1\d{2,3})\b", low)
        gsm_m = re.search(r"(?:\+?90|0)?\s*5\d{2}[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}", text)
        if ext_m:
            target_num = re.sub(r"[^\d+]", "", gsm_m.group(0)) if gsm_m else ""
            other_exts = [e for e in re.findall(r"\b(1\d{2,3}|2\d{3})\b", low) if e != ext_m.group(1)]
            if not target_num and other_exts:
                target_num = other_exts[0]
            if target_num:
                mode = "always" if ("her zaman" in low or "tüm çağrı" in low) else ("busy" if "meşgul" in low else "no_answer")
                actions.append(
                    {
                        "type": "update_user_forwarding",
                        "params": {
                            "extension": ext_m.group(1),
                            "mode": mode,
                            "target": target_num,
                            "timeout": 20,
                            "active": True,
                        },
                    }
                )

    # 6. Inbound DID Rule
    if ("gelen arama" in low or "did" in low or "0850" in low or "0212" in low or "0216" in low) and any(
        k in low for k in ("kural", "bağla", "aktar", "rotala")
    ):
        did_m = re.search(r"\b(\+?90?(?:850|212|216|312)\d{7}|0(?:850|212|216|312)\d{7})\b", re.sub(r"[\s\-]", "", text))
        dest_m = re.search(r"\b([123]\d{3})\b", low)
        did_str = did_m.group(1) if did_m else "08503600000"
        dest_str = dest_m.group(1) if dest_m else (batch_created_exts[0] if batch_created_exts else "2000")
        dest_type = "queue" if dest_str.startswith("2") else ("conference" if dest_str.startswith("3") else "extension")
        actions.append(
            {
                "type": "create_inbound_rule",
                "params": {
                    "name": f"DID {did_str} Rotası",
                    "did_number": did_str,
                    "destination_type": dest_type,
                    "destination_target": dest_str,
                },
            }
        )

    # 7. Scheduled Report
    if "zamanlanmış rapor" in low or ("rapor" in low and any(k in low for k in ("her sabah", "her gün", "her pazartesi", "haftalık", "e-posta", "mail"))):
        freq = "weekly" if ("hafta" in low or "pazartesi" in low) else ("monthly" if "aylık" in low else "daily")
        tm_m = re.search(r"\b([01]?\d|2[0-3])[:\.]([0-5]\d)\b", low)
        send_time = f"{int(tm_m.group(1)):02d}:{tm_m.group(2)}" if tm_m else "09:00"
        mails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        actions.append(
            {
                "type": "create_scheduled_report",
                "params": {
                    "name": "AI Otomatik Yönetici Özeti",
                    "frequency": freq,
                    "send_time": send_time,
                    "period_range": "last_7_days" if freq == "weekly" else "yesterday",
                    "report_types": ["reports_pano", "reports_cdr", "reports_perf", "reports_queue_sla"],
                    "extra_emails": ", ".join(mails),
                },
            }
        )

    # 8. Break Type
    if "mola tanım" in low or ("mola" in low and any(k in low for k in ("ekle", "oluştur", "tanımla")) and "rapor" not in low):
        actions.append(
            {
                "type": "create_break_type",
                "params": {
                    "name": "Eğitim Molası" if "eğitim" in low else ("Namaz / İbadet Molası" if "namaz" in low else "Kısa Dinlenme Molası"),
                    "max_duration_minutes": 30 if "30" in low else 15,
                },
            }
        )

    return actions


def _validate_and_enrich_plan_actions(
    raw_actions: List[Dict[str, Any]],
    ctx: Dict[str, Any],
    is_admin: bool,
    perms: set,
) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    used_exts = set(ctx.get("used_extensions") or set())
    planned_exts_in_batch = set()
    enriched: List[Dict[str, Any]] = []
    warnings: List[str] = []
    perm_blocks: List[str] = []

    for idx, act in enumerate(raw_actions):
        if not isinstance(act, dict):
            continue
        a_type = str(act.get("type") or "").strip()
        if a_type not in ACTION_PERMISSION_MAP:
            continue
        params = dict(act.get("params") or {})
        perm_code, type_label = ACTION_PERMISSION_MAP[a_type]
        allowed = _has_perm(is_admin, perms, perm_code)
        if not allowed:
            perm_blocks.append(f"'{type_label}' işlemi için '{perm_code}' yetkiniz bulunmuyor.")

        conflict_note = None
        summary = ""

        if a_type == "create_user":
            req_ext = str(params.get("extension") or "").strip()
            if not req_ext or not req_ext.isdigit():
                req_ext = _next_free_number(used_exts | planned_exts_in_batch, 1001, 1999)
                params["extension"] = req_ext
            elif req_ext in used_exts or req_ext in planned_exts_in_batch:
                alt_ext = _next_free_number(used_exts | planned_exts_in_batch, 1001, 1999)
                conflict_note = f"İstenen {req_ext} dahilisi dolu olduğu için otomatik olarak {alt_ext} boş dahilisine çekildi."
                warnings.append(conflict_note)
                params["extension"] = alt_ext
            planned_exts_in_batch.add(params["extension"])
            params["full_name"] = str(params.get("full_name") or f"Temsilci {params['extension']}").strip()
            params["role"] = str(params.get("role") or "agent").strip()
            if params["role"] not in ("agent", "supervisor", "admin"):
                params["role"] = "agent"
            summary = f"Yeni Dahili/Kullanıcı: {params['full_name']} (Dahili: {params['extension']}, Rol: {params['role']})"

        elif a_type == "create_queue":
            req_ext = str(params.get("extension") or "").strip()
            if not req_ext or not req_ext.isdigit():
                req_ext = _next_free_number(used_exts | planned_exts_in_batch, 2000, 2999)
                params["extension"] = req_ext
            elif req_ext in used_exts or req_ext in planned_exts_in_batch:
                alt_ext = _next_free_number(used_exts | planned_exts_in_batch, 2000, 2999)
                conflict_note = f"İstenen {req_ext} kuyruk numarası dolu olduğu için otomatik olarak {alt_ext} numarasına çekildi."
                warnings.append(conflict_note)
                params["extension"] = alt_ext
            planned_exts_in_batch.add(params["extension"])
            params["name"] = str(params.get("name") or f"Kuyruk {params['extension']}").strip()
            params["strategy"] = str(params.get("strategy") or "rrmemory").strip()
            members = [str(m).strip() for m in (params.get("members") or []) if str(m).strip()]
            params["members"] = members
            mem_txt = f", Üyeler: {', '.join(members)}" if members else ", Üye: Sonradan atanacak"
            summary = f"Yeni ACD Kuyruğu: {params['name']} (No: {params['extension']}, Strateji: {params['strategy']}{mem_txt})"

        elif a_type == "add_queue_members":
            q_target = str(params.get("queue") or params.get("extension") or "").strip()
            members = [str(m).strip() for m in (params.get("members") or []) if str(m).strip()]
            params["queue"] = q_target
            params["members"] = members
            summary = f"Kuyruğa Üye Ekleme: Kuyruk '{q_target}' ← {', '.join(members) or '-'}"

        elif a_type == "create_conference":
            req_room = str(params.get("room_number") or params.get("extension") or "").strip()
            if not req_room or not req_room.isdigit():
                req_room = _next_free_number(used_exts | planned_exts_in_batch, 3000, 3999)
            elif req_room in used_exts or req_room in planned_exts_in_batch:
                alt_room = _next_free_number(used_exts | planned_exts_in_batch, 3000, 3999)
                conflict_note = f"İstenen {req_room} oda numarası dolu olduğu için {alt_room} atandı."
                warnings.append(conflict_note)
                req_room = alt_room
            planned_exts_in_batch.add(req_room)
            params["room_number"] = req_room
            params["name"] = str(params.get("name") or f"Konferans {req_room}").strip()
            params["pin"] = str(params.get("pin") or "").strip()
            pin_lbl = f", PIN: {params['pin']}" if params["pin"] else ", Şifresiz"
            summary = f"Yeni Konferans Odası: {params['name']} (Oda No: {req_room}{pin_lbl})"

        elif a_type == "add_blacklist":
            val = str(params.get("value") or "").strip()
            params["value"] = val
            params["type"] = "email" if "@" in val else "phone"
            params["reason"] = str(params.get("reason") or "AI Konfigürasyon Asistanı").strip()
            summary = f"Kara Liste Engelleme: {val} ({params['reason']})"

        elif a_type == "create_inbound_rule":
            did = str(params.get("did_number") or "").strip()
            dest_t = str(params.get("destination_type") or "queue").strip()
            dest_v = str(params.get("destination_target") or "").strip()
            params["name"] = str(params.get("name") or f"DID {did} Kuralı").strip()
            summary = f"Gelen Arama (DID) Kuralı: {did} → {dest_t.upper()} ({dest_v})"

        elif a_type == "update_user_forwarding":
            ext = str(params.get("extension") or "").strip()
            mode = str(params.get("mode") or "no_answer").strip()
            target = str(params.get("target") or "").strip()
            mode_tr = {"always": "Her Zaman", "busy": "Meşgulde", "no_answer": "Cevapsızda"}.get(mode, "Cevapsızda")
            summary = f"Çağrı Yönlendirme: Dahili {ext} ({mode_tr}) → {target}"

        elif a_type == "create_scheduled_report":
            nm = str(params.get("name") or "Otomatik Yönetici Raporu").strip()
            freq = str(params.get("frequency") or "daily").strip()
            tm = str(params.get("send_time") or "09:00").strip()
            summary = f"Zamanlanmış Rapor: {nm} ({freq} - Saat {tm})"

        elif a_type == "create_break_type":
            nm = str(params.get("name") or "Özel Mola").strip()
            mx = int(params.get("max_duration_minutes") or 15)
            params["name"] = nm
            params["max_duration_minutes"] = mx
            summary = f"Yeni Mola Tanımı: {nm} (Maks. {mx} dk)"

        enriched.append(
            {
                "action_id": f"act-{idx + 1}",
                "type": a_type,
                "type_label": type_label,
                "required_permission": perm_code,
                "allowed": allowed,
                "conflict_note": conflict_note,
                "summary": summary,
                "params": params,
            }
        )

    return enriched, warnings, perm_blocks


@ai_copilot_router.post("/api/ai-config-assistant/plan")
async def create_ai_config_plan_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    from backend.services.ai_task_router import generate_routed_text, get_ai_task_routing_config

    tenant_id = _extract_tenant_id(request)
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Lütfen uygulanmasını istediğiniz santral konfigürasyonunu yazın veya dikte edin.")

    user_label, role_code, is_admin, perms = await _resolve_request_user_permissions(request, tenant_id)
    if not _has_perm(is_admin, perms, "ai_config_assistant:read") and not _has_perm(is_admin, perms, "ai_config_assistant:write"):
        raise HTTPException(status_code=403, detail="AI Konfigürasyon Asistanı görüntüleme yetkiniz bulunmuyor.")

    ctx = await _gather_pbx_context(tenant_id)
    ai_cfg = get_ai_task_routing_config(tenant_id)

    sys_inst = (
        "Sen AIDA IP Santral ve AI Çağrı Merkezi sisteminin 'AI Konfigürasyon Asistanı'sın.\n"
        "Yöneticinin doğal dildeki santral kurulum/değişiklik isteğini SADECE geçerli bir JSON eylem planına dönüştür.\n"
        f"Mevcut Dolu Numaralar: {sorted(list(ctx['used_extensions']))[:80]}\n"
        f"Mevcut Kuyruklar: {json.dumps(ctx['queues'], ensure_ascii=False)}\n"
        "Desteklenen action type şemaları:\n"
        '1. {"type": "create_user", "params": {"full_name": "Ad Soyad", "extension": "1005", "role": "agent|supervisor", "email": "", "gsm_number": "", "department": "Satış"}}\n'
        '2. {"type": "create_queue", "params": {"name": "Satış Kuyruğu", "extension": "2001", "strategy": "rrmemory|ringall|leastrecent|fewestcalls", "timeout": 20, "members": ["1005", "1006"]}}\n'
        '3. {"type": "add_queue_members", "params": {"queue": "2000", "members": ["1005"]}}\n'
        '4. {"type": "create_conference", "params": {"name": "Toplantı Odası", "room_number": "3001", "pin": "1234"}}\n'
        '5. {"type": "add_blacklist", "params": {"value": "05320000000", "reason": "Spam numara"}}\n'
        '6. {"type": "create_inbound_rule", "params": {"name": "Ana Hat", "did_number": "08503607390", "destination_type": "queue|extension|conference", "destination_target": "2001"}}\n'
        '7. {"type": "update_user_forwarding", "params": {"extension": "1001", "mode": "always|busy|no_answer", "target": "05321112233", "timeout": 20, "active": true}}\n'
        '8. {"type": "create_scheduled_report", "params": {"name": "Haftalık Rapor", "frequency": "daily|weekly|monthly", "send_time": "09:00", "period_range": "yesterday|last_7_days", "report_types": ["reports_pano", "reports_cdr"], "extra_emails": "yonetici@firma.com"}}\n'
        '9. {"type": "create_break_type", "params": {"name": "Eğitim Molası", "max_duration_minutes": 20}}\n'
        'ÇIKTI FORMATI: {"explanation": "Kısa Türkçe özet", "actions": [ ... ]}\n'
        "Sadece JSON döndür."
    )

    provider_used = "semantic_engine"
    model_used = "Yerleşik Türkçe Komut Çözümleyici"
    fallback_used = False
    explanation = "Komutunuz analiz edildi ve santral güvenlik/çakışma kontrollerinden geçirilerek taslak plan hazırlandı."
    raw_actions: List[Dict[str, Any]] = []

    try:
        llm_res = await generate_routed_text(
            task_id="pbx_config_assistant",
            prompt=prompt,
            system_instruction=sys_inst,
            json_mode=True,
            tenant_id=tenant_id,
            interactive=True,
        )
        parsed = _extract_json_dict(llm_res.get("text") or "")
        if parsed and isinstance(parsed.get("actions"), list) and len(parsed["actions"]) > 0:
            raw_actions = parsed["actions"]
            if parsed.get("explanation"):
                explanation = str(parsed["explanation"]).strip()
            provider_used = str(llm_res.get("provider_used") or "gemini")
            model_used = str(llm_res.get("model_used") or "")
            fallback_used = bool(llm_res.get("fallback_used", False))
    except Exception as e_plan:
        print(f"[AIConfigAssistant Plan Fallback Notice]: {e_plan}")

    if not raw_actions:
        raw_actions = _parse_config_prompt_semantically(prompt, ctx)
        fallback_used = True

    actions, warnings, perm_blocks = _validate_and_enrich_plan_actions(raw_actions, ctx, is_admin, perms)

    return {
        "prompt": prompt,
        "explanation": explanation,
        "actions": actions,
        "warnings": warnings,
        "permission_blocks": perm_blocks,
        "can_apply_assistant": _has_perm(is_admin, perms, "ai_config_assistant:write"),
        "provider_used": provider_used,
        "model_used": model_used,
        "fallback_used": fallback_used,
        "configured_provider": ((ai_cfg.get("tasks") or {}).get("pbx_config_assistant") or {}).get("provider", "gemini"),
    }


@ai_copilot_router.post("/api/ai-config-assistant/apply")
async def apply_ai_config_plan_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    from backend.main import (
        ensure_user_profiles,
        log_event,
        regenerate_queues_conf,
        resolve_secure_sip_password,
        save_settings,
        settings_db,
    )

    tenant_id = _extract_tenant_id(request)
    if _is_global_tenant(tenant_id):
        tenant_id = "tenant-default"

    user_label, role_code, is_admin, perms = await _resolve_request_user_permissions(request, tenant_id)
    if not _has_perm(is_admin, perms, "ai_config_assistant:write"):
        raise HTTPException(status_code=403, detail="AI Konfigürasyon Asistanı işlem uygulama ('ai_config_assistant:write') yetkiniz bulunmuyor.")

    actions = payload.get("actions") or []
    if not isinstance(actions, list) or not actions:
        raise HTTPException(status_code=400, detail="Uygulanacak geçerli bir konfigürasyon adımı seçilmedi.")

    # Capture Undo Snapshot BEFORE mutating settings_db or PostgreSQL
    snapshot_id = f"snap-{int(datetime.datetime.utcnow().timestamp() * 1000)}"
    now_tr_str = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
    snapshot: Dict[str, Any] = {
        "id": snapshot_id,
        "tenant_id": tenant_id,
        "created_at": now_tr_str,
        "created_by": user_label,
        "prompt": str(payload.get("prompt") or "").strip(),
        "reverted": False,
        "settings_backup": {
            "users": copy.deepcopy(settings_db.get("users", [])),
            "queues": copy.deepcopy(settings_db.get("queues", [])),
            "conferences": copy.deepcopy(settings_db.get("conferences", [])),
            "blacklist": copy.deepcopy(settings_db.get("blacklist", [])),
            "inbound_rules": copy.deepcopy(settings_db.get("inbound_rules", [])),
            "scheduled_reports": copy.deepcopy(settings_db.get("scheduled_reports", [])),
            "breaks": copy.deepcopy(settings_db.get("breaks", [])),
        },
        "created_db_ids": {
            "users": [],
            "queues": [],
            "blacklist": [],
            "breaks": [],
        },
        "modified_users_prev": [],
        "modified_queues_prev": [],
        "applied_summaries": [],
    }

    applied_results: List[Dict[str, Any]] = []
    skipped_results: List[Dict[str, Any]] = []
    need_asterisk_sync = False

    async with AsyncSessionLocal() as db:
        for act in actions:
            if not isinstance(act, dict):
                continue
            a_type = str(act.get("type") or "").strip()
            params = dict(act.get("params") or {})
            if a_type not in ACTION_PERMISSION_MAP:
                continue

            perm_code, type_label = ACTION_PERMISSION_MAP[a_type]
            if not _has_perm(is_admin, perms, perm_code):
                skipped_results.append({"type": a_type, "reason": f"Yetki eksik ({perm_code})"})
                continue

            try:
                if a_type == "create_user":
                    ext = str(params.get("extension") or "").strip()
                    full_name = str(params.get("full_name") or f"Temsilci {ext}").strip()
                    role_val = str(params.get("role") or "agent").strip()
                    sip_pass = resolve_secure_sip_password(ext, "")

                    new_u = SystemUser(
                        tenant_id=tenant_id,
                        full_name=full_name,
                        extension=ext,
                        role=role_val,
                        email=str(params.get("email") or "").strip() or None,
                        gsm_number=str(params.get("gsm_number") or "").strip() or None,
                        department=str(params.get("department") or "").strip() or None,
                        sip_password=sip_pass,
                        outbound_permission=True,
                        is_active=True,
                    )
                    db.add(new_u)
                    await db.flush()
                    snapshot["created_db_ids"]["users"].append(new_u.id)

                    u_dict = {
                        "id": new_u.id,
                        "tenant_id": tenant_id,
                        "full_name": full_name,
                        "extension": ext,
                        "role": role_val,
                        "email": new_u.email or "",
                        "gsm_number": new_u.gsm_number or "",
                        "department": new_u.department or "",
                        "sip_password": sip_pass,
                        "outbound_permission": True,
                        "is_active": True,
                    }
                    ensure_user_profiles(u_dict)
                    settings_db.setdefault("users", []).append(u_dict)
                    need_asterisk_sync = True
                    msg = f"Dahili {ext} ({full_name}) oluşturuldu."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "create_queue":
                    q_ext = str(params.get("extension") or "").strip()
                    q_name = str(params.get("name") or f"Kuyruk {q_ext}").strip()
                    strat = str(params.get("strategy") or "rrmemory").strip()
                    timeout_v = int(params.get("timeout") or 20)
                    members = [str(m).strip() for m in (params.get("members") or []) if str(m).strip()]

                    new_q = PBXQueue(
                        tenant_id=tenant_id,
                        name=q_name,
                        extension=q_ext,
                        strategy=strat,
                        timeout=timeout_v,
                        members=members,
                    )
                    db.add(new_q)
                    await db.flush()
                    snapshot["created_db_ids"]["queues"].append(new_q.id)

                    q_dict = {
                        "id": new_q.id,
                        "tenant_id": tenant_id,
                        "name": q_name,
                        "extension": q_ext,
                        "strategy": strat,
                        "timeout": timeout_v,
                        "members": members,
                    }
                    settings_db.setdefault("queues", []).append(q_dict)
                    need_asterisk_sync = True
                    msg = f"ACD Kuyruğu '{q_name}' ({q_ext}) oluşturuldu ({len(members)} üye)."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "add_queue_members":
                    q_ref = str(params.get("queue") or "").strip()
                    add_m = [str(m).strip() for m in (params.get("members") or []) if str(m).strip()]
                    stmt_q = _apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id)
                    q_rows = (await db.execute(stmt_q)).scalars().all()
                    target_q = next(
                        (q for q in q_rows if str(q.extension) == q_ref or str(q.name or "").lower() == q_ref.lower()),
                        None,
                    )
                    if target_q:
                        prev_m = list(target_q.members or [])
                        snapshot["modified_queues_prev"].append({"id": target_q.id, "members": prev_m})
                        merged_m = list(dict.fromkeys([str(x) for x in prev_m] + add_m))
                        target_q.members = merged_m
                        for dq in settings_db.get("queues", []) or []:
                            if isinstance(dq, dict) and (str(dq.get("id")) == str(target_q.id) or str(dq.get("extension")) == str(target_q.extension)):
                                dq["members"] = merged_m
                        need_asterisk_sync = True
                        msg = f"'{target_q.name}' ({target_q.extension}) kuyruğuna üyeler eklendi: {', '.join(add_m)}"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Kuyruk bulunamadı: {q_ref}"})

                elif a_type == "create_conference":
                    room_no = str(params.get("room_number") or "").strip()
                    c_name = str(params.get("name") or f"Konferans {room_no}").strip()
                    pin_v = str(params.get("pin") or "").strip()
                    conf_obj = {
                        "id": str(uuid.uuid4()),
                        "tenant_id": tenant_id,
                        "name": c_name,
                        "room_number": room_no,
                        "extension": room_no,
                        "pin": pin_v,
                        "admin_pin": str(params.get("admin_pin") or "").strip(),
                    }
                    settings_db.setdefault("conferences", []).append(conf_obj)
                    need_asterisk_sync = True
                    msg = f"Konferans Odası '{c_name}' (Oda: {room_no}) oluşturuldu."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "add_blacklist":
                    val = str(params.get("value") or "").strip()
                    b_type = "email" if "@" in val else "phone"
                    reason = str(params.get("reason") or "AI Konfigürasyon Asistanı").strip()
                    bl_row = BlacklistItem(type=b_type, value=val, reason=reason)
                    db.add(bl_row)
                    await db.flush()
                    snapshot["created_db_ids"]["blacklist"].append(bl_row.id)
                    settings_db.setdefault("blacklist", []).insert(
                        0,
                        {
                            "id": bl_row.id,
                            "tenant_id": tenant_id,
                            "type": b_type,
                            "value": val,
                            "reason": reason,
                            "timestamp": datetime.datetime.utcnow().isoformat(),
                        },
                    )
                    msg = f"Kara listeye eklendi: {val}"
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "create_inbound_rule":
                    did = str(params.get("did_number") or "").strip()
                    dest_t = str(params.get("destination_type") or "queue").strip()
                    dest_v = str(params.get("destination_target") or "").strip()
                    r_name = str(params.get("name") or f"DID {did} Rotası").strip()
                    rule_obj = {
                        "id": str(uuid.uuid4()),
                        "tenant_id": tenant_id,
                        "name": r_name,
                        "did_number": did,
                        "did": did,
                        "destination_type": dest_t,
                        "destination_target": dest_v,
                        "destination": dest_v,
                        "enabled": True,
                    }
                    settings_db.setdefault("inbound_rules", []).append(rule_obj)
                    need_asterisk_sync = True
                    msg = f"Gelen arama kuralı '{r_name}' ({did} → {dest_v}) tanımlandı."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "update_user_forwarding":
                    ext = str(params.get("extension") or "").strip()
                    mode = str(params.get("mode") or "no_answer").strip()
                    target = str(params.get("target") or "").strip()
                    timeout_s = int(params.get("timeout") or 20)
                    active_b = bool(params.get("active", True))
                    col_name = {
                        "always": "forwarding_always",
                        "busy": "forwarding_busy",
                        "no_answer": "forwarding_no_answer",
                    }.get(mode, "forwarding_no_answer")

                    stmt_u = _apply_tenant_clause(select(SystemUser).where(SystemUser.extension == ext), SystemUser, tenant_id)
                    u_row = (await db.execute(stmt_u)).scalars().first()
                    fwd_payload = {"active": active_b, "enabled": active_b, "target": target, "number": target, "timeout": timeout_s}
                    if u_row:
                        snapshot["modified_users_prev"].append(
                            {
                                "id": u_row.id,
                                "forwarding_always": copy.deepcopy(u_row.forwarding_always),
                                "forwarding_busy": copy.deepcopy(u_row.forwarding_busy),
                                "forwarding_no_answer": copy.deepcopy(u_row.forwarding_no_answer),
                                "gsm_number": u_row.gsm_number,
                            }
                        )
                        setattr(u_row, col_name, fwd_payload)
                        if len(re.sub(r"\D", "", target)) >= 10 and not u_row.gsm_number:
                            u_row.gsm_number = target
                    for du in settings_db.get("users", []) or []:
                        if isinstance(du, dict) and str(du.get("extension")) == ext:
                            du[col_name] = fwd_payload
                    msg = f"Dahili {ext} yönlendirmesi ({col_name} → {target}) güncellendi."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "create_scheduled_report":
                    rec = {
                        "id": f"sched-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
                        "tenant_id": tenant_id,
                        "name": str(params.get("name") or "AI Yönetici Özeti").strip(),
                        "enabled": True,
                        "frequency": str(params.get("frequency") or "daily").strip(),
                        "send_time": str(params.get("send_time") or "09:00").strip(),
                        "day_of_week": int(params.get("day_of_week") or 0),
                        "day_of_month": 1,
                        "period_range": str(params.get("period_range") or "yesterday").strip(),
                        "report_types": params.get("report_types") or ["reports_pano", "reports_cdr"],
                        "send_email": True,
                        "email_user_ids": params.get("email_user_ids") or [],
                        "extra_emails": str(params.get("extra_emails") or "").strip(),
                        "email_recipients": str(params.get("extra_emails") or "").strip(),
                        "send_whatsapp": False,
                        "whatsapp_recipients": "",
                    }
                    settings_db.setdefault("scheduled_reports", []).append(rec)
                    msg = f"Zamanlanmış rapor '{rec['name']}' ({rec['send_time']}) oluşturuldu."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "create_break_type":
                    nm = str(params.get("name") or "Özel Mola").strip()
                    mx = int(params.get("max_duration_minutes") or 15)
                    b_row = BreakType(name=nm, icon="Coffee", max_duration_minutes=mx)
                    db.add(b_row)
                    await db.flush()
                    snapshot["created_db_ids"]["breaks"].append(b_row.id)
                    settings_db.setdefault("breaks", []).append(
                        {"id": b_row.id, "tenant_id": tenant_id, "name": nm, "icon": "Coffee", "max_duration_minutes": mx}
                    )
                    msg = f"Mola tanımı '{nm}' ({mx} dk) eklendi."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

            except Exception as act_err:
                skipped_results.append({"type": a_type, "reason": str(act_err)})

        await db.commit()

    if applied_results:
        snapshots = list(settings_db.get("ai_config_snapshots", []) or [])
        snapshots.insert(0, snapshot)
        settings_db["ai_config_snapshots"] = snapshots[:15]
        if need_asterisk_sync:
            settings_db["needs_apply"] = True
        save_settings(settings_db)

        if need_asterisk_sync:
            try:
                regenerate_queues_conf(None)
            except Exception:
                pass
            try:
                subprocess.run(["python3", "backend/scripts/sync_asterisk.py"], timeout=2.0, capture_output=True)
            except Exception:
                pass

        try:
            asyncio.create_task(
                log_event(
                    user_id=user_label,
                    action="AI_CONFIG_APPLY",
                    module="AIConfigAssistant",
                    details={
                        "summary": " • ".join(snapshot["applied_summaries"]),
                        "prompt": snapshot["prompt"],
                        "snapshot_id": snapshot_id,
                    },
                )
            )
        except Exception:
            pass

    return {
        "status": "success" if applied_results else "warning",
        "snapshot_id": snapshot_id if applied_results else None,
        "applied": applied_results,
        "skipped": skipped_results,
    }


@ai_copilot_router.get("/api/ai-config-assistant/history")
async def get_ai_config_history_endpoint(request: Request):
    from backend.main import settings_db

    tenant_id = _extract_tenant_id(request)
    snaps = [
        {
            "id": s.get("id"),
            "created_at": s.get("created_at"),
            "created_by": s.get("created_by"),
            "prompt": s.get("prompt"),
            "reverted": bool(s.get("reverted", False)),
            "reverted_at": s.get("reverted_at"),
            "applied_summaries": s.get("applied_summaries") or [],
        }
        for s in (settings_db.get("ai_config_snapshots", []) or [])
        if isinstance(s, dict) and _match_dict_tenant(s, tenant_id)
    ]
    return {"history": snaps}


@ai_copilot_router.post("/api/ai-config-assistant/undo/{snapshot_id}")
async def undo_ai_config_snapshot_endpoint(snapshot_id: str, request: Request):
    from backend.main import log_event, regenerate_queues_conf, save_settings, settings_db

    tenant_id = _extract_tenant_id(request)
    user_label, _, is_admin, perms = await _resolve_request_user_permissions(request, tenant_id)
    if not _has_perm(is_admin, perms, "ai_config_assistant:write"):
        raise HTTPException(status_code=403, detail="Geri alma işlemi için 'ai_config_assistant:write' yetkisi gereklidir.")

    snaps = list(settings_db.get("ai_config_snapshots", []) or [])
    target = next((s for s in snaps if isinstance(s, dict) and str(s.get("id")) == str(snapshot_id)), None)
    if not target:
        raise HTTPException(status_code=404, detail="Geri alınacak işlem kaydı bulunamadı.")
    if target.get("reverted"):
        raise HTTPException(status_code=400, detail="Bu işlem paketi daha önce zaten geri alınmış.")

    created_ids = target.get("created_db_ids") or {}
    async with AsyncSessionLocal() as db:
        if created_ids.get("users"):
            await db.execute(delete(SystemUser).where(SystemUser.id.in_(created_ids["users"])))
        if created_ids.get("queues"):
            await db.execute(delete(PBXQueue).where(PBXQueue.id.in_(created_ids["queues"])))
        if created_ids.get("blacklist"):
            await db.execute(delete(BlacklistItem).where(BlacklistItem.id.in_(created_ids["blacklist"])))
        if created_ids.get("breaks"):
            await db.execute(delete(BreakType).where(BreakType.id.in_(created_ids["breaks"])))

        for u_prev in target.get("modified_users_prev") or []:
            u_row = (await db.execute(select(SystemUser).where(SystemUser.id == u_prev["id"]))).scalars().first()
            if u_row:
                u_row.forwarding_always = u_prev.get("forwarding_always")
                u_row.forwarding_busy = u_prev.get("forwarding_busy")
                u_row.forwarding_no_answer = u_prev.get("forwarding_no_answer")
                u_row.gsm_number = u_prev.get("gsm_number")

        for q_prev in target.get("modified_queues_prev") or []:
            q_row = (await db.execute(select(PBXQueue).where(PBXQueue.id == q_prev["id"]))).scalars().first()
            if q_row:
                q_row.members = q_prev.get("members") or []

        await db.commit()

    backup = target.get("settings_backup") or {}
    for k, val in backup.items():
        settings_db[k] = copy.deepcopy(val)

    target["reverted"] = True
    target["reverted_at"] = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
    settings_db["ai_config_snapshots"] = snaps
    save_settings(settings_db)

    try:
        regenerate_queues_conf(None)
    except Exception:
        pass
    try:
        subprocess.run(["python3", "backend/scripts/sync_asterisk.py"], timeout=2.0, capture_output=True)
    except Exception:
        pass

    try:
        asyncio.create_task(
            log_event(
                user_id=user_label,
                action="AI_CONFIG_UNDO",
                module="AIConfigAssistant",
                details={"summary": f"AI Konfigürasyon paketi geri alındı ({snapshot_id})", "prompt": target.get("prompt")},
            )
        )
    except Exception:
        pass

    return {"status": "success", "reverted_at": target["reverted_at"]}
