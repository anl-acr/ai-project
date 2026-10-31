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
    # Kullanıcılar & Dahililer
    "create_user": ("users:write", "Kullanıcı & Dahili Oluşturma"),
    "update_user": ("users:write", "Kullanıcı / Dahili İsim & Bilgi Güncelleme"),
    "delete_user": ("users:delete", "Kullanıcı & Dahili Silme"),
    "update_user_forwarding": ("users:write", "Abone Çağrı Yönlendirme & GSM Ayarı"),
    # ACD Çağrı Kuyrukları
    "create_queue": ("acd_queues:write", "ACD Çağrı Kuyruğu Oluşturma"),
    "update_queue": ("acd_queues:write", "ACD Kuyruk İsim & Parametre Güncelleme"),
    "add_queue_members": ("acd_queues:write", "Kuyruğa Temsilci Atama"),
    "remove_queue_members": ("acd_queues:write", "Kuyruktan Temsilci Çıkarma"),
    "delete_queue": ("acd_queues:delete", "ACD Çağrı Kuyruğu Silme"),
    # Yapay Zeka Sesli Asistanlar
    "create_ai_agent": ("ai_agents:write", "Yapay Zeka Sesli Asistan Oluşturma"),
    "update_ai_agent": ("ai_agents:write", "Yapay Zeka Asistan İsim & Ayar Güncelleme"),
    "delete_ai_agent": ("ai_agents:delete", "Yapay Zeka Sesli Asistan Silme"),
    # Konferans Odaları
    "create_conference": ("conferences:write", "Konferans Odası Oluşturma"),
    "update_conference": ("conferences:write", "Konferans Odası İsim & PIN Güncelleme"),
    "delete_conference": ("conferences:delete", "Konferans Odası Silme"),
    # Mola Tanımları
    "create_break_type": ("breaks:write", "Mola Tanımı Ekleme"),
    "update_break_type": ("breaks:write", "Mola Tanımı İsim & Süre Güncelleme"),
    "delete_break_type": ("breaks:delete", "Mola Tanımı Silme"),
    # Departmanlar & Lokasyonlar
    "create_department": ("locations:write", "Departman Oluşturma"),
    "update_department": ("locations:write", "Departman İsim Güncelleme"),
    "delete_department": ("locations:delete", "Departman Silme"),
    "create_location": ("locations:write", "Lokasyon Oluşturma"),
    "update_location": ("locations:write", "Lokasyon İsim Güncelleme"),
    "delete_location": ("locations:delete", "Lokasyon Silme"),
    # Abone Grupları, Çağrı Yakalama Grupları & Hızlı Aramalar
    "create_subscriber_group": ("subscriber_groups:write", "Abone Grubu Oluşturma"),
    "update_subscriber_group": ("subscriber_groups:write", "Abone Grubu İsim & Üye Güncelleme"),
    "create_pickup_group": ("call_pickup_groups:write", "Çağrı Yakalama Grubu Oluşturma"),
    "update_pickup_group": ("call_pickup_groups:write", "Çağrı Yakalama Grubu Güncelleme"),
    "create_speed_dial": ("speed_dials:write", "Hızlı Arama Kodu Ekleme"),
    "update_speed_dial": ("speed_dials:write", "Hızlı Arama Kodu Güncelleme"),
    # Dış Hat (SIP Trunk), Gelen Arama (DID), Kara Liste & Zamanlanmış Raporlar
    "update_trunk": ("trunks:write", "SIP Dış Hat (Trunk) İsim & Ayar Güncelleme"),
    "create_inbound_rule": ("inbound_rules:write", "Gelen Arama (DID) Kuralı Oluşturma"),
    "update_inbound_rule": ("inbound_rules:write", "Gelen Arama (DID) Kuralı Güncelleme"),
    "delete_inbound_rule": ("inbound_rules:delete", "Gelen Arama (DID) Kuralı Silme"),
    "add_blacklist": ("blacklist:write", "Kara Liste Numara Engelleme"),
    "remove_blacklist": ("blacklist:delete", "Kara Listeden Numara Kaldırma"),
    "create_scheduled_report": ("scheduled_reports:write", "Zamanlanmış Rapor Planlama"),
    "update_scheduled_report": ("scheduled_reports:write", "Zamanlanmış Rapor Güncelleme"),
}

_ACTION_TYPE_ALIASES: Dict[str, str] = {
    # User aliases
    "rename_user": "update_user",
    "edit_user": "update_user",
    "modify_user": "update_user",
    "change_user_name": "update_user",
    "rename_extension": "update_user",
    "update_extension": "update_user",
    "remove_user": "delete_user",
    "delete_extension": "delete_user",
    # Queue aliases
    "rename_queue": "update_queue",
    "edit_queue": "update_queue",
    "modify_queue": "update_queue",
    "remove_queue": "delete_queue",
    "delete_queue_members": "remove_queue_members",
    # AI Agent aliases
    "rename_ai_agent": "update_ai_agent",
    "rename_agent": "update_ai_agent",
    "update_agent": "update_ai_agent",
    "edit_ai_agent": "update_ai_agent",
    "remove_ai_agent": "delete_ai_agent",
    # Conference aliases
    "rename_conference": "update_conference",
    "edit_conference": "update_conference",
    "remove_conference": "delete_conference",
    # Break aliases
    "create_break": "create_break_type",
    "rename_break": "update_break_type",
    "rename_break_type": "update_break_type",
    "update_break": "update_break_type",
    "edit_break": "update_break_type",
    "delete_break": "delete_break_type",
    "remove_break": "delete_break_type",
    # Department / Location aliases
    "rename_department": "update_department",
    "edit_department": "update_department",
    "remove_department": "delete_department",
    "rename_location": "update_location",
    "edit_location": "update_location",
    "remove_location": "delete_location",
    # Group & Speed dial & Trunk & Rules & Reports aliases
    "rename_subscriber_group": "update_subscriber_group",
    "rename_group": "update_subscriber_group",
    "update_group": "update_subscriber_group",
    "rename_pickup_group": "update_pickup_group",
    "rename_speed_dial": "update_speed_dial",
    "rename_trunk": "update_trunk",
    "edit_trunk": "update_trunk",
    "rename_inbound_rule": "update_inbound_rule",
    "edit_inbound_rule": "update_inbound_rule",
    "remove_inbound_rule": "delete_inbound_rule",
    "delete_blacklist": "remove_blacklist",
    "unblock_number": "remove_blacklist",
    "rename_scheduled_report": "update_scheduled_report",
    "edit_scheduled_report": "update_scheduled_report",
}


def _tr_norm(val: Any) -> str:
    """Turkish-aware lowercase normalization ('İ' -> 'i', 'I' -> 'ı')."""
    s = str(val or "").replace("İ", "i").replace("I", "ı").lower()
    return re.sub(r"\s+", " ", s).strip()


def _clean_entity_ref(raw_ref: str) -> str:
    """Strips quotes, Turkish apostrophe suffixes ('ın, 'nin, 'nun...) and common entity nouns."""
    s = str(raw_ref or "").strip().strip("\"'“”‘’")
    # Remove apostrophe + suffix e.g. Anıl Acar'ın -> Anıl Acar, 1001'in -> 1001
    s = re.sub(r"['’`][a-zçğıöşüA-ZÇĞİÖŞÜ]+$", "", s).strip()
    # Remove leading/trailing generic entity nouns if present
    s = re.sub(
        r"^(?:mevcut|sistemdeki|olan)\s+",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()
    s = re.sub(
        r"\s+(?:isimli|adlı|adındaki|numaralı|nolu)?\s*(?:dahilisinin|dahiliyi|dahilisini|dahilisi|dahili|kullanıcısının|kullanıcısını|kullanıcısı|kullanıcıyı|kullanıcı|temsilcisinin|temsilcisini|temsilcisi|temsilci|aboneliğinin|abonesinin|abonesini|abonesi|aboneyi|abone|kuyruğunun|kuyruğunu|kuyruğu|kuyruk|asistanının|asistanını|asistanı|asistan|ajanının|ajanını|ajanı|odasının|odasını|odası|molasının|molasını|molası|mola|departmanının|departmanını|departmanı|departman|bölümünün|bölümünü|bölümü|lokasyonunun|lokasyonunu|lokasyonu|lokasyon|şubesinin|şubesini|şubesi|grubunun|grubunu|grubu|hattının|hattını|hattı|trunkının|trunkını|trunkı|kuralının|kuralını|kuralı|raporunun|raporunu|raporu)$",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()
    s = re.sub(r"['’`][a-zçğıöşüA-ZÇĞİÖŞÜ]+$", "", s).strip()
    return s.strip("\"'“”‘’ ")


def _strip_tr_possessive_variants(norm_s: str) -> List[str]:
    """Generates stem candidates for un-apostrophed Turkish genitive/accusative suffixes."""
    cands = [norm_s]
    for suf in ("nın", "nin", "nun", "nün", "ın", "in", "un", "ün", "yı", "yi", "yu", "yü", "ı", "i", "u", "ü"):
        if len(norm_s) > len(suf) + 2 and norm_s.endswith(suf):
            stem = norm_s[: -len(suf)].strip()
            if stem not in cands:
                cands.append(stem)
            # Consonant softening reversal: kuyruğ -> kuyruk
            if stem.endswith("ğ"):
                hard = stem[:-1] + "k"
                if hard not in cands:
                    cands.append(hard)
    return cands


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
    users_by_ext: Dict[str, Dict[str, Any]] = {}
    queues_by_ext: Dict[str, Dict[str, Any]] = {}
    trunks_summary: List[Dict[str, Any]] = []

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
                trunks_summary.append({"id": t.id, "name": t.trunk_name or "", "host": t.host or ""})
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

    if not trunks_summary:
        for t in settings_db.get("trunks", []) or []:
            if isinstance(t, dict) and _match_dict_tenant(t, tenant_id):
                trunks_summary.append({"id": t.get("id"), "name": t.get("trunk_name") or t.get("name") or "", "host": t.get("host") or ""})

    confs_summary = [
        {"id": c.get("id"), "room_number": str(c.get("room_number") or c.get("extension") or ""), "name": c.get("name") or ""}
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
        if isinstance(b, dict) and _match_dict_tenant(b, tenant_id)
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
        {"id": g.get("id"), "name": g.get("name") or ""}
        for g in (settings_db.get("subscriber_groups", []) or [])
        if isinstance(g, dict) and _match_dict_tenant(g, tenant_id)
    ]

    pickup_groups_summary = [
        {"id": g.get("id"), "name": g.get("name") or ""}
        for g in (settings_db.get("call_pickup_groups", []) or [])
        if isinstance(g, dict) and _match_dict_tenant(g, tenant_id)
    ]

    speed_dials_summary = [
        {"id": s.get("id"), "code": str(s.get("code") or s.get("short_code") or ""), "name": s.get("name") or s.get("description") or ""}
        for s in (settings_db.get("speed_dials", []) or [])
        if isinstance(s, dict) and _match_dict_tenant(s, tenant_id)
    ]

    inbound_rules_summary = [
        {"id": r.get("id"), "name": r.get("name") or "", "did_number": str(r.get("did_number") or r.get("did") or "")}
        for r in (settings_db.get("inbound_rules", []) or [])
        if isinstance(r, dict) and _match_dict_tenant(r, tenant_id)
    ]

    scheduled_reports_summary = [
        {"id": s.get("id"), "name": s.get("name") or ""}
        for s in (settings_db.get("scheduled_reports", []) or [])
        if isinstance(s, dict) and _match_dict_tenant(s, tenant_id)
    ]

    return {
        "used_extensions": used_extensions,
        "users": list(users_by_ext.values())[:100],
        "queues": list(queues_by_ext.values())[:40],
        "ai_agents": ai_agents_summary[:30],
        "conferences": confs_summary[:30],
        "breaks": breaks_summary[:30],
        "departments": depts_summary[:30],
        "locations": locs_summary[:30],
        "subscriber_groups": sub_groups_summary[:30],
        "pickup_groups": pickup_groups_summary[:30],
        "speed_dials": speed_dials_summary[:40],
        "trunks": trunks_summary[:20],
        "inbound_rules": inbound_rules_summary[:30],
        "scheduled_reports": scheduled_reports_summary[:30],
    }


def _next_free_number(used: set, start: int, end: int) -> str:
    for n in range(start, end + 1):
        s = str(n)
        if s not in used:
            used.add(s)
            return s
    return str(start)


def _strip_quotes_and_apos(raw_ref: str) -> str:
    s = str(raw_ref or "").strip().strip("\"'“”‘’")
    s = re.sub(r"['’`][a-zçğıöşüA-ZÇĞİÖŞÜ]+$", "", s).strip()
    return s.strip("\"'“”‘’ ")


def _resolve_target_in_category(raw_ref: str, cat: str, ctx: Dict[str, Any]) -> str:
    """Returns canonical identifier/name from ctx[cat] if matched, else cleaned fallback."""
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
            or item.get("full_name")
            or item.get("name")
            or item.get("id")
            or direct
        )
    return _clean_entity_ref(raw_ref) or direct


def _find_matching_entity_in_ctx(
    raw_ref: str,
    prompt_norm: str,
    ctx: Dict[str, Any],
) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Resolves a user-supplied name or number to (update_action_type, matched_entity_dict)
    across all PBX entity collections in ctx.
    """
    direct = _strip_quotes_and_apos(raw_ref)
    cleaned = _clean_entity_ref(raw_ref)
    if not direct and not cleaned:
        return None
    stems: List[str] = []
    if direct:
        for v in _strip_tr_possessive_variants(_tr_norm(direct)):
            if v not in stems:
                stems.append(v)
    if cleaned:
        for v in _strip_tr_possessive_variants(_tr_norm(cleaned)):
            if v not in stems:
                stems.append(v)

    # Category priority hints based on keywords in prompt
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
    if "yakalama" in prompt_norm:
        hint_order.append("pickup_groups")
    if "grup" in prompt_norm or "grub" in prompt_norm:
        hint_order.append("subscriber_groups")
    if "hızlı arama" in prompt_norm or "kısa kod" in prompt_norm:
        hint_order.append("speed_dials")
    if any(k in prompt_norm for k in ("trunk", "dış hat", "operatör")):
        hint_order.append("trunks")
    if any(k in prompt_norm for k in ("gelen arama", "did", "kural")):
        hint_order.append("inbound_rules")
    if "rapor" in prompt_norm:
        hint_order.append("scheduled_reports")
    if any(k in prompt_norm for k in ("dahili", "kullanıcı", "temsilci", "abone", "personel")):
        hint_order.append("users")

    all_cats = [
        "users",
        "queues",
        "ai_agents",
        "conferences",
        "breaks",
        "departments",
        "locations",
        "subscriber_groups",
        "pickup_groups",
        "speed_dials",
        "trunks",
        "inbound_rules",
        "scheduled_reports",
    ]
    ordered_cats = hint_order + [c for c in all_cats if c not in hint_order]

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
        "scheduled_reports": "update_scheduled_report",
    }

    def _item_keys(cat: str, item: Dict[str, Any]) -> List[str]:
        vals = []
        for k in ("extension", "room_number", "code", "did_number", "full_name", "name", "id"):
            v = item.get(k)
            if v is not None and str(v).strip():
                vals.append(_tr_norm(v))
        return vals

    # Pass 1: Exact match on any stem (prioritizing un-stripped exact name first)
    for cat in ordered_cats:
        for item in ctx.get(cat, []) or []:
            ikeys = _item_keys(cat, item)
            if any(st in ikeys for st in stems):
                return cat_to_action[cat], item

    # Pass 2: Number token inside raw_ref (e.g. "1001 nolu dahili" -> "1001")
    num_m = re.search(r"\b(\d{3,4})\b", cleaned)
    if num_m:
        num_s = num_m.group(1)
        for cat in ordered_cats:
            if cat in ("users", "queues", "conferences", "speed_dials"):
                for item in ctx.get(cat, []) or []:
                    if num_s in _item_keys(cat, item):
                        return cat_to_action[cat], item

    # Pass 3: Substring / partial name match (minimum 3 chars)
    for cat in ordered_cats:
        for item in ctx.get(cat, []) or []:
            nm = _tr_norm(item.get("full_name") or item.get("name") or "")
            if not nm or len(nm) < 3:
                continue
            for st in stems:
                if len(st) >= 3 and (st in nm or nm in st):
                    return cat_to_action[cat], item

    return None


def _normalize_llm_action(act: Dict[str, Any], prompt_norm: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Normalizes LLM-invented action types & parameter aliases into canonical ACTION_PERMISSION_MAP entries."""
    raw_type = str(act.get("type") or act.get("action") or "").strip().lower()
    params = dict(act.get("params") or act.get("parameters") or {})
    # Allow top-level fields if LLM flattened params
    if not params:
        params = {k: v for k, v in act.items() if k not in ("type", "action", "summary", "explanation")}

    # Unify target / new_name parameter aliases across models
    target_val = (
        params.get("target")
        or params.get("old_name")
        or params.get("current_name")
        or params.get("from_name")
        or params.get("source")
        or params.get("user")
        or params.get("agent")
        or params.get("id")
    )
    new_name_val = (
        params.get("new_name")
        or params.get("new_full_name")
        or params.get("to_name")
        or params.get("updated_name")
        or params.get("rename_to")
    )

    canonical_type = _ACTION_TYPE_ALIASES.get(raw_type, raw_type)

    # Generic rename/update resolution using PBX context
    if canonical_type in ("rename", "rename_item", "change_name", "update", "update_name", "edit"):
        probe = str(target_val or params.get("extension") or params.get("name") or "")
        resolved = _find_matching_entity_in_ctx(probe, prompt_norm, ctx)
        if resolved:
            canonical_type = resolved[0]
            matched_item = resolved[1]
            target_val = matched_item.get("extension") or matched_item.get("room_number") or matched_item.get("full_name") or matched_item.get("name") or matched_item.get("id")
        else:
            canonical_type = "update_user"

    if canonical_type.startswith("update_") and canonical_type != "update_user_forwarding":
        if target_val and not params.get("target"):
            params["target"] = str(target_val).strip()
        if not params.get("target"):
            for k in ("extension", "room_number", "queue", "did_number", "code"):
                if params.get(k):
                    params["target"] = str(params[k]).strip()
                    break
        if new_name_val and not params.get("new_name"):
            params["new_name"] = str(new_name_val).strip()
        elif not params.get("new_name"):
            # If LLM placed the new name inside 'full_name' or 'name' while 'target' holds the old ref
            cand_nm = params.get("full_name") or params.get("name")
            if cand_nm and str(cand_nm).strip() != str(params.get("target") or "").strip():
                params["new_name"] = str(cand_nm).strip()

    if canonical_type.startswith("delete_") or canonical_type == "remove_blacklist":
        if target_val and not params.get("target"):
            params["target"] = str(target_val).strip()
        if not params.get("target"):
            params["target"] = str(params.get("extension") or params.get("name") or params.get("full_name") or params.get("value") or "").strip()

    return {"type": canonical_type, "params": params}


def _parse_config_prompt_semantically(prompt: str, ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Deterministic Turkish NLP fallback parser supporting Rename, Update, Delete & Create across PBX modules."""
    text = (prompt or "").strip()
    low = _tr_norm(text)
    used = set(ctx.get("used_extensions") or set())
    actions: List[Dict[str, Any]] = []
    batch_created_exts: List[str] = []

    # ------------------------------------------------------------------
    # 0A. RENAME / NAME CHANGE DETECTION (İsim / Ad Değiştirme)
    # ------------------------------------------------------------------
    rename_patterns = [
        # e.g. "Anıl Acar'ın ismini Mehmet Yılmaz olarak değiştir" / "1001 dahilisinin adını Ali Kaya yap"
        r"^(.+?)\s+(?:adını|ismini|başlığını|etiketini|kullanıcı\s+adını)\s+[\"“']?([^\"”']+?)[\"”']?\s*(?:olarak|şeklinde|diye)?\s*(?:değiştir\w*|yap\w*|güncelle\w*|düzenle\w*|ayarla\w*|kaydet\w*)\.?$",
        # e.g. "Anıl Acar ismini Mehmet Yılmaz ile değiştir"
        r"^(.+?)\s+(?:adını|ismini)\s+[\"“']?([^\"”']+?)[\"”']?\s+ile\s+(?:değiştir\w*|güncelle\w*)\.?$",
        # e.g. "1001'i Mehmet Yılmaz olarak yeniden adlandır" / "Satış Kuyruğu'nu Kurumsal Satış olarak adlandır"
        r"^(.+?)\s+[\"“']?([^\"”']+?)[\"”']?\s+(?:olarak|şeklinde|diye)\s+(?:yeniden\s+)?(?:adlandır\w*|isimlendir\w*|değiştir\w*|güncelle\w*)\.?$",
        # e.g. "İsmi Anıl Acar olan kullanıcının adını Mehmet Yılmaz yap"
        r"(?:adı|ismi)\s+[\"“']?(.+?)[\"”']?\s+olan\s+\S+\s+(?:adını|ismini)\s+[\"“']?([^\"”']+?)[\"”']?\s*(?:olarak)?\s*(?:değiştir\w*|yap\w*|güncelle\w*)\.?$",
    ]

    for pat in rename_patterns:
        m_ren = re.search(pat, text, flags=re.IGNORECASE)
        if m_ren:
            raw_old = m_ren.group(1).strip()
            raw_new = m_ren.group(2).strip().strip("\"'“”‘’ ")
            # Clean trailing helper words from raw_new if any
            raw_new = re.sub(r"\s+(?:olarak|şeklinde|diye)$", "", raw_new, flags=re.IGNORECASE).strip()
            if raw_old and raw_new:
                matched = _find_matching_entity_in_ctx(raw_old, low, ctx)
                if matched:
                    act_type, item = matched
                    target_id = (
                        item.get("extension")
                        or item.get("room_number")
                        or item.get("code")
                        or item.get("full_name")
                        or item.get("name")
                        or item.get("id")
                    )
                    actions.append(
                        {
                            "type": act_type,
                            "params": {
                                "target": str(target_id),
                                "new_name": raw_new,
                            },
                        }
                    )
                    return actions
                else:
                    # Infer entity type from keywords even if not yet matched in ctx
                    cleaned_old = _clean_entity_ref(raw_old)
                    inferred_type = "update_user"
                    if any(k in low for k in ("kuyruk", "kuyruğ")):
                        inferred_type = "update_queue"
                    elif any(k in low for k in ("asistan", "yapay zeka", "ai ", "ajan")):
                        inferred_type = "update_ai_agent"
                    elif any(k in low for k in ("konferans", "toplantı", "oda")):
                        inferred_type = "update_conference"
                    elif "mola" in low:
                        inferred_type = "update_break_type"
                    elif any(k in low for k in ("departman", "bölüm")):
                        inferred_type = "update_department"
                    elif any(k in low for k in ("lokasyon", "şube")):
                        inferred_type = "update_location"
                    elif "yakalama" in low:
                        inferred_type = "update_pickup_group"
                    elif "grup" in low or "grub" in low:
                        inferred_type = "update_subscriber_group"
                    elif any(k in low for k in ("trunk", "dış hat")):
                        inferred_type = "update_trunk"
                    elif "rapor" in low:
                        inferred_type = "update_scheduled_report"

                    actions.append(
                        {
                            "type": inferred_type,
                            "params": {
                                "target": cleaned_old or raw_old,
                                "new_name": raw_new,
                            },
                        }
                    )
                    return actions

    # ------------------------------------------------------------------
    # 0B. USER ROLE / DEPARTMENT / EMAIL / EXTENSION UPDATE
    # ------------------------------------------------------------------
    if any(k in low for k in ("değiştir", "güncelle", "yap", "ata")) and not any(k in low for k in ("oluştur", "yeni ", "aç")):
        # Role change e.g. "1001 dahilisinin rolünü supervisor yap"
        if any(k in low for k in ("rolünü", "yetkisini", "süpervizör", "supervisor", "admin")):
            new_role = "admin" if "admin" in low else ("supervisor" if ("süpervizör" in low or "supervisor" in low or "şef" in low) else "agent")
            matched = _find_matching_entity_in_ctx(text.split("rol")[0], low, ctx)
            if matched and matched[0] == "update_user":
                u_item = matched[1]
                actions.append(
                    {
                        "type": "update_user",
                        "params": {
                            "target": str(u_item.get("extension") or u_item.get("full_name")),
                            "role": new_role,
                        },
                    }
                )
                return actions

        # Remove member from queue e.g. "1002 dahilisini 2000 kuyruğundan çıkar"
        if ("kuyruk" in low or "kuyruğ" in low) and any(k in low for k in ("çıkar", "kaldır", "sil")):
            m_exts = re.findall(r"\b(1\d{2,3})\b", low)
            q_m = re.search(r"\b(2\d{3}|8\d{2,3})\b", low)
            if m_exts and q_m:
                actions.append(
                    {
                        "type": "remove_queue_members",
                        "params": {"queue": q_m.group(1), "members": m_exts},
                    }
                )
                return actions

        # Add member to EXISTING queue e.g. "1002 dahilisini Satış Kuyruğuna ekle"
        if ("kuyruğuna" in low or "kuyruğa" in low) and "ekle" in low:
            m_exts = re.findall(r"\b(1\d{2,3})\b", low)
            q_m = re.search(r"\b(2\d{3}|8\d{2,3})\b", low)
            q_ref = q_m.group(1) if q_m else ""
            if not q_ref:
                for q_it in ctx.get("queues", []) or []:
                    if _tr_norm(q_it.get("name")) and _tr_norm(q_it.get("name")) in low:
                        q_ref = str(q_it.get("extension") or q_it.get("name"))
                        break
            if m_exts and q_ref:
                actions.append(
                    {
                        "type": "add_queue_members",
                        "params": {"queue": q_ref, "members": m_exts},
                    }
                )
                return actions

    # ------------------------------------------------------------------
    # 0C. DELETE / REMOVE DETECTION
    # ------------------------------------------------------------------
    if any(k in low for k in ("sil", "kaldır")) and not any(k in low for k in ("oluştur", "ekle")):
        if "kara liste" in low or "engeli kaldır" in low:
            phones = re.findall(r"(?:\+?90|0)?\s*5\d{2}[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}|\b0?(?:850|212|216|312|232|224)\d{7}\b", text)
            for ph in phones:
                actions.append({"type": "remove_blacklist", "params": {"target": re.sub(r"[^\d+]", "", ph)}})
            if actions:
                return actions

        left_part = re.sub(r"\s*(?:sil\w*|kaldır\w*)\.?$", "", text, flags=re.IGNORECASE).strip()
        matched_del = _find_matching_entity_in_ctx(left_part, low, ctx)
        if matched_del:
            upd_type, item = matched_del
            del_map = {
                "update_user": "delete_user",
                "update_queue": "delete_queue",
                "update_ai_agent": "delete_ai_agent",
                "update_conference": "delete_conference",
                "update_break_type": "delete_break_type",
                "update_department": "delete_department",
                "update_location": "delete_location",
                "update_inbound_rule": "delete_inbound_rule",
            }
            if upd_type in del_map:
                t_ref = item.get("extension") or item.get("room_number") or item.get("full_name") or item.get("name") or item.get("id")
                actions.append({"type": del_map[upd_type], "params": {"target": str(t_ref)}})
                return actions

    # ------------------------------------------------------------------
    # 1. Blacklist detection
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # 2. User / Extension creation detection
    # ------------------------------------------------------------------
    if any(k in low for k in ("dahili", "kullanıcı", "temsilci", "abone", "personel")) and any(
        k in low for k in ("oluştur", "ekle", "aç", "tanımla", "kur")
    ):
        explicit_ext_matches = re.findall(
            r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)+)\s*(?:\(?(\d{3,4})\)?)?",
            text,
        )
        filtered_names = [
            (nm.strip(), ex.strip())
            for nm, ex in explicit_ext_matches
            if _tr_norm(nm) not in ("ai konfigürasyon", "çağrı kuyruğu", "satış kuyruğu", "destek kuyruğu", "konferans odası", "yönetim toplantı")
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

    # ------------------------------------------------------------------
    # 3. Queue creation detection
    # ------------------------------------------------------------------
    if ("kuyruk" in low or "kuyruğ" in low) and any(k in low for k in ("oluştur", "aç", "kur", "tanımla")):
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

    # ------------------------------------------------------------------
    # 4. Conference Room creation
    # ------------------------------------------------------------------
    if ("konferans" in low or "toplantı odası" in low) and any(k in low for k in ("oluştur", "aç", "kur", "ekle")):
        c_ext_m = re.search(r"\b(3\d{3})\b", low)
        c_ext = c_ext_m.group(1) if (c_ext_m and c_ext_m.group(1) not in used) else _next_free_number(used, 3000, 3999)
        used.add(c_ext)
        pin_m = re.search(r"(?:pin|şifre\w*)\s*[:=]?\s*(\d{4,6})", low)
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

    # ------------------------------------------------------------------
    # 5. Subscriber Call Forwarding / GSM (Enable or Cancel)
    # ------------------------------------------------------------------
    if any(k in low for k in ("yönlendir", "cep telefonuna", "gsm", "follow-me", "meşgulde", "cevapsızda")):
        ext_m = re.search(r"\b(1\d{2,3})\b", low)
        ext_str = ext_m.group(1) if ext_m else ""
        if not ext_str:
            m_u = _find_matching_entity_in_ctx(text.split("yönlendir")[0], low, ctx)
            if m_u and m_u[0] == "update_user":
                ext_str = str(m_u[1].get("extension") or "")

        is_cancel = any(k in low for k in ("iptal", "kapat", "devre dışı", "kaldır"))
        gsm_m = re.search(r"(?:\+?90|0)?\s*5\d{2}[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}", text)
        if ext_str:
            target_num = re.sub(r"[^\d+]", "", gsm_m.group(0)) if gsm_m else ""
            other_exts = [e for e in re.findall(r"\b(1\d{2,3}|2\d{3})\b", low) if e != ext_str]
            if not target_num and other_exts:
                target_num = other_exts[0]
            mode = "always" if ("her zaman" in low or "tüm çağrı" in low) else ("busy" if "meşgul" in low else "no_answer")
            if target_num or is_cancel:
                actions.append(
                    {
                        "type": "update_user_forwarding",
                        "params": {
                            "extension": ext_str,
                            "mode": mode,
                            "target": target_num,
                            "timeout": 20,
                            "active": not is_cancel,
                        },
                    }
                )

    # ------------------------------------------------------------------
    # 6. Inbound DID Rule
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # 7. Scheduled Report
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # 8. Break / Department / Location Creation
    # ------------------------------------------------------------------
    if "mola" in low and any(k in low for k in ("ekle", "oluştur", "tanımla")) and "rapor" not in low:
        actions.append(
            {
                "type": "create_break_type",
                "params": {
                    "name": "Eğitim Molası" if "eğitim" in low else ("Namaz / İbadet Molası" if "namaz" in low else "Kısa Dinlenme Molası"),
                    "max_duration_minutes": 30 if "30" in low else 15,
                },
            }
        )

    if ("departman" in low or "bölüm" in low) and any(k in low for k in ("ekle", "oluştur", "tanımla")) and not actions:
        nm_m = re.search(r"[\"“']?([^\"”']+?)[\"”']?\s+(?:adında|isimli)?\s*(?:departman|bölüm)", text, flags=re.IGNORECASE)
        d_name = nm_m.group(1).strip() if nm_m else "Yeni Departman"
        actions.append({"type": "create_department", "params": {"name": d_name}})

    if ("lokasyon" in low or "şube" in low) and any(k in low for k in ("ekle", "oluştur", "tanımla")) and not actions:
        nm_m = re.search(r"[\"“']?([^\"”']+?)[\"”']?\s+(?:adında|isimli)?\s*(?:lokasyon|şube)", text, flags=re.IGNORECASE)
        l_name = nm_m.group(1).strip() if nm_m else "Yeni Lokasyon"
        actions.append({"type": "create_location", "params": {"name": l_name}})

    return actions


def _validate_and_enrich_plan_actions(
    raw_actions: List[Dict[str, Any]],
    prompt_norm: str,
    ctx: Dict[str, Any],
    is_admin: bool,
    perms: set,
) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    used_exts = set(ctx.get("used_extensions") or set())
    planned_exts_in_batch = set()
    enriched: List[Dict[str, Any]] = []
    warnings: List[str] = []
    perm_blocks: List[str] = []

    for idx, raw_act in enumerate(raw_actions):
        if not isinstance(raw_act, dict):
            continue
        norm_act = _normalize_llm_action(raw_act, prompt_norm, ctx)
        a_type = norm_act["type"]
        if a_type not in ACTION_PERMISSION_MAP:
            continue
        params = dict(norm_act["params"] or {})
        perm_code, type_label = ACTION_PERMISSION_MAP[a_type]
        allowed = _has_perm(is_admin, perms, perm_code)
        if not allowed:
            perm_blocks.append(f"'{type_label}' işlemi için '{perm_code}' yetkiniz bulunmuyor.")

        conflict_note = None
        summary = ""

        # --- CREATE ACTIONS ---
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
            params["full_name"] = str(params.get("full_name") or params.get("name") or f"Temsilci {params['extension']}").strip()
            params["role"] = str(params.get("role") or "agent").strip()
            if params["role"] not in ("agent", "supervisor", "admin"):
                params["role"] = "agent"
            summary = f"Yeni Dahili/Kullanıcı: {params['full_name']} (Dahili: {params['extension']}, Rol: {params['role']})"

        elif a_type == "update_user":
            t_ref = _clean_entity_ref(str(params.get("target") or params.get("extension") or ""))
            matched_u = None
            for u in ctx.get("users", []) or []:
                if _tr_norm(t_ref) in (_tr_norm(u.get("extension")), _tr_norm(u.get("full_name")), _tr_norm(u.get("id"))):
                    matched_u = u
                    break
            if not matched_u:
                m_any = _find_matching_entity_in_ctx(t_ref, prompt_norm, {"users": ctx.get("users", [])})
                if m_any:
                    matched_u = m_any[1]

            if matched_u:
                params["target_extension"] = str(matched_u.get("extension") or "")
                params["target_id"] = matched_u.get("id")
                cur_label = f"{matched_u.get('full_name')} ({matched_u.get('extension')})"
            else:
                params["target_extension"] = t_ref
                cur_label = t_ref or "Belirtilen Kullanıcı"
                warnings.append(f"'{t_ref}' ile eşleşen mevcut bir kullanıcı önizlemede doğrulanamadı; uygulama sırasında tekrar aranacak.")

            changes = []
            if params.get("new_name"):
                changes.append(f"Yeni Ad: '{params['new_name']}'")
            if params.get("new_extension"):
                changes.append(f"Yeni Dahili: {params['new_extension']}")
            if params.get("role"):
                changes.append(f"Yeni Rol: {params['role']}")
            if params.get("email"):
                changes.append(f"E-Posta: {params['email']}")
            if params.get("gsm_number"):
                changes.append(f"GSM: {params['gsm_number']}")
            if params.get("department"):
                changes.append(f"Departman: {params['department']}")
            if "is_active" in params:
                changes.append("Durum: Aktif" if params["is_active"] else "Durum: Pasif")
            summary = f"Kullanıcı Güncelleme: {cur_label} → {', '.join(changes) or 'Bilgi güncelleme'}"

        elif a_type == "delete_user":
            t_ref = _resolve_target_in_category(str(params.get("target") or ""), "users", ctx)
            params["target"] = t_ref
            summary = f"Kullanıcı / Dahili Silme: '{t_ref}'"

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

        elif a_type == "update_queue":
            t_ref = _resolve_target_in_category(str(params.get("target") or params.get("queue") or params.get("extension") or ""), "queues", ctx)
            params["target"] = t_ref
            changes = []
            if params.get("new_name"):
                changes.append(f"Yeni Kuyruk Adı: '{params['new_name']}'")
            if params.get("strategy"):
                changes.append(f"Strateji: {params['strategy']}")
            if params.get("timeout"):
                changes.append(f"Çalma Süresi: {params['timeout']} sn")
            if params.get("new_extension"):
                changes.append(f"Yeni No: {params['new_extension']}")
            summary = f"ACD Kuyruğu Güncelleme: '{t_ref}' → {', '.join(changes) or 'Ayar güncelleme'}"

        elif a_type == "add_queue_members":
            q_target = _resolve_target_in_category(str(params.get("queue") or params.get("target") or params.get("extension") or ""), "queues", ctx)
            members = [str(m).strip() for m in (params.get("members") or []) if str(m).strip()]
            params["queue"] = q_target
            params["members"] = members
            summary = f"Kuyruğa Üye Ekleme: Kuyruk '{q_target}' ← {', '.join(members) or '-'}"

        elif a_type == "remove_queue_members":
            q_target = _resolve_target_in_category(str(params.get("queue") or params.get("target") or params.get("extension") or ""), "queues", ctx)
            members = [str(m).strip() for m in (params.get("members") or []) if str(m).strip()]
            params["queue"] = q_target
            params["members"] = members
            summary = f"Kuyruktan Üye Çıkarma: Kuyruk '{q_target}' ✕ {', '.join(members) or '-'}"

        elif a_type == "delete_queue":
            t_ref = _resolve_target_in_category(str(params.get("target") or ""), "queues", ctx)
            params["target"] = t_ref
            summary = f"ACD Çağrı Kuyruğu Silme: '{t_ref}'"

        elif a_type == "create_ai_agent":
            nm = str(params.get("name") or "Yeni Sesli Asistan").strip()
            params["name"] = nm
            params["tone"] = str(params.get("tone") or "kurumsal").strip()
            params["transfer_target"] = str(params.get("transfer_target") or "1000").strip()
            summary = f"Yeni AI Sesli Asistan: '{nm}' (Transfer: {params['transfer_target']})"

        elif a_type == "update_ai_agent":
            t_ref = _resolve_target_in_category(str(params.get("target") or ""), "ai_agents", ctx)
            params["target"] = t_ref
            changes = []
            if params.get("new_name"):
                changes.append(f"Yeni Ad: '{params['new_name']}'")
            if params.get("transfer_target"):
                changes.append(f"Transfer Hedefi: {params['transfer_target']}")
            if params.get("tone"):
                changes.append(f"Üslup: {params['tone']}")
            if params.get("system_instruction"):
                changes.append("Sistem Talimatı Güncellendi")
            summary = f"AI Sesli Asistan Güncelleme: '{t_ref}' → {', '.join(changes) or 'Ayar güncelleme'}"

        elif a_type == "delete_ai_agent":
            t_ref = _resolve_target_in_category(str(params.get("target") or ""), "ai_agents", ctx)
            params["target"] = t_ref
            summary = f"AI Sesli Asistan Silme: '{t_ref}'"

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

        elif a_type == "update_conference":
            t_ref = _resolve_target_in_category(str(params.get("target") or params.get("room_number") or ""), "conferences", ctx)
            params["target"] = t_ref
            changes = []
            if params.get("new_name"):
                changes.append(f"Yeni Oda Adı: '{params['new_name']}'")
            if "pin" in params:
                changes.append(f"PIN: {params['pin'] or 'Şifresiz'}")
            if params.get("new_room_number"):
                changes.append(f"Yeni Oda No: {params['new_room_number']}")
            summary = f"Konferans Odası Güncelleme: '{t_ref}' → {', '.join(changes) or 'Ayar güncelleme'}"

        elif a_type == "delete_conference":
            t_ref = _resolve_target_in_category(str(params.get("target") or ""), "conferences", ctx)
            params["target"] = t_ref
            summary = f"Konferans Odası Silme: '{t_ref}'"

        elif a_type == "create_break_type":
            nm = str(params.get("name") or "Özel Mola").strip()
            mx = int(params.get("max_duration_minutes") or 15)
            params["name"] = nm
            params["max_duration_minutes"] = mx
            summary = f"Yeni Mola Tanımı: {nm} (Maks. {mx} dk)"

        elif a_type == "update_break_type":
            t_ref = _resolve_target_in_category(str(params.get("target") or ""), "breaks", ctx)
            params["target"] = t_ref
            changes = []
            if params.get("new_name"):
                changes.append(f"Yeni Mola Adı: '{params['new_name']}'")
            if params.get("max_duration_minutes"):
                changes.append(f"Maks. Süre: {params['max_duration_minutes']} dk")
            summary = f"Mola Tanımı Güncelleme: '{t_ref}' → {', '.join(changes) or 'Güncelleme'}"

        elif a_type == "delete_break_type":
            t_ref = _resolve_target_in_category(str(params.get("target") or ""), "breaks", ctx)
            params["target"] = t_ref
            summary = f"Mola Tanımı Silme: '{t_ref}'"

        elif a_type in ("create_department", "create_location", "create_subscriber_group", "create_pickup_group"):
            nm = str(params.get("name") or "Yeni Kayıt").strip()
            params["name"] = nm
            summary = f"{type_label}: '{nm}'"

        elif a_type in ("update_department", "update_location", "update_subscriber_group", "update_pickup_group", "update_speed_dial", "update_trunk", "update_inbound_rule", "update_scheduled_report"):
            cat_lookup = {
                "update_department": "departments",
                "update_location": "locations",
                "update_subscriber_group": "subscriber_groups",
                "update_pickup_group": "pickup_groups",
                "update_speed_dial": "speed_dials",
                "update_trunk": "trunks",
                "update_inbound_rule": "inbound_rules",
                "update_scheduled_report": "scheduled_reports",
            }
            t_ref = _resolve_target_in_category(str(params.get("target") or ""), cat_lookup[a_type], ctx)
            params["target"] = t_ref
            changes = []
            if params.get("new_name"):
                changes.append(f"Yeni İsim: '{params['new_name']}'")
            if params.get("destination_target"):
                changes.append(f"Hedef: {params['destination_target']}")
            if params.get("target_number"):
                changes.append(f"Numara: {params['target_number']}")
            if params.get("send_time"):
                changes.append(f"Saat: {params['send_time']}")
            summary = f"{type_label}: '{t_ref}' → {', '.join(changes) or 'Güncelleme'}"

        elif a_type in ("delete_department", "delete_location", "delete_inbound_rule", "remove_blacklist"):
            cat_del = {"delete_department": "departments", "delete_location": "locations", "delete_inbound_rule": "inbound_rules"}.get(a_type)
            raw_t = str(params.get("target") or params.get("value") or "")
            t_ref = _resolve_target_in_category(raw_t, cat_del, ctx) if cat_del else _strip_quotes_and_apos(raw_t)
            params["target"] = t_ref
            summary = f"{type_label}: '{t_ref}'"

        elif a_type == "create_speed_dial":
            code = str(params.get("code") or params.get("short_code") or "*10").strip()
            nm = str(params.get("name") or f"Hızlı Arama {code}").strip()
            dest = str(params.get("target_number") or params.get("target") or "").strip()
            params["code"] = code
            params["name"] = nm
            params["target_number"] = dest
            summary = f"Hızlı Arama Ekleme: {code} - '{nm}' → {dest}"

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
            ext = str(params.get("extension") or params.get("target") or "").strip()
            mode = str(params.get("mode") or "no_answer").strip()
            target = str(params.get("target_number") or params.get("target") or "").strip()
            active_b = bool(params.get("active", True))
            params["extension"] = ext
            params["target"] = target
            params["active"] = active_b
            mode_tr = {"always": "Her Zaman", "busy": "Meşgulde", "no_answer": "Cevapsızda"}.get(mode, "Cevapsızda")
            if active_b:
                summary = f"Çağrı Yönlendirme: Dahili {ext} ({mode_tr}) → {target}"
            else:
                summary = f"Çağrı Yönlendirme İptali: Dahili {ext} ({mode_tr} kapatıldı)"

        elif a_type == "create_scheduled_report":
            nm = str(params.get("name") or "Otomatik Yönetici Raporu").strip()
            freq = str(params.get("frequency") or "daily").strip()
            tm = str(params.get("send_time") or "09:00").strip()
            summary = f"Zamanlanmış Rapor: {nm} ({freq} - Saat {tm})"

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
    prompt_norm = _tr_norm(prompt)

    compact_users = [{"ext": u["extension"], "name": u["full_name"], "role": u["role"]} for u in ctx["users"][:60]]
    compact_queues = [{"ext": q["extension"], "name": q["name"], "members": q.get("members", [])} for q in ctx["queues"][:30]]

    sys_inst = (
        "Sen AIDA IP Santral ve AI Çağrı Merkezi sisteminin 'AI Konfigürasyon Asistanı'sın.\n"
        "Yöneticinin doğal dildeki santral kurulum, İSİM DEĞİŞTİRME (rename), güncelleme veya silme isteğini SADECE geçerli bir JSON eylem planına dönüştür.\n"
        f"Mevcut Kullanıcılar/Dahililer: {json.dumps(compact_users, ensure_ascii=False)}\n"
        f"Mevcut Kuyruklar: {json.dumps(compact_queues, ensure_ascii=False)}\n"
        f"Mevcut AI Sesli Asistanlar: {json.dumps(ctx['ai_agents'], ensure_ascii=False)}\n"
        f"Mevcut Konferans Odaları: {json.dumps(ctx['conferences'], ensure_ascii=False)}\n"
        f"Mevcut Molalar: {json.dumps(ctx['breaks'], ensure_ascii=False)}\n"
        f"Mevcut Departmanlar: {json.dumps(ctx['departments'], ensure_ascii=False)} | Lokasyonlar: {json.dumps(ctx['locations'], ensure_ascii=False)}\n"
        f"Mevcut Abone Grupları: {json.dumps(ctx['subscriber_groups'], ensure_ascii=False)} | Yakalama Grupları: {json.dumps(ctx['pickup_groups'], ensure_ascii=False)}\n"
        f"Mevcut SIP Trunk Dış Hatlar: {json.dumps(ctx['trunks'], ensure_ascii=False)}\n"
        f"Mevcut Gelen Arama Kuralları: {json.dumps(ctx['inbound_rules'], ensure_ascii=False)}\n"
        f"Mevcut Zamanlanmış Raporlar: {json.dumps(ctx['scheduled_reports'], ensure_ascii=False)}\n"
        f"Dolu Numaralar: {sorted(list(ctx['used_extensions']))[:80]}\n\n"
        "Desteklenen TÜM action type şemaları:\n"
        '- Yeni Kullanıcı/Dahili: {"type": "create_user", "params": {"full_name": "Ad Soyad", "extension": "1005", "role": "agent|supervisor", "email": "", "gsm_number": "", "department": ""}}\n'
        '- Kullanıcı/Dahili İsim veya Bilgi Değiştirme: {"type": "update_user", "params": {"target": "mevcut dahili no veya mevcut ad soyad", "new_name": "Yeni Ad Soyad", "role": "agent|supervisor", "email": "", "gsm_number": "", "department": "", "new_extension": ""}}\n'
        '- Kullanıcı/Dahili Silme: {"type": "delete_user", "params": {"target": "dahili no veya ad soyad"}}\n'
        '- Abone Çağrı Yönlendirme: {"type": "update_user_forwarding", "params": {"extension": "1001", "mode": "always|busy|no_answer", "target": "05321112233", "timeout": 20, "active": true}}\n'
        '- Yeni Kuyruk: {"type": "create_queue", "params": {"name": "Satış Kuyruğu", "extension": "2001", "strategy": "rrmemory|ringall|leastrecent|fewestcalls", "timeout": 20, "members": ["1005"]}}\n'
        '- Kuyruk İsim/Ayar Değiştirme: {"type": "update_queue", "params": {"target": "mevcut kuyruk no veya adı", "new_name": "Yeni Kuyruk Adı", "strategy": "", "timeout": 20}}\n'
        '- Kuyruğa Üye Ekle / Çıkar: {"type": "add_queue_members", "params": {"queue": "2000", "members": ["1005"]}} veya {"type": "remove_queue_members", "params": {"queue": "2000", "members": ["1005"]}}\n'
        '- Kuyruk Silme: {"type": "delete_queue", "params": {"target": "2000"}}\n'
        '- AI Sesli Asistan Oluştur / İsim & Ayar Değiştir / Sil: {"type": "create_ai_agent", "params": {"name": "Asistan Adı", "tone": "kurumsal", "transfer_target": "1000"}} | {"type": "update_ai_agent", "params": {"target": "mevcut asistan adı", "new_name": "Yeni Asistan Adı"}} | {"type": "delete_ai_agent", "params": {"target": "asistan adı"}}\n'
        '- Konferans Odası Oluştur / İsim & PIN Değiştir / Sil: {"type": "create_conference", "params": {"name": "Toplantı", "room_number": "3001", "pin": "1234"}} | {"type": "update_conference", "params": {"target": "oda no veya adı", "new_name": "Yeni Oda Adı", "pin": "1234"}} | {"type": "delete_conference", "params": {"target": "3001"}}\n'
        '- Mola Tanımı Ekle / İsim & Süre Değiştir / Sil: {"type": "create_break_type", "params": {"name": "Eğitim Molası", "max_duration_minutes": 20}} | {"type": "update_break_type", "params": {"target": "mevcut mola adı", "new_name": "Yeni Mola Adı", "max_duration_minutes": 20}} | {"type": "delete_break_type", "params": {"target": "mola adı"}}\n'
        '- Departman / Lokasyon Oluştur veya İsim Değiştir: create_department, update_department (target, new_name), delete_department, create_location, update_location (target, new_name), delete_location\n'
        '- Grup / Hızlı Arama / Trunk / DID Kuralı / Rapor Güncelleme: update_subscriber_group, update_pickup_group, update_speed_dial, update_trunk (target, new_name), create_inbound_rule, update_inbound_rule (target, new_name, destination_target), delete_inbound_rule, add_blacklist, remove_blacklist, create_scheduled_report, update_scheduled_report (target, new_name, send_time)\n'
        "ÖNEMLİ KURAL: Kullanıcı sadece 'X in adını Y yap' gibi kısa bir isim değiştirme komutu verirse, yukarıdaki mevcut listelerden X'in hangi modüle (kullanıcı, kuyruk, AI asistan, mola, departman, konferans, trunk vb.) ait olduğunu bul ve ilgili update_* aksiyonunu üret! Yalnızca değişen alanları gönder, boş string gönderme.\n"
        'ÇIKTI FORMATI: {"explanation": "Kısa Türkçe özet", "actions": [ ... ]}\n'
        "Sadece JSON döndür."
    )

    provider_used = "semantic_engine"
    model_used = "Yerleşik Türkçe Komut Çözümleyici"
    fallback_used = False
    explanation = "Komutunuz analiz edildi ve santral güvenlik/çakışma kontrollerinden geçirilerek taslak plan hazırlandı."
    actions: List[Dict[str, Any]] = []
    warnings: List[str] = []
    perm_blocks: List[str] = []

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
            actions, warnings, perm_blocks = _validate_and_enrich_plan_actions(
                parsed["actions"], prompt_norm, ctx, is_admin, perms
            )
            if actions:
                if parsed.get("explanation"):
                    explanation = str(parsed["explanation"]).strip()
                provider_used = str(llm_res.get("provider_used") or "gemini")
                model_used = str(llm_res.get("model_used") or "")
                fallback_used = bool(llm_res.get("fallback_used", False))
    except Exception as e_plan:
        print(f"[AIConfigAssistant Plan Fallback Notice]: {e_plan}")

    # Fallback to deterministic Turkish semantic parser if LLM returned no valid actions
    if not actions:
        sem_raw = _parse_config_prompt_semantically(prompt, ctx)
        actions, warnings, perm_blocks = _validate_and_enrich_plan_actions(
            sem_raw, prompt_norm, ctx, is_admin, perms
        )
        provider_used = "semantic_engine"
        model_used = "Yerleşik Türkçe Komut Çözümleyici"
        fallback_used = True

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


def _match_dict_by_ref(d: Dict[str, Any], ref: str, keys: Tuple[str, ...]) -> bool:
    if not isinstance(d, dict):
        return False
    direct = _strip_quotes_and_apos(ref)
    cleaned = _clean_entity_ref(ref)
    stems: List[str] = []
    if direct:
        stems.extend(_strip_tr_possessive_variants(_tr_norm(direct)))
    if cleaned:
        for s in _strip_tr_possessive_variants(_tr_norm(cleaned)):
            if s not in stems:
                stems.append(s)
    norm_r = _tr_norm(direct or cleaned)
    for k in keys:
        val = d.get(k)
        if val is not None and str(val).strip():
            nv = _tr_norm(val)
            if nv in stems or (len(norm_r) >= 3 and norm_r in nv):
                return True
    return False


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
    backed_up_keys = (
        "users",
        "queues",
        "ai_agents",
        "conferences",
        "blacklist",
        "inbound_rules",
        "scheduled_reports",
        "breaks",
        "departments",
        "locations",
        "subscriber_groups",
        "call_pickup_groups",
        "speed_dials",
        "trunks",
    )
    snapshot: Dict[str, Any] = {
        "id": snapshot_id,
        "tenant_id": tenant_id,
        "created_at": now_tr_str,
        "created_by": user_label,
        "prompt": str(payload.get("prompt") or "").strip(),
        "reverted": False,
        "settings_backup": {k: copy.deepcopy(settings_db.get(k, [])) for k in backed_up_keys},
        "created_db_ids": {
            "users": [],
            "queues": [],
            "blacklist": [],
            "breaks": [],
        },
        "modified_users_prev": [],
        "modified_queues_prev": [],
        "modified_trunks_prev": [],
        "modified_breaks_prev": [],
        "deleted_users_prev": [],
        "deleted_queues_prev": [],
        "deleted_blacklist_prev": [],
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
            a_type = _ACTION_TYPE_ALIASES.get(a_type, a_type)
            params = dict(act.get("params") or {})
            if a_type not in ACTION_PERMISSION_MAP:
                continue

            perm_code, type_label = ACTION_PERMISSION_MAP[a_type]
            if not _has_perm(is_admin, perms, perm_code):
                skipped_results.append({"type": a_type, "reason": f"Yetki eksik ({perm_code})"})
                continue

            try:
                # --------------------------------------------------------------
                # USERS: CREATE / UPDATE (RENAME) / DELETE / FORWARDING
                # --------------------------------------------------------------
                if a_type == "create_user":
                    ext = str(params.get("extension") or "").strip()
                    full_name = str(params.get("full_name") or params.get("name") or f"Temsilci {ext}").strip()
                    role_val = str(params.get("role") or "agent").strip()
                    email_val = str(params.get("email") or "").strip() or f"ext{ext}@aida.local"
                    gsm_val = str(params.get("gsm_number") or "").strip() or None
                    dept_val = str(params.get("department") or "").strip() or None
                    sip_pass = resolve_secure_sip_password(ext, "")

                    new_u = SystemUser(
                        tenant_id=tenant_id,
                        full_name=full_name,
                        extension=ext,
                        role=role_val,
                        email=email_val,
                        gsm_number=gsm_val,
                        department_id=dept_val,
                        sip_username=ext,
                        sip_password=sip_pass,
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
                        "email": email_val,
                        "gsm_number": gsm_val or "",
                        "department": dept_val or "",
                        "department_id": dept_val or "",
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

                elif a_type == "update_user":
                    t_ref = _strip_quotes_and_apos(str(params.get("target_extension") or params.get("target") or params.get("extension") or ""))
                    u_rows = (await db.execute(_apply_tenant_clause(select(SystemUser), SystemUser, tenant_id))).scalars().all()
                    target_u = None
                    for u in u_rows:
                        if (
                            (params.get("target_id") and str(u.id) == str(params["target_id"]))
                            or _tr_norm(u.extension) == _tr_norm(t_ref)
                            or _tr_norm(u.full_name) == _tr_norm(t_ref)
                        ):
                            target_u = u
                            break
                    if not target_u:
                        for u in u_rows:
                            if len(t_ref) >= 3 and _tr_norm(t_ref) in _tr_norm(u.full_name):
                                target_u = u
                                break

                    matched_dict_u = None
                    for du in settings_db.get("users", []) or []:
                        if _match_dict_tenant(du, tenant_id) and _match_dict_by_ref(du, t_ref, ("extension", "full_name", "name", "id")):
                            matched_dict_u = du
                            break

                    if not target_u and not matched_dict_u:
                        skipped_results.append({"type": a_type, "reason": f"Kullanıcı/Dahili bulunamadı: {t_ref}"})
                        continue

                    old_display = f"{target_u.full_name} ({target_u.extension})" if target_u else f"{matched_dict_u.get('full_name') or matched_dict_u.get('name')} ({matched_dict_u.get('extension')})"
                    old_ext = str(target_u.extension if target_u else matched_dict_u.get("extension") or "")

                    if target_u:
                        snapshot["modified_users_prev"].append(
                            {
                                "id": target_u.id,
                                "full_name": target_u.full_name,
                                "extension": target_u.extension,
                                "role": target_u.role,
                                "email": target_u.email,
                                "gsm_number": target_u.gsm_number,
                                "department_id": target_u.department_id,
                                "is_active": target_u.is_active,
                                "forwarding_always": copy.deepcopy(target_u.forwarding_always),
                                "forwarding_busy": copy.deepcopy(target_u.forwarding_busy),
                                "forwarding_no_answer": copy.deepcopy(target_u.forwarding_no_answer),
                            }
                        )
                        if params.get("new_name"):
                            target_u.full_name = str(params["new_name"]).strip()
                        if params.get("new_extension"):
                            target_u.extension = str(params["new_extension"]).strip()
                            need_asterisk_sync = True
                        if params.get("role") in ("agent", "supervisor", "admin"):
                            target_u.role = str(params["role"]).strip()
                        if params.get("email"):
                            target_u.email = str(params["email"]).strip()
                        if params.get("gsm_number"):
                            target_u.gsm_number = str(params["gsm_number"]).strip()
                        if params.get("department"):
                            target_u.department_id = str(params["department"]).strip()
                        if "is_active" in params and params["is_active"] is not None:
                            target_u.is_active = bool(params["is_active"])

                    for du in settings_db.get("users", []) or []:
                        if not isinstance(du, dict) or not _match_dict_tenant(du, tenant_id):
                            continue
                        if (target_u and (str(du.get("id")) == str(target_u.id) or str(du.get("extension")) == old_ext)) or (du is matched_dict_u):
                            if params.get("new_name"):
                                du["full_name"] = str(params["new_name"]).strip()
                                if "name" in du:
                                    du["name"] = str(params["new_name"]).strip()
                            if params.get("new_extension"):
                                du["extension"] = str(params["new_extension"]).strip()
                                need_asterisk_sync = True
                            if params.get("role") in ("agent", "supervisor", "admin"):
                                du["role"] = str(params["role"]).strip()
                            if params.get("email"):
                                du["email"] = str(params["email"]).strip()
                            if params.get("gsm_number"):
                                du["gsm_number"] = str(params["gsm_number"]).strip()
                            if params.get("department"):
                                du["department"] = str(params["department"]).strip()
                                du["department_id"] = str(params["department"]).strip()
                            if "is_active" in params and params["is_active"] is not None:
                                du["is_active"] = bool(params["is_active"])

                    new_lbl = params.get("new_name") or (target_u.full_name if target_u else matched_dict_u.get("full_name"))
                    msg = f"Kullanıcı güncellendi: {old_display} → {new_lbl}"
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "delete_user":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    u_rows = (await db.execute(_apply_tenant_clause(select(SystemUser), SystemUser, tenant_id))).scalars().all()
                    target_u = next(
                        (u for u in u_rows if _tr_norm(u.extension) == _tr_norm(t_ref) or _tr_norm(u.full_name) == _tr_norm(t_ref)),
                        None,
                    )
                    removed_any = False
                    del_label = t_ref
                    if target_u:
                        del_label = f"{target_u.full_name} ({target_u.extension})"
                        snapshot["deleted_users_prev"].append(
                            {
                                "id": target_u.id,
                                "tenant_id": target_u.tenant_id,
                                "full_name": target_u.full_name,
                                "email": target_u.email,
                                "extension": target_u.extension,
                                "role": target_u.role,
                                "is_active": target_u.is_active,
                                "gsm_number": target_u.gsm_number,
                                "sip_username": target_u.sip_username,
                                "sip_password": target_u.sip_password,
                                "department_id": target_u.department_id,
                            }
                        )
                        await db.delete(target_u)
                        removed_any = True

                    before_len = len(settings_db.get("users", []) or [])
                    settings_db["users"] = [
                        du
                        for du in (settings_db.get("users", []) or [])
                        if not (_match_dict_tenant(du, tenant_id) and _match_dict_by_ref(du, t_ref, ("extension", "full_name", "name", "id")))
                    ]
                    if len(settings_db["users"]) < before_len:
                        removed_any = True

                    if removed_any:
                        need_asterisk_sync = True
                        msg = f"Kullanıcı/Dahili silindi: {del_label}"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Silinecek kullanıcı bulunamadı: {t_ref}"})

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
                                "full_name": u_row.full_name,
                                "extension": u_row.extension,
                                "role": u_row.role,
                                "email": u_row.email,
                                "gsm_number": u_row.gsm_number,
                                "department_id": u_row.department_id,
                                "is_active": u_row.is_active,
                                "forwarding_always": copy.deepcopy(u_row.forwarding_always),
                                "forwarding_busy": copy.deepcopy(u_row.forwarding_busy),
                                "forwarding_no_answer": copy.deepcopy(u_row.forwarding_no_answer),
                            }
                        )
                        setattr(u_row, col_name, fwd_payload)
                        if active_b and len(re.sub(r"\D", "", target)) >= 10 and not u_row.gsm_number:
                            u_row.gsm_number = target
                    for du in settings_db.get("users", []) or []:
                        if isinstance(du, dict) and str(du.get("extension")) == ext:
                            du[col_name] = fwd_payload
                    msg = f"Dahili {ext} yönlendirmesi ({col_name} → {target if active_b else 'Kapalı'}) güncellendi."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                # --------------------------------------------------------------
                # QUEUES: CREATE / UPDATE (RENAME) / MEMBERS / DELETE
                # --------------------------------------------------------------
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
                        queueMembers=members,
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
                        "queueMembers": members,
                        "members": members,
                    }
                    settings_db.setdefault("queues", []).append(q_dict)
                    need_asterisk_sync = True
                    msg = f"ACD Kuyruğu '{q_name}' ({q_ext}) oluşturuldu ({len(members)} üye)."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "update_queue":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    q_rows = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
                    target_q = next(
                        (q for q in q_rows if _tr_norm(q.extension) == _tr_norm(t_ref) or _tr_norm(q.name) == _tr_norm(t_ref)),
                        None,
                    )
                    if not target_q:
                        target_q = next((q for q in q_rows if len(t_ref) >= 3 and _tr_norm(t_ref) in _tr_norm(q.name)), None)

                    matched_dq = next(
                        (
                            dq
                            for dq in (settings_db.get("queues", []) or [])
                            if _match_dict_tenant(dq, tenant_id) and _match_dict_by_ref(dq, t_ref, ("extension", "queue_number", "name", "id"))
                        ),
                        None,
                    )
                    if not target_q and not matched_dq:
                        skipped_results.append({"type": a_type, "reason": f"Kuyruk bulunamadı: {t_ref}"})
                        continue

                    old_q_name = target_q.name if target_q else matched_dq.get("name")
                    old_q_ext = str(target_q.extension if target_q else (matched_dq.get("extension") or ""))

                    if target_q:
                        snapshot["modified_queues_prev"].append(
                            {
                                "id": target_q.id,
                                "name": target_q.name,
                                "extension": target_q.extension,
                                "strategy": target_q.strategy,
                                "timeout": target_q.timeout,
                                "queueMembers": list(target_q.queueMembers or []),
                            }
                        )
                        if params.get("new_name"):
                            target_q.name = str(params["new_name"]).strip()
                        if params.get("new_extension"):
                            target_q.extension = str(params["new_extension"]).strip()
                        if params.get("strategy"):
                            target_q.strategy = str(params["strategy"]).strip()
                        if params.get("timeout"):
                            target_q.timeout = int(params["timeout"])

                    for dq in settings_db.get("queues", []) or []:
                        if not isinstance(dq, dict) or not _match_dict_tenant(dq, tenant_id):
                            continue
                        if (target_q and (str(dq.get("id")) == str(target_q.id) or str(dq.get("extension")) == old_q_ext)) or (dq is matched_dq):
                            if params.get("new_name"):
                                dq["name"] = str(params["new_name"]).strip()
                            if params.get("new_extension"):
                                dq["extension"] = str(params["new_extension"]).strip()
                            if params.get("strategy"):
                                dq["strategy"] = str(params["strategy"]).strip()
                            if params.get("timeout"):
                                dq["timeout"] = int(params["timeout"])

                    need_asterisk_sync = True
                    msg = f"ACD Kuyruğu güncellendi: '{old_q_name}' ({old_q_ext}) → '{params.get('new_name') or old_q_name}'"
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type in ("add_queue_members", "remove_queue_members"):
                    q_ref = _strip_quotes_and_apos(str(params.get("queue") or ""))
                    mod_m = [str(m).strip() for m in (params.get("members") or []) if str(m).strip()]
                    stmt_q = _apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id)
                    q_rows = (await db.execute(stmt_q)).scalars().all()
                    target_q = next(
                        (q for q in q_rows if _tr_norm(q.extension) == _tr_norm(q_ref) or _tr_norm(q.name) == _tr_norm(q_ref)),
                        None,
                    )
                    if target_q:
                        prev_m = [str(x) for x in (target_q.queueMembers or [])]
                        snapshot["modified_queues_prev"].append(
                            {
                                "id": target_q.id,
                                "name": target_q.name,
                                "extension": target_q.extension,
                                "strategy": target_q.strategy,
                                "timeout": target_q.timeout,
                                "queueMembers": prev_m,
                            }
                        )
                        if a_type == "add_queue_members":
                            updated_m = list(dict.fromkeys(prev_m + mod_m))
                            verb = "üyeler eklendi"
                        else:
                            updated_m = [x for x in prev_m if x not in mod_m]
                            verb = "üyeler çıkarıldı"
                        target_q.queueMembers = updated_m
                        for dq in settings_db.get("queues", []) or []:
                            if isinstance(dq, dict) and (str(dq.get("id")) == str(target_q.id) or str(dq.get("extension")) == str(target_q.extension)):
                                dq["queueMembers"] = updated_m
                                dq["members"] = updated_m
                        need_asterisk_sync = True
                        msg = f"'{target_q.name}' ({target_q.extension}) kuyruğunda {verb}: {', '.join(mod_m)}"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Kuyruk bulunamadı: {q_ref}"})

                elif a_type == "delete_queue":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    q_rows = (await db.execute(_apply_tenant_clause(select(PBXQueue), PBXQueue, tenant_id))).scalars().all()
                    target_q = next(
                        (q for q in q_rows if _tr_norm(q.extension) == _tr_norm(t_ref) or _tr_norm(q.name) == _tr_norm(t_ref)),
                        None,
                    )
                    removed_any = False
                    if target_q:
                        snapshot["deleted_queues_prev"].append(
                            {
                                "id": target_q.id,
                                "tenant_id": target_q.tenant_id,
                                "name": target_q.name,
                                "extension": target_q.extension,
                                "strategy": target_q.strategy,
                                "timeout": target_q.timeout,
                                "queueMembers": list(target_q.queueMembers or []),
                            }
                        )
                        await db.delete(target_q)
                        removed_any = True
                    before_q = len(settings_db.get("queues", []) or [])
                    settings_db["queues"] = [
                        dq
                        for dq in (settings_db.get("queues", []) or [])
                        if not (_match_dict_tenant(dq, tenant_id) and _match_dict_by_ref(dq, t_ref, ("extension", "queue_number", "name", "id")))
                    ]
                    if len(settings_db["queues"]) < before_q:
                        removed_any = True
                    if removed_any:
                        need_asterisk_sync = True
                        msg = f"ACD Kuyruğu silindi: '{t_ref}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Silinecek kuyruk bulunamadı: {t_ref}"})

                # --------------------------------------------------------------
                # AI AGENTS: CREATE / UPDATE (RENAME) / DELETE
                # --------------------------------------------------------------
                elif a_type == "create_ai_agent":
                    nm = str(params.get("name") or "Yeni Sesli Asistan").strip()
                    ag_obj = {
                        "id": f"agent-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
                        "tenant_id": tenant_id,
                        "name": nm,
                        "voice": str(params.get("voice") or "Aoede"),
                        "tone": str(params.get("tone") or "kurumsal"),
                        "model": "gemini-2.5-flash-native-audio-preview-12-2025",
                        "provider": "google",
                        "system_instruction": str(params.get("system_instruction") or f"Sen {nm} isimli kurumsal sesli asistansın."),
                        "status": "active",
                        "transfer_target": str(params.get("transfer_target") or "1000"),
                    }
                    settings_db.setdefault("ai_agents", []).append(ag_obj)
                    msg = f"AI Sesli Asistan '{nm}' oluşturuldu."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "update_ai_agent":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    matched_ag = next(
                        (
                            a
                            for a in (settings_db.get("ai_agents", []) or [])
                            if _match_dict_tenant(a, tenant_id) and _match_dict_by_ref(a, t_ref, ("name", "id"))
                        ),
                        None,
                    )
                    if matched_ag:
                        old_nm = matched_ag.get("name")
                        if params.get("new_name"):
                            matched_ag["name"] = str(params["new_name"]).strip()
                        if params.get("transfer_target"):
                            matched_ag["transfer_target"] = str(params["transfer_target"]).strip()
                        if params.get("tone"):
                            matched_ag["tone"] = str(params["tone"]).strip()
                        if params.get("system_instruction"):
                            matched_ag["system_instruction"] = str(params["system_instruction"]).strip()
                        msg = f"AI Sesli Asistan güncellendi: '{old_nm}' → '{matched_ag.get('name')}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"AI Asistan bulunamadı: {t_ref}"})

                elif a_type == "delete_ai_agent":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    before_a = len(settings_db.get("ai_agents", []) or [])
                    settings_db["ai_agents"] = [
                        a
                        for a in (settings_db.get("ai_agents", []) or [])
                        if not (_match_dict_tenant(a, tenant_id) and _match_dict_by_ref(a, t_ref, ("name", "id")))
                    ]
                    if len(settings_db["ai_agents"]) < before_a:
                        msg = f"AI Sesli Asistan silindi: '{t_ref}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Silinecek AI Asistan bulunamadı: {t_ref}"})

                # --------------------------------------------------------------
                # CONFERENCES: CREATE / UPDATE (RENAME) / DELETE
                # --------------------------------------------------------------
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

                elif a_type == "update_conference":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    matched_c = next(
                        (
                            c
                            for c in (settings_db.get("conferences", []) or [])
                            if _match_dict_tenant(c, tenant_id) and _match_dict_by_ref(c, t_ref, ("room_number", "extension", "name", "id"))
                        ),
                        None,
                    )
                    if matched_c:
                        old_nm = matched_c.get("name")
                        if params.get("new_name"):
                            matched_c["name"] = str(params["new_name"]).strip()
                        if "pin" in params and params["pin"] is not None:
                            matched_c["pin"] = str(params["pin"]).strip()
                        if params.get("new_room_number"):
                            rn = str(params["new_room_number"]).strip()
                            matched_c["room_number"] = rn
                            matched_c["extension"] = rn
                        need_asterisk_sync = True
                        msg = f"Konferans Odası güncellendi: '{old_nm}' → '{matched_c.get('name')}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Konferans odası bulunamadı: {t_ref}"})

                elif a_type == "delete_conference":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    before_c = len(settings_db.get("conferences", []) or [])
                    settings_db["conferences"] = [
                        c
                        for c in (settings_db.get("conferences", []) or [])
                        if not (_match_dict_tenant(c, tenant_id) and _match_dict_by_ref(c, t_ref, ("room_number", "extension", "name", "id")))
                    ]
                    if len(settings_db["conferences"]) < before_c:
                        need_asterisk_sync = True
                        msg = f"Konferans Odası silindi: '{t_ref}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Konferans odası bulunamadı: {t_ref}"})

                # --------------------------------------------------------------
                # BREAKS: CREATE / UPDATE (RENAME) / DELETE
                # --------------------------------------------------------------
                elif a_type == "create_break_type":
                    nm = str(params.get("name") or "Özel Mola").strip()
                    mx = int(params.get("max_duration_minutes") or 15)
                    color_v = str(params.get("color") or "amber").strip()
                    b_row = BreakType(name=nm, color=color_v)
                    db.add(b_row)
                    await db.flush()
                    snapshot["created_db_ids"]["breaks"].append(b_row.id)
                    settings_db.setdefault("breaks", []).append(
                        {"id": b_row.id, "tenant_id": tenant_id, "name": nm, "color": color_v, "icon": "Coffee", "max_duration_minutes": mx}
                    )
                    msg = f"Mola tanımı '{nm}' ({mx} dk) eklendi."
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type == "update_break_type":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    matched_b = next(
                        (
                            b
                            for b in (settings_db.get("breaks", []) or [])
                            if _match_dict_tenant(b, tenant_id) and _match_dict_by_ref(b, t_ref, ("name", "id"))
                        ),
                        None,
                    )
                    b_rows = (await db.execute(select(BreakType))).scalars().all()
                    db_b = next((br for br in b_rows if _tr_norm(br.name) == _tr_norm(t_ref)), None)
                    if matched_b or db_b:
                        old_nm = matched_b.get("name") if matched_b else db_b.name
                        if db_b and params.get("new_name"):
                            snapshot["modified_breaks_prev"].append({"id": db_b.id, "name": db_b.name, "color": db_b.color})
                            db_b.name = str(params["new_name"]).strip()
                        if matched_b:
                            if params.get("new_name"):
                                matched_b["name"] = str(params["new_name"]).strip()
                            if params.get("max_duration_minutes"):
                                matched_b["max_duration_minutes"] = int(params["max_duration_minutes"])
                        msg = f"Mola tanımı güncellendi: '{old_nm}' → '{params.get('new_name') or old_nm}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Mola tanımı bulunamadı: {t_ref}"})

                elif a_type == "delete_break_type":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    before_b = len(settings_db.get("breaks", []) or [])
                    settings_db["breaks"] = [
                        b
                        for b in (settings_db.get("breaks", []) or [])
                        if not (_match_dict_tenant(b, tenant_id) and _match_dict_by_ref(b, t_ref, ("name", "id")))
                    ]
                    if len(settings_db["breaks"]) < before_b:
                        msg = f"Mola tanımı silindi: '{t_ref}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Mola tanımı bulunamadı: {t_ref}"})

                # --------------------------------------------------------------
                # DEPARTMENTS / LOCATIONS / GROUPS / SPEED DIALS / TRUNKS / RULES / REPORTS
                # --------------------------------------------------------------
                elif a_type in ("create_department", "create_location", "create_subscriber_group", "create_pickup_group"):
                    key_map = {
                        "create_department": "departments",
                        "create_location": "locations",
                        "create_subscriber_group": "subscriber_groups",
                        "create_pickup_group": "call_pickup_groups",
                    }
                    s_key = key_map[a_type]
                    nm = str(params.get("name") or "Yeni Kayıt").strip()
                    obj: Dict[str, Any] = {"id": str(uuid.uuid4()), "tenant_id": tenant_id, "name": nm}
                    if a_type == "create_subscriber_group":
                        obj["members"] = params.get("members") or []
                    elif a_type == "create_pickup_group":
                        obj["extensions"] = params.get("extensions") or params.get("members") or []
                    settings_db.setdefault(s_key, []).append(obj)
                    msg = f"{type_label} tamamlandı: '{nm}'"
                    applied_results.append({"type": a_type, "summary": msg})
                    snapshot["applied_summaries"].append(msg)

                elif a_type in ("update_department", "update_location", "update_subscriber_group", "update_pickup_group", "update_speed_dial", "update_inbound_rule", "update_scheduled_report"):
                    key_map = {
                        "update_department": ("departments", ("name", "id")),
                        "update_location": ("locations", ("name", "id")),
                        "update_subscriber_group": ("subscriber_groups", ("name", "id")),
                        "update_pickup_group": ("call_pickup_groups", ("name", "id")),
                        "update_speed_dial": ("speed_dials", ("code", "short_code", "name", "description", "id")),
                        "update_inbound_rule": ("inbound_rules", ("did_number", "did", "name", "id")),
                        "update_scheduled_report": ("scheduled_reports", ("name", "id")),
                    }
                    s_key, match_keys = key_map[a_type]
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    matched_obj = next(
                        (
                            it
                            for it in (settings_db.get(s_key, []) or [])
                            if _match_dict_tenant(it, tenant_id) and _match_dict_by_ref(it, t_ref, match_keys)
                        ),
                        None,
                    )
                    if matched_obj:
                        old_nm = matched_obj.get("name") or matched_obj.get("description") or matched_obj.get("did_number") or t_ref
                        if params.get("new_name"):
                            matched_obj["name"] = str(params["new_name"]).strip()
                            if "description" in matched_obj:
                                matched_obj["description"] = str(params["new_name"]).strip()
                        if params.get("destination_target"):
                            matched_obj["destination_target"] = str(params["destination_target"]).strip()
                            matched_obj["destination"] = str(params["destination_target"]).strip()
                            need_asterisk_sync = True
                        if params.get("target_number"):
                            matched_obj["target"] = str(params["target_number"]).strip()
                            matched_obj["number"] = str(params["target_number"]).strip()
                        if params.get("send_time"):
                            matched_obj["send_time"] = str(params["send_time"]).strip()
                        msg = f"{type_label}: '{old_nm}' → '{params.get('new_name') or old_nm}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Kayıt bulunamadı: {t_ref}"})

                elif a_type == "update_trunk":
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    t_rows = (await db.execute(_apply_tenant_clause(select(Trunk), Trunk, tenant_id))).scalars().all()
                    target_t = next((t for t in t_rows if _tr_norm(t.trunk_name) == _tr_norm(t_ref) or str(t.id) == t_ref), None)
                    matched_dt = next(
                        (
                            dt
                            for dt in (settings_db.get("trunks", []) or [])
                            if _match_dict_tenant(dt, tenant_id) and _match_dict_by_ref(dt, t_ref, ("trunk_name", "name", "id"))
                        ),
                        None,
                    )
                    if target_t or matched_dt:
                        old_nm = target_t.trunk_name if target_t else (matched_dt.get("trunk_name") or matched_dt.get("name"))
                        if target_t and params.get("new_name"):
                            snapshot["modified_trunks_prev"].append({"id": target_t.id, "trunk_name": target_t.trunk_name})
                            target_t.trunk_name = str(params["new_name"]).strip()
                        if matched_dt and params.get("new_name"):
                            matched_dt["trunk_name"] = str(params["new_name"]).strip()
                            matched_dt["name"] = str(params["new_name"]).strip()
                        need_asterisk_sync = True
                        msg = f"SIP Trunk güncellendi: '{old_nm}' → '{params.get('new_name') or old_nm}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"SIP Trunk bulunamadı: {t_ref}"})

                elif a_type in ("delete_department", "delete_location", "delete_inbound_rule"):
                    key_map = {
                        "delete_department": ("departments", ("name", "id")),
                        "delete_location": ("locations", ("name", "id")),
                        "delete_inbound_rule": ("inbound_rules", ("did_number", "did", "name", "id")),
                    }
                    s_key, m_keys = key_map[a_type]
                    t_ref = _strip_quotes_and_apos(str(params.get("target") or ""))
                    before_cnt = len(settings_db.get(s_key, []) or [])
                    settings_db[s_key] = [
                        it
                        for it in (settings_db.get(s_key, []) or [])
                        if not (_match_dict_tenant(it, tenant_id) and _match_dict_by_ref(it, t_ref, m_keys))
                    ]
                    if len(settings_db[s_key]) < before_cnt:
                        if a_type == "delete_inbound_rule":
                            need_asterisk_sync = True
                        msg = f"{type_label} tamamlandı: '{t_ref}'"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Silinecek kayıt bulunamadı: {t_ref}"})

                elif a_type == "create_speed_dial":
                    code = str(params.get("code") or "*10").strip()
                    nm = str(params.get("name") or f"Hızlı Arama {code}").strip()
                    dest = str(params.get("target_number") or "").strip()
                    settings_db.setdefault("speed_dials", []).append(
                        {"id": str(uuid.uuid4()), "tenant_id": tenant_id, "code": code, "short_code": code, "name": nm, "description": nm, "target": dest, "number": dest}
                    )
                    need_asterisk_sync = True
                    msg = f"Hızlı Arama '{nm}' ({code} → {dest}) eklendi."
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

                elif a_type == "remove_blacklist":
                    val = _strip_quotes_and_apos(str(params.get("target") or params.get("value") or ""))
                    bl_rows = (await db.execute(select(BlacklistItem))).scalars().all()
                    matched_bl = next((b for b in bl_rows if val and val in str(b.value or "")), None)
                    removed_bl = False
                    if matched_bl:
                        snapshot["deleted_blacklist_prev"].append(
                            {"type": matched_bl.type, "value": matched_bl.value, "reason": matched_bl.reason}
                        )
                        await db.delete(matched_bl)
                        removed_bl = True
                    before_bl = len(settings_db.get("blacklist", []) or [])
                    settings_db["blacklist"] = [
                        b for b in (settings_db.get("blacklist", []) or []) if not (isinstance(b, dict) and val and val in str(b.get("value") or ""))
                    ]
                    if len(settings_db["blacklist"]) < before_bl:
                        removed_bl = True
                    if removed_bl:
                        msg = f"Kara listeden kaldırıldı: {val}"
                        applied_results.append({"type": a_type, "summary": msg})
                        snapshot["applied_summaries"].append(msg)
                    else:
                        skipped_results.append({"type": a_type, "reason": f"Kara listede bulunamadı: {val}"})

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

        # Restore modified users (including full_name, extension, role, email, forwarding, etc.)
        for u_prev in target.get("modified_users_prev") or []:
            u_row = (await db.execute(select(SystemUser).where(SystemUser.id == u_prev["id"]))).scalars().first()
            if u_row:
                if "full_name" in u_prev and u_prev["full_name"] is not None:
                    u_row.full_name = u_prev["full_name"]
                if "extension" in u_prev and u_prev["extension"] is not None:
                    u_row.extension = u_prev["extension"]
                if "role" in u_prev and u_prev["role"] is not None:
                    u_row.role = u_prev["role"]
                if "email" in u_prev and u_prev["email"] is not None:
                    u_row.email = u_prev["email"]
                if "department_id" in u_prev:
                    u_row.department_id = u_prev.get("department_id")
                if "is_active" in u_prev and u_prev["is_active"] is not None:
                    u_row.is_active = bool(u_prev["is_active"])
                u_row.forwarding_always = u_prev.get("forwarding_always")
                u_row.forwarding_busy = u_prev.get("forwarding_busy")
                u_row.forwarding_no_answer = u_prev.get("forwarding_no_answer")
                u_row.gsm_number = u_prev.get("gsm_number")

        # Restore modified queues (including name, extension, strategy, timeout, queueMembers)
        for q_prev in target.get("modified_queues_prev") or []:
            q_row = (await db.execute(select(PBXQueue).where(PBXQueue.id == q_prev["id"]))).scalars().first()
            if q_row:
                if "name" in q_prev and q_prev["name"] is not None:
                    q_row.name = q_prev["name"]
                if "extension" in q_prev and q_prev["extension"] is not None:
                    q_row.extension = q_prev["extension"]
                if "strategy" in q_prev and q_prev["strategy"] is not None:
                    q_row.strategy = q_prev["strategy"]
                if "timeout" in q_prev and q_prev["timeout"] is not None:
                    q_row.timeout = int(q_prev["timeout"])
                q_row.queueMembers = q_prev.get("queueMembers") if "queueMembers" in q_prev else (q_prev.get("members") or [])

        # Restore modified trunks & breaks
        for t_prev in target.get("modified_trunks_prev") or []:
            t_row = (await db.execute(select(Trunk).where(Trunk.id == t_prev["id"]))).scalars().first()
            if t_row and t_prev.get("trunk_name"):
                t_row.trunk_name = t_prev["trunk_name"]

        for b_prev in target.get("modified_breaks_prev") or []:
            b_row = (await db.execute(select(BreakType).where(BreakType.id == b_prev["id"]))).scalars().first()
            if b_row and b_prev.get("name"):
                b_row.name = b_prev["name"]

        # Re-insert deleted DB rows if any
        for du_prev in target.get("deleted_users_prev") or []:
            db.add(
                SystemUser(
                    tenant_id=du_prev.get("tenant_id") or "tenant-default",
                    full_name=du_prev["full_name"],
                    email=du_prev["email"],
                    extension=du_prev["extension"],
                    role=du_prev.get("role") or "agent",
                    is_active=bool(du_prev.get("is_active", True)),
                    gsm_number=du_prev.get("gsm_number"),
                    sip_username=du_prev.get("sip_username"),
                    sip_password=du_prev.get("sip_password"),
                    department_id=du_prev.get("department_id"),
                )
            )

        for dq_prev in target.get("deleted_queues_prev") or []:
            db.add(
                PBXQueue(
                    tenant_id=dq_prev.get("tenant_id") or "tenant-default",
                    name=dq_prev["name"],
                    extension=dq_prev["extension"],
                    strategy=dq_prev.get("strategy") or "ringall",
                    timeout=int(dq_prev.get("timeout") or 15),
                    queueMembers=dq_prev.get("queueMembers") or [],
                )
            )

        for dbl_prev in target.get("deleted_blacklist_prev") or []:
            db.add(BlacklistItem(type=dbl_prev["type"], value=dbl_prev["value"], reason=dbl_prev.get("reason")))

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

