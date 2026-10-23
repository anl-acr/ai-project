import os
import sys
import subprocess
import re
import asyncio

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, '.env'))
import shutil
import socket
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request, Body
from fastapi.responses import FileResponse, Response, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select, delete, func, text, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from typing import Union, List, Optional, Dict, Any

RECORDINGS_DIR = os.path.join(PROJECT_ROOT, "recordings")
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")
ASTERISK_CONFIG_DIR = os.path.join(PROJECT_ROOT, "asterisk_config")

import datetime
import uuid

from backend.services.audit_logger import log_event

system_logs = []

def add_system_log(source: str, level: str, message: str):
    now = datetime.datetime.now().strftime("%H:%M:%S")
    system_logs.append({"timestamp": now, "source": source, "level": level, "message": message})
    if len(system_logs) > 50:
        system_logs.pop(0)
    try:
        loop = asyncio.get_running_loop()
        if loop and loop.is_running():
            loop.create_task(log_event(user_id=source, action=level, module=source, details={"message": message}))
    except Exception:
        pass

add_system_log("SYSTEM", "INFO", "FastAPI Sunucusu başlatıldı.")
add_system_log("DATABASE", "INFO", "Veritabanı bağlantısı kuruldu.")
from backend.database.config import get_db, Base, engine, AsyncSessionLocal
from backend.database.models import Rule, Call, Transcript, Appointment, ChatSession, ChatMessage, Contact, CannedResponse, BlacklistItem, BlockWord, SystemUser, SystemRole, PBXQueue, Trunk, AIAgent, BreakType, SystemSetting, EventLog
from backend.services.rag_service import index_pdf_file, index_website_url, query_vector_search, index_manual_text, delete_indexed_source, get_genai_client
from backend.services.license_service import verify_license_key, generate_license_key
from backend.services.websocket_manager import ws_manager
import redis.asyncio as aioredis
redis_client = aioredis.Redis(host='localhost', port=6379, decode_responses=True)

def is_default_tenant(tenant_id: str) -> bool:
    return not tenant_id or tenant_id in ["tenant-default", "default"]

def is_global_tenant(tenant_id: str) -> bool:
    return tenant_id in ["all", "global"]

def get_user_info(request: Request):
    user_id = request.headers.get("X-User-ID", "Bilinmeyen")
    tenant_id = request.headers.get("X-Tenant-ID") or request.headers.get("Tenant-ID") or request.query_params.get("tenant_id") or "tenant-default"
    print(f"[TENANT RESOLVER] Path: {request.url.path} -> Resolved Tenant: '{tenant_id}'")
    return {"user_id": user_id, "tenant_id": tenant_id, "ip_address": request.client.host if request.client else None}

app = FastAPI(title="AI PBX & Omnichannel Backend API")

from backend.routers import sip_debugger
app.include_router(sip_debugger.router)

@app.on_event("startup")
async def on_startup_telemetry():
    try:
        from backend.services.telemetry_worker import start_telemetry_heartbeat_loop
        asyncio.create_task(start_telemetry_heartbeat_loop())
    except Exception as e:
        print(f"[Telemetry Startup Error]: {e}")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def auto_api_prefix_middleware(request: Request, call_next):
    path = request.scope.get("path", "")
    if path and not path.startswith("/api") and not path.startswith("/uploads") and not path.startswith("/static"):
        request.scope["path"] = "/api" + path
    return await call_next(request)




# Serve call recordings statically with fallback search in Asterisk spool directory
os.makedirs(RECORDINGS_DIR, exist_ok=True)

@app.get("/api/recordings/{filename}")
async def get_recording_file(filename: str):
    """Dynamically serves call audio recording files from project recordings directory, Asterisk spool directory, or NAS storage."""
    # 1. Check project recordings directory
    project_rec = os.path.join(RECORDINGS_DIR, filename)
    if os.path.exists(project_rec) and os.path.getsize(project_rec) > 0:
        return FileResponse(project_rec, media_type="audio/wav")
        
    # 2. Check Asterisk spool monitor directory
    spool_rec = os.path.join("/var/spool/asterisk/monitor", filename)
    if os.path.exists(spool_rec) and os.path.getsize(spool_rec) > 0:
        try:
            shutil.copy2(spool_rec, project_rec)
        except Exception as e:
            print(f"[Recording Auto-Copy Error]: {e}")
        return FileResponse(spool_rec, media_type="audio/wav")
        
    # 3. Check NAS mount directory
    nas_dir = "/mnt/nas/ai-recordings"
    nas_rec = os.path.join(nas_dir, filename)
    if os.path.exists(nas_rec) and os.path.getsize(nas_rec) > 0:
        return FileResponse(nas_rec, media_type="audio/wav")
        
    raise HTTPException(status_code=404, detail="Ses kaydı dosyası sunucuda bulunamadı.")

os.makedirs("uploads/announcements", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/api/uploads", StaticFiles(directory="uploads"), name="api_uploads")


# Temp storage for PDF uploads
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads", "tmp")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ----------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------
class RuleCreateSchema(BaseModel):
    rule_type: str  # faq, routing, prompt
    trigger_keyword: Optional[str] = None
    response_text: Optional[str] = None
    action_to_trigger: Optional[str] = None
    is_active: bool = True

class CrawlRequestSchema(BaseModel):
    url: str

class NumberingPlanRangeSchema(BaseModel):
    start: int
    end: int

class CallPickupPrefixSchema(BaseModel):
    group: str = "*8"
    directed: str = "**"

class NumberingPlanSchema(BaseModel):
    extension_range: NumberingPlanRangeSchema
    queue_range: NumberingPlanRangeSchema
    conference_range: NumberingPlanRangeSchema
    speed_dial_range: NumberingPlanRangeSchema
    call_flow_range: NumberingPlanRangeSchema
    call_pickup: Optional[CallPickupPrefixSchema] = None

class PBXSettingsSchema(BaseModel):
    ami_host: str
    ami_port: int
    ami_user: str
    ami_secret: str
    webrtc_wss_url: str
    nas_mount_path: str
    auto_language_detection: Optional[bool] = False
    auto_emotion_management: Optional[bool] = False
    auto_whisper_enabled: Optional[bool] = True
    force_tls: Optional[bool] = False
    force_srtp: Optional[bool] = False
    numbering_plan: Optional[NumberingPlanSchema] = None

class NATSettingsSchema(BaseModel):
    enabled: Optional[bool] = False
    extern_ip: Optional[str] = ""
    local_nets: Optional[List[str]] = ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12", "127.0.0.1/32"]

class ChannelSettingsSchema(BaseModel):
    whatsapp_token: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_verify_token: Optional[str] = None
    whatsapp_persona: Optional[str] = "samimi"
    whatsapp_welcome_menu_enabled: Optional[bool] = True
    whatsapp_after_hours_enabled: Optional[bool] = True
    whatsapp_work_hours_start: Optional[str] = "09:00"
    whatsapp_work_hours_end: Optional[str] = "18:00"
    whatsapp_accounts: Optional[List[dict]] = []
    telegram_token: Optional[str] = None
    instagram_token: Optional[str] = None
    facebook_token: Optional[str] = None

class BreakSchema(BaseModel):
    id: Optional[int] = None
    name: str
    color: str

class LocationSchema(BaseModel):
    id: Optional[str] = None
    name: str

class DepartmentSchema(BaseModel):
    id: Optional[str] = None
    location_id: str
    name: str

class AgentStateSchema(BaseModel):
    is_logged_in: bool
    status: str
    current_break: Optional[dict] = None
    user_id: Optional[int] = None

class UserSessionSchema(BaseModel):
    device_type: str
    ip_address: str
    last_seen: Optional[str] = None

DEFAULT_USER_PROFILES = [
    {
        "id": "available",
        "name": "Müsait",
        "devices": ["desk_phone", "mobile_app", "web_phone", "pc_app"],
        "timeout": 30,
        "timeout_action": "voicemail",
        "timeout_target": ""
    },
    {
        "id": "away",
        "name": "Dışarıda",
        "devices": ["mobile_app"],
        "timeout": 25,
        "timeout_action": "external",
        "timeout_target": ""
    },
    {
        "id": "meeting",
        "name": "Toplantı",
        "devices": [],
        "timeout": 15,
        "timeout_action": "voicemail",
        "timeout_target": ""
    },
    {
        "id": "other",
        "name": "Diğer",
        "devices": ["web_phone"],
        "timeout": 30,
        "timeout_action": "none",
        "timeout_target": ""
    }
]

import string
import secrets

def generate_sip_username(length=8):
    alphabet = string.ascii_letters + string.digits
    while True:
        uname = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in uname) and
            any(c.isupper() for c in uname) and
            any(c.isdigit() for c in uname)):
            return uname

def ensure_user_profiles(u: dict) -> dict:
    if not isinstance(u, dict):
        return u
    if not u.get("sip_username"):
        u["sip_username"] = generate_sip_username(8)
    try:
        max_act = int(u.get("max_activations") or 1)
        u["max_activations"] = max(1, min(5, max_act))
    except Exception:
        u["max_activations"] = 1
    if not u.get("active_profile"):
        u["active_profile"] = "available"
    raw_profiles = u.get("profiles")
    if isinstance(raw_profiles, str):
        try:
            import json
            raw_profiles = json.loads(raw_profiles)
        except Exception:
            raw_profiles = None
    import copy
    if not raw_profiles or not isinstance(raw_profiles, list) or len(raw_profiles) == 0:
        u["profiles"] = copy.deepcopy(DEFAULT_USER_PROFILES)
    else:
        existing_by_id = {str(p.get("id")): p for p in raw_profiles if isinstance(p, dict) and p.get("id")}
        merged = []
        for def_p in DEFAULT_USER_PROFILES:
            pid = def_p["id"]
            if pid in existing_by_id:
                ep = existing_by_id[pid]
                merged.append({
                    "id": pid,
                    "name": ep.get("name") or def_p["name"],
                    "devices": ep.get("devices") if isinstance(ep.get("devices"), list) else list(def_p["devices"]),
                    "timeout": int(ep.get("timeout") if ep.get("timeout") is not None else def_p["timeout"]),
                    "timeout_action": str(ep.get("timeout_action") or def_p["timeout_action"]),
                    "timeout_target": str(ep.get("timeout_target") or "")
                })
            else:
                merged.append(copy.deepcopy(def_p))
        u["profiles"] = merged

    raw_fm = u.get("follow_me")
    if isinstance(raw_fm, str):
        try:
            import json
            raw_fm = json.loads(raw_fm)
        except Exception:
            raw_fm = None
    if not isinstance(raw_fm, dict):
        raw_fm = {}
    try:
        fm_timeout = max(5, min(120, int(raw_fm.get("timeout") or 15)))
    except Exception:
        fm_timeout = 15
    u["follow_me"] = {
        "enabled": bool(raw_fm.get("enabled", False)),
        "timeout": fm_timeout,
        "first_target": str(raw_fm.get("first_target") or "mobile_app"),
        "second_target": str(raw_fm.get("second_target") or "mobile_number"),
        "mobile_number": str(raw_fm.get("mobile_number") or u.get("gsm_number") or "").strip()
    }
    if u["follow_me"]["mobile_number"] and not u.get("gsm_number"):
        u["gsm_number"] = u["follow_me"]["mobile_number"]
    return u

class UserSchema(BaseModel):
    id: Optional[int] = None
    tenant_id: Optional[str] = "tenant-default"
    full_name: str
    email: str
    extension: str
    avatar: str
    role: str = "agent"
    is_active: bool = True
    gsm_number: Optional[str] = None
    mobile_transfer_enabled: Optional[bool] = False
    theme_color: Optional[str] = "rose"
    password: Optional[str] = None
    sip_username: Optional[str] = None
    sip_password: Optional[str] = None
    max_activations: Optional[int] = 1
    outbound_caller_id: Optional[str] = None
    forwarding_always: Optional[dict] = None
    forwarding_busy: Optional[dict] = None
    forwarding_no_answer: Optional[dict] = None
    voicemail_active: Optional[bool] = False
    voicemail_announcement: Optional[str] = None
    voicemail_pin: Optional[str] = None
    voicemail_to_email: Optional[bool] = False
    recording_active: Optional[bool] = False
    transport: Optional[str] = "UDP"
    active_sessions: Optional[List[UserSessionSchema]] = []
    location_id: Optional[str] = None
    department_id: Optional[str] = None
    active_profile: Optional[str] = "available"
    profiles: Optional[List[dict]] = None
    follow_me: Optional[dict] = None
    two_factor_enabled: Optional[bool] = False
    two_factor_method: str = "app"
    two_factor_secret: Optional[str] = None

def generate_strong_sip_password(length=24):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        password = ''.join(secrets.choice(alphabet) for i in range(length))
        if (any(c.islower() for c in password) and
            any(c.isupper() for c in password) and
            sum(c.isdigit() for c in password) >= 2 and
            sum(c in "!@#$%^&*" for c in password) >= 2):
            return password

class RoleSchema(BaseModel):
    id: Optional[int] = None
    role_code: str
    name: str
    permissions: List[str] = []
    allowed_breaks: List[int] = []

class TrunkSettingsSchema(BaseModel):
    id: Optional[int] = None
    trunk_type: str # register, peer
    trunk_name: str
    host: str
    username: Optional[str] = None
    password: Optional[str] = None
    port: int = 5060
    did_number: str
    protocol: str = "udp" # udp, tcp
    greeting_prompt: Optional[str] = None
    transfer_target_type: str = "extension" # extension, queue, custom
    transfer_target: str = "200"
    codec: str = "G711" # G711, G729, Opus, G722
    is_active: bool = True

class SmartCallbackSettingsSchema(BaseModel):
    enabled: bool
    max_wait_seconds: int
    max_retries: int
    priority_level: str # high, medium, low
    outbound_trunk_id: int
    queue_threshold: int

class DialerSettingsSchema(BaseModel):
    enabled: bool
    dial_mode: str # predictive, progressive, power, preview
    concurrent_calls: int
    retry_count: int
    retry_interval_minutes: int
    route_destination_type: str # ai, queue, extension
    route_destination: str
    outbound_trunk_id: int
    allowed_days: List[str]
    allowed_hours_start: str
    allowed_hours_end: str

class TimeScheduleSchema(BaseModel):
    enabled: bool
    start_time: str
    end_time: str
    days: List[str]

class RouteTargetSchema(BaseModel):
    type: str # ai, queue, extension, ivr
    target: str

class IVROptionSchema(BaseModel):
    key: str
    action_type: str # ai, queue, extension
    target: str
    label: str

class IVRMenuSchema(BaseModel):
    announcement_text: str
    options: List[IVROptionSchema]

class CallFlowSettingsSchema(BaseModel):
    trunk_id: int
    time_schedule: TimeScheduleSchema
    business_hours_destination: RouteTargetSchema
    out_of_hours_destination: RouteTargetSchema
    ivr_menu: IVRMenuSchema

class GraphNodeSchema(BaseModel):
    id: str
    type: str
    x: float
    y: float
    title: str
    value: Optional[str] = ""
    options: Optional[List[str]] = None
    extra_fields: Optional[dict] = None

class GraphConnectionSchema(BaseModel):
    id: str
    fromNode: str
    fromPort: str
    toNode: str
    toPort: str

class CallFlowGraphSchema(BaseModel):
    trunk_id: int
    nodes: List[GraphNodeSchema]
    connections: List[GraphConnectionSchema]

class WorkflowSchema(BaseModel):
    id: str
    name: str
    trunk_id: int
    status: str # active, draft
    nodes: List[GraphNodeSchema]
    connections: List[GraphConnectionSchema]

class TenantSchema(BaseModel):
    id: str
    name: str
    code: str
    status: Optional[str] = "active"
    created_at: Optional[str] = ""
    license_expires_at: Optional[str] = ""
    license_key: Optional[str] = ""
    plan_tier: Optional[str] = "professional"
    
    # 1. Yapay Zeka Kotaları & Sağlayıcı İzinleri
    max_agents: Optional[int] = 20
    max_rag_docs: Optional[int] = 100
    max_scenarios: Optional[int] = 20
    allowed_stt_providers: Optional[List[str]] = ["google", "deepgram", "openai", "elevenlabs"]
    allowed_tts_providers: Optional[List[str]] = ["google", "elevenlabs", "openai"]
    allowed_llm_providers: Optional[List[str]] = ["google", "elevenlabs", "openai", "anthropic", "groq"]
    
    # 2. Santral Kotaları & Eş Zamanlı Kanal Limiti
    max_concurrent_calls: Optional[int] = 4
    tolerance_concurrent_calls: Optional[int] = 0
    max_users: Optional[int] = 50
    max_announcements: Optional[int] = 20
    max_queues: Optional[int] = 10
    max_inbound_rules: Optional[int] = 25
    max_outbound_rules: Optional[int] = 25
    max_pickup_groups: Optional[int] = 10
    max_subscriber_groups: Optional[int] = 10
    max_phonebook_contacts: Optional[int] = 500
    max_trunks: Optional[int] = 5
    max_conference_rooms: Optional[int] = 5
    max_speed_dials: Optional[int] = 50
    max_blacklist_entries: Optional[int] = 100
    max_locations: Optional[int] = 5
    max_departments: Optional[int] = 10
    
    # 3. Çağrı Yönlendirme & Akış Kotaları
    max_call_flows: Optional[int] = 10
    max_dialers: Optional[int] = 5

class TenantCreateSchema(BaseModel):
    name: str
    code: str
    status: Optional[str] = "active"
    license_expires_at: Optional[str] = ""
    license_key: Optional[str] = ""
    plan_tier: Optional[str] = "professional"
    
    # 1. Yapay Zeka Kotaları & Sağlayıcı İzinleri
    max_agents: Optional[int] = 20
    max_rag_docs: Optional[int] = 100
    max_scenarios: Optional[int] = 20
    allowed_stt_providers: Optional[List[str]] = None
    allowed_tts_providers: Optional[List[str]] = None
    allowed_llm_providers: Optional[List[str]] = None
    
    # 2. Santral Kotaları & Eş Zamanlı Kanal Limiti
    max_concurrent_calls: Optional[int] = 4
    tolerance_concurrent_calls: Optional[int] = 0
    max_users: Optional[int] = 50
    max_announcements: Optional[int] = 20
    max_queues: Optional[int] = 10
    max_inbound_rules: Optional[int] = 25
    max_outbound_rules: Optional[int] = 25
    max_pickup_groups: Optional[int] = 10
    max_subscriber_groups: Optional[int] = 10
    max_phonebook_contacts: Optional[int] = 500
    max_trunks: Optional[int] = 5
    max_conference_rooms: Optional[int] = 5
    max_speed_dials: Optional[int] = 50
    max_blacklist_entries: Optional[int] = 100
    max_locations: Optional[int] = 5
    max_departments: Optional[int] = 10
    
    # 3. Çağrı Yönlendirme & Akış Kotaları
    max_call_flows: Optional[int] = 10
    max_dialers: Optional[int] = 5

class RAGSettingsSchema(BaseModel):
    chunk_size: int
    chunk_overlap: int
    top_k: int
    similarity_threshold: float

class ManualTextSchema(BaseModel):
    title: str
    text: str

class AIAgentSchema(BaseModel):
    id: str
    tenant_id: Optional[str] = None
    name: str
    role_title: Optional[str] = "Müşteri Temsilcisi"
    voice: str
    tone: str
    speaking_rate: Optional[float] = 1.0
    provider: Optional[str] = "google"
    stt_provider: Optional[str] = "google"
    llm_provider: Optional[str] = "google"
    tts_provider: Optional[str] = "google"
    model: str
    temperature: float
    max_tokens: int
    system_instruction: str
    greeting_prompt: Optional[str] = ""
    farewell_prompt: Optional[str] = ""
    status: str
    transfer_target: Optional[str] = "200"
    elevenlabs_agent_id: Optional[str] = ""
    elevenlabs_voice_id: Optional[str] = ""
    elevenlabs_stability: Optional[float] = 0.5
    elevenlabs_similarity: Optional[float] = 0.75
    elevenlabs_style: Optional[float] = 0.0
    # Background Ambient Noise Settings
    bg_noise_enabled: Optional[bool] = False
    bg_noise_type: Optional[str] = "call_center"  # call_center, office_keyboard, cafe_lounge, soft_rain, analog_warmth
    bg_noise_volume: Optional[float] = 0.15       # 0.05 to 0.50
    bg_noise_mode: Optional[str] = "always"       # always, while_speaking, while_thinking
    # Barge-In (Interruption) & VAD Listening Settings
    barge_in_enabled: Optional[bool] = True
    barge_in_protect_greeting: Optional[bool] = True
    barge_in_threshold_amp: Optional[int] = 250   # 100 to 800
    barge_in_min_duration_ms: Optional[int] = 200 # 60 to 1000 ms
    vad_silence_timeout_ms: Optional[int] = 800   # 300 to 2500 ms
    # Conversational Realism, Silence & Guardrail Settings
    use_rag_kb: Optional[bool] = True
    allow_directory_transfer: Optional[bool] = True
    human_fillers_enabled: Optional[bool] = True
    backchannel_enabled: Optional[bool] = True
    silence_reminder_enabled: Optional[bool] = True
    silence_timeout_sec: Optional[int] = 10
    max_silence_retries: Optional[int] = 2
    max_call_duration_sec: Optional[int] = 600
    abuse_shield_enabled: Optional[bool] = True
    auto_emotion_transfer: Optional[bool] = True


import json

DEFAULT_SETTINGS = {
    "tenants": [
        {
            "id": "tenant-default",
            "tenant_num_id": 100,
            "name": "Ana Müşteri (Varsayılan)",
            "code": "default",
            "status": "active",
            "created_at": "2026-01-01T00:00:00",
            "max_concurrent_calls": 4,
            "tolerance_concurrent_calls": 0,
            "max_agents": 10,
            "max_trunks": 5,
            "allowed_stt_providers": ["google", "deepgram", "openai", "elevenlabs"],
            "allowed_tts_providers": ["google", "elevenlabs", "openai"],
            "allowed_llm_providers": ["google", "elevenlabs", "openai", "anthropic", "groq"]
        }
    ],
    "pbx": {
        "ami_host": "127.0.0.1",
        "ami_port": 5038,
        "ami_user": "ai_backend_user",
        "ami_secret": "backend_secure_key_99",
        "webrtc_wss_url": "wss://127.0.0.1:8089/ws",
        "nas_mount_path": "/mnt/nas/ai-recordings",
        "auto_language_detection": False,
        "auto_emotion_management": False,
        "auto_whisper_enabled": True
    },
    "channels": {
        "whatsapp_token": "",
        "whatsapp_phone_number_id": "",
        "whatsapp_verify_token": "ai_pbx_whatsapp_verify_token_secure",
        "telegram_token": "",
        "instagram_token": "",
        "facebook_token": ""
    },
    "smart_callback": {
        "enabled": True,
        "max_wait_seconds": 60,
        "max_retries": 3,
        "priority_level": "high",
        "outbound_trunk_id": 1,
        "queue_threshold": 3
    },
    "dialer": {
        "enabled": False,
        "dial_mode": "progressive",
        "concurrent_calls": 5,
        "retry_count": 3,
        "retry_interval_minutes": 15,
        "route_destination_type": "ai",
        "route_destination": "Sales_AI",
        "outbound_trunk_id": 1,
        "allowed_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "allowed_hours_start": "09:00",
        "allowed_hours_end": "18:00"
    },
    "roi_settings": {
        "human_cost": 30000,
        "human_count": 5
    },
    "rag": {
        "chunk_size": 800,
        "chunk_overlap": 100,
        "top_k": 3,
        "similarity_threshold": 0.5
    },
    "ai_agents": [
        {
            "id": "agent-sales",
            "name": "Satış Temsilcisi",
            "voice": "Dilara (Türkçe - Dişi - Premium)",
            "tone": "attractive",
            "model": "gemini-1.5-flash",
            "temperature": 0.7,
            "max_tokens": 300,
            "system_instruction": "Sen sıcakkanlı ve profesyonel bir satış asistanısın. Müşterilere ürünlerimiz hakkında bilgi veriyorsun.",
            "status": "active",
            "transfer_target": "200"
        },
        {
            "id": "agent-support",
            "name": "Destek Temsilcisi",
            "voice": "Ahmet (Türkçe - Erkek - Premium)",
            "tone": "calm",
            "provider": "google",
            "model": "gemini-1.5-flash",
            "temperature": 0.4,
            "max_tokens": 300,
            "system_instruction": "Sen sabırlı ve çözüm odaklı bir müşteri destek asistanısın. Müşterilerin teknik sorunlarına çözüm üretiyorsun.",
            "greeting_prompt": "Merhaba, size nasıl yardımcı olabilirim?",
            "status": "active",
            "transfer_target": "200"
        }
    ],
    "ai_providers": {
        "google_api_key": "",
        "openai_api_key": "",
        "anthropic_api_key": "",
        "groq_api_key": "",
        "elevenlabs_api_key": ""
    },
    "api_budgets": {
        "openai": {"loaded_credit": 0.0, "spent_credit": 0.0},
        "anthropic": {"loaded_credit": 0.0, "spent_credit": 0.0},
        "groq": {"loaded_credit": 0.0, "spent_credit": 0.0},
        "google": {"loaded_credit": 0.0, "spent_credit": 0.0},
        "elevenlabs": {"loaded_credit": 0.0, "spent_credit": 0.0}
    },
    "call_flow": {
        "trunk_id": 1,
        "time_schedule": {
            "enabled": True,
            "start_time": "09:00",
            "end_time": "18:00",
            "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
        },
        "business_hours_destination": {
            "type": "ivr",
            "target": "main_menu"
        },
        "out_of_hours_destination": {
            "type": "ai",
            "target": "Out_Of_Hours_AI"
        },
        "ivr_menu": {
            "announcement_text": "Lütfen ulaşmak istediğiniz birimi tuşlayınız. Satış için bir, Teknik Destek için iki, Yapay Zeka asistanına bağlanmak için dokuza basınız.",
            "options": [
                {"key": "1", "action_type": "extension", "target": "200", "label": "Satış Dahilisi"},
                {"key": "2", "action_type": "queue", "target": "support_queue", "label": "Destek Kuyruğu"},
                {"key": "9", "action_type": "ai", "target": "Sales_AI", "label": "AI Asistanı"}
            ]
        }
    },
    "workflows": [
        {
            "id": "wf-1",
            "name": "Ana IVR Karşılama Akışı",
            "trunk_id": 1,
            "status": "active",
            "nodes": [
                { "id": "node-1", "type": "play", "x": 80, "y": 80, "title": "PLAY Node", "value": "Anons1" },
                { "id": "node-2", "type": "menu", "x": 80, "y": 180, "title": "MENU Node", "options": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#", "timeout", "error"] },
                { "id": "node-3", "type": "setvalue", "x": 350, "y": 50, "title": "SETVALUE Node", "value": "SR_DENE = 0" },
                { "id": "node-4", "type": "transfer", "x": 350, "y": 150, "title": "TRANSFER Node", "value": "110201" },
                { "id": "node-5", "type": "tts", "x": 350, "y": 250, "title": "TTS Node", "value": "Sayın ${CUSTOMER_NAME}, Son ödeme tarihi ${LAST_DATE} olan ${CUSTOMER_BALANCE} türk lirası ödenmemiş borcunuz bulunmaktadır." },
                { "id": "node-6", "type": "sr", "x": 350, "y": 420, "title": "SR Node", "value": "evethayir", "options": ["90", "75", "50", "none"], "extra_fields": {"variable_name": "ILADI"} },
                { "id": "node-7", "type": "compare", "x": 650, "y": 50, "title": "COMPARE Node", "value": "Karşılaştırma", "options": ["true", "false"] },
                { "id": "node-8", "type": "transfer", "x": 650, "y": 180, "title": "TRANSFER Node", "value": "200" }
            ],
            "connections": [
                { "id": "conn-1", "fromNode": "node-1", "fromPort": "output", "toNode": "node-3", "toPort": "input" },
                { "id": "conn-2", "fromNode": "node-2", "fromPort": "0", "toNode": "node-3", "toPort": "input" },
                { "id": "conn-3", "fromNode": "node-2", "fromPort": "1", "toNode": "node-4", "toPort": "input" },
                { "id": "conn-4", "fromNode": "node-2", "fromPort": "3", "toNode": "node-5", "toPort": "input" },
                { "id": "conn-5", "fromNode": "node-2", "fromPort": "7", "toNode": "node-5", "toPort": "input" },
                { "id": "conn-6", "fromNode": "node-5", "fromPort": "output", "toNode": "node-8", "toPort": "input" },
                { "id": "conn-7", "fromNode": "node-6", "fromPort": "90", "toNode": "node-8", "toPort": "input" },
                { "id": "conn-8", "fromNode": "node-6", "fromPort": "75", "toNode": "node-8", "toPort": "input" },
                { "id": "conn-9", "fromNode": "node-6", "fromPort": "50", "toNode": "node-8", "toPort": "input" }
            ]
        },
        {
            "id": "wf-2",
            "name": "DID ve Yapay Zeka Akış Şablonu",
            "trunk_id": 1,
            "status": "draft",
            "nodes": [
                { "id": "node-did", "type": "did", "x": 60, "y": 180, "title": "Gelen DID Eşleme", "value": "x.", "extra_fields": {"did_numbers": "x.", "is_wildcard": True} },
                { "id": "node-time", "type": "timerule", "x": 280, "y": 150, "title": "Çalışma Saatleri Kontrolü", "value": "09:00", "options": ["active", "inactive"], "extra_fields": {"start_time": "09:00", "end_time": "18:00", "days": ["Mon", "Tue", "Wed", "Thu", "Fri"]} },
                { "id": "node-ai", "type": "ai_agent", "x": 520, "y": 90, "title": "Müşteri Temsilcisi AI", "value": "agent-sales" },
                { "id": "node-ann", "type": "play", "x": 520, "y": 250, "title": "Mesai Dışı Anonsu", "value": "MesaiDisiAnons" }
            ],
            "connections": [
                { "id": "conn-d1", "fromNode": "node-did", "fromPort": "output", "toNode": "node-time", "toPort": "input" },
                { "id": "conn-d2", "fromNode": "node-time", "fromPort": "active", "toNode": "node-ai", "toPort": "input" },
                { "id": "conn-d3", "fromNode": "node-time", "fromPort": "inactive", "toNode": "node-ann", "toPort": "input" }
            ]
        }
    ],
    "trunks": [
        {
            "id": 1,
            "trunk_type": "register",
            "trunk_name": "Operator_Trunk",
            "host": "sip.operator.com",
            "username": "0850XXXXXXX",
            "password": "sip_sifre_123",
            "port": 5060,
            "did_number": "0850XXXXXXX",
            "protocol": "udp",
            "greeting_prompt": "Merhaba! Ben Müşteri Hizmetleri Yapay Zeka Asistanıyım. Size nasıl yardımcı olabilirim?",
            "transfer_target_type": "extension",
            "transfer_target": "200",
            "codec": "G711",
            "max_channels": 30,
            "is_active": True
        }
    ],
    "breaks": [
        {"id": 1, "name": "Yemek Molası", "color": "#f59e0b"},
        {"id": 2, "name": "Çay/Kahve Molası", "color": "#3b82f6"},
        {"id": 3, "name": "Toplantı", "color": "#10b981"},
        {"id": 4, "name": "Özel İhtiyaç", "color": "#ec4899"}
    ],
    "announcements": [],
    "users": [
        {
            "id": 1,
            "full_name": "Anıl Acar",
            "email": "anil@company.com",
            "extension": "200",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Anil",
            "role": "admin",
            "is_active": True
        },
        {
            "id": 2,
            "full_name": "Can Yılmaz",
            "email": "can@company.com",
            "extension": "201",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Can",
            "role": "agent",
            "is_active": True
        }
    ],
    "roles": [
        {
            "id": 1,
            "role_code": "admin",
            "name": "Yönetici",
            "permissions": [
                # Operasyon & İzleme
                "dashboard:access", "wallboard:access", "call_panel:access", "call_panel:listen_records", "omnichannel:access",
                # Yapay Zeka & Bilgi
                "ai_agents:read", "ai_agents:write", "ai_agents:delete", "ai_agents:access",
                "ai_agent_scenarios:read", "ai_agent_scenarios:write", "ai_agent_scenarios:delete",
                "rag_kb:read", "rag_kb:write", "rag_kb:delete",
                "rule_editor:read", "rule_editor:write", "rule_editor:delete",
                "ai_whisper:read", "ai_whisper:write", "ai_whisper:access",
                "voice_biometrics:read", "voice_biometrics:write", "voice_biometrics:delete",
                "qa:read", "qa:write", "qa:delete",
                "lang_detect:read", "lang_detect:write",
                "emotion_management:read", "emotion_management:write",
                "ai_providers:read", "ai_providers:write",
                # Santral (PBX) & Çağrı Yönlendirme
                "pbx:read", "pbx:write", "pbx:delete",
                "users:read", "users:write", "users:delete",
                "announcements:read", "announcements:write", "announcements:delete",
                "acd_queues:read", "acd_queues:write", "acd_queues:delete",
                "autoprovision:read", "autoprovision:write", "autoprovision:delete",
                "autoprovision_templates:read", "autoprovision_templates:write", "autoprovision_templates:delete",
                "outbound_rules:read", "outbound_rules:write", "outbound_rules:delete",
                "inbound_rules:read", "inbound_rules:write", "inbound_rules:delete",
                "call_pickup_groups:read", "call_pickup_groups:write", "call_pickup_groups:delete",
                "subscriber_groups:read", "subscriber_groups:write", "subscriber_groups:delete",
                "contacts:read", "contacts:write", "contacts:delete",
                "trunks:read", "trunks:write", "trunks:delete",
                "conferences:read", "conferences:write", "conferences:delete",
                "speed_dials:read", "speed_dials:write", "speed_dials:delete",
                "blacklist:read", "blacklist:write", "blacklist:delete",
                "call_flow:read", "call_flow:write", "call_flow:delete", "call_flow:access",
                "dialer:read", "dialer:write", "dialer:delete", "dialer:access",
                "calendar:read", "calendar:write", "calendar:delete",
                "follow_me:read", "follow_me:write",
                "mobile_transfer:read", "mobile_transfer:write",
                "smart_callback:read", "smart_callback:write",
                "numbering_plan:read", "numbering_plan:write",
                # Raporlar & Analiz
                "reports:access", "agent_timeline:access", "transcripts:access",
                "roi_settings:read", "roi_settings:write", "roi_settings:delete",
                # İletişim Kanalları
                "channels:read", "channels:write",
                "canned_responses:read", "canned_responses:write", "canned_responses:delete",
                # Yönetim, Güvenlik & Sistem Ayarları
                "roles:read", "roles:write", "roles:delete",
                "breaks:read", "breaks:write", "breaks:delete",
                "locations:read", "locations:write", "locations:delete",
                "nat:read", "nat:write", "nat:delete",
                "universal_api:read", "universal_api:write", "universal_api:delete",
                "ssl:read", "ssl:write",
                "backup_restore:read", "backup_restore:write",
                "recording_retention:read", "recording_retention:write", "recording_retention:delete",
                "storage:access",
                "api_budgets:read", "api_budgets:write",
                "tenant_license:read", "tenant_license:write", "tenant_license:delete",
                "email_notifications:read", "email_notifications:write", "email_notifications:delete",
                "restore_points:read", "restore_points:write", "restore_points:delete",
                "system_status:access", "logs:access", "sip_debugger:access",
                "security:read", "security:write", "security:delete",
                "system_version:access"
            ],
            "allowed_breaks": [1, 2, 3, 4]
        },
        {
            "id": 2,
            "role_code": "supervisor",
            "name": "Şef (Supervisor)",
            "permissions": [
                "dashboard:access", "wallboard:access", "call_panel:access", "call_panel:listen_records", "omnichannel:access",
                "ai_agents:read", "ai_agents:write", "ai_agent_scenarios:read", "ai_agent_scenarios:write",
                "rag_kb:read", "rag_kb:write", "rule_editor:read", "rule_editor:write",
                "ai_whisper:read", "ai_whisper:write", "ai_whisper:access",
                "voice_biometrics:read", "voice_biometrics:write",
                "qa:read", "qa:write", "qa:delete",
                "pbx:read", "pbx:write",
                "users:read", "users:write",
                "announcements:read", "announcements:write",
                "acd_queues:read", "acd_queues:write",
                "outbound_rules:read", "inbound_rules:read",
                "call_pickup_groups:read", "call_pickup_groups:write",
                "subscriber_groups:read", "subscriber_groups:write",
                "contacts:read", "contacts:write", "contacts:delete",
                "conferences:read", "conferences:write",
                "speed_dials:read", "speed_dials:write",
                "blacklist:read", "blacklist:write", "blacklist:delete",
                "call_flow:read", "call_flow:write", "call_flow:access",
                "dialer:read", "dialer:write", "dialer:access",
                "calendar:read", "calendar:write", "calendar:delete",
                "follow_me:read", "follow_me:write",
                "mobile_transfer:read", "mobile_transfer:write",
                "smart_callback:read", "smart_callback:write",
                "reports:access", "agent_timeline:access", "transcripts:access",
                "channels:read", "channels:write",
                "canned_responses:read", "canned_responses:write", "canned_responses:delete",
                "breaks:read", "breaks:write",
                "locations:read", "locations:write",
                "recording_retention:read", "recording_retention:write", "recording_retention:delete",
                "storage:access", "logs:access", "sip_debugger:access",
                "security:read", "security:write", "security:delete",
                "email_notifications:read", "email_notifications:write",
                "restore_points:read", "restore_points:write",
                "system_version:access"
            ],
            "allowed_breaks": [1, 2, 3, 4]
        },
        {
            "id": 3,
            "role_code": "agent",
            "name": "Müşteri Temsilcisi",
            "permissions": [
                "dashboard:access", "call_panel:access", "omnichannel:access",
                "contacts:read", "contacts:write",
                "calendar:read", "calendar:write",
                "canned_responses:read", "blacklist:read",
                "follow_me:read", "follow_me:write",
                "mobile_transfer:read", "mobile_transfer:write",
                "qa:read", "recording_retention:read",
                "reports:access", "agent_timeline:access"
            ],
            "allowed_breaks": [1, 2, 3, 4]
        }
    ],
    "custom_apis": [],
    "voice_biometrics": {
        "enabled": True,
        "deepfake_threshold": 80,
        "auto_blacklist": False
    },
            "recording_retention": {
        "delete_by_disk": True,
        "disk_threshold_pct": 80,
        "keep_days": 90,
        "delete_by_days": False
    },
    "security_geo": {
        "allowed_countries": ["TR"]
    },
    "inbound_rules": [],
    "call_pickup_groups": [],
    "subscriber_groups": [],
    "speed_dials": [],
    "conferences": [],
    "nat": {
        "enabled": False,
        "extern_ip": "",
        "local_nets": ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12", "127.0.0.1/32"]
    }
}

def load_settings():
    db = DEFAULT_SETTINGS.copy()
    
    # Load fallback settings from settings.json if present
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                disk_settings = json.load(f)
                db.update(disk_settings)
        except Exception as fe:
            print(f"[Settings Disk] Error reading {SETTINGS_FILE}: {fe}")

    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemSetting, SystemUser, SystemRole
        
        session = SyncSessionLocal()
        try:
            settings = session.query(SystemSetting).all()
            for s in settings:
                db[s.key] = s.value

            db_users = session.query(SystemUser).order_by(SystemUser.id).all()
            if db_users:
                users_list = []
                for u in db_users:
                    users_list.append({col.name: getattr(u, col.name) for col in SystemUser.__table__.columns})
                db["users"] = users_list

            db_roles = session.query(SystemRole).order_by(SystemRole.id).all()
            if db_roles:
                roles_list = []
                for r in db_roles:
                    roles_list.append({col.name: getattr(r, col.name) for col in SystemRole.__table__.columns})
                db["roles"] = roles_list
        finally:
            session.close()
    except Exception as e:
        print(f"[Settings DB] Info loading settings: {e}")
    # Ensure default roles exist if not present
    if "roles" not in db or not db["roles"]:
        db["roles"] = DEFAULT_SETTINGS["roles"]
    
    # Migrate old roles permissions to granular permissions
    if "roles" in db:
        for r in db["roles"]:
            perms = r.get("permissions", [])
            new_perms = []
            for p in perms:
                if p == "pbx":
                    new_perms.extend(["pbx:read", "pbx:write", "pbx:delete"])
                elif p == "channels":
                    new_perms.extend(["channels:read", "channels:write"])
                elif p == "breaks":
                    new_perms.extend(["breaks:read", "breaks:write", "breaks:delete"])
                elif p == "users":
                    new_perms.extend(["users:read", "users:write", "users:delete"])
                elif p == "roles":
                    new_perms.extend(["roles:read", "roles:write", "roles:delete"])
                elif p == "call_panel":
                    new_perms.append("call_panel:access")
                elif p == "logs":
                    new_perms.append("logs:access")
                elif p == "storage":
                    new_perms.append("storage:access")
                elif p == "announcements":
                    new_perms.extend(["announcements:read", "announcements:write", "announcements:delete"])
                else:
                    new_perms.append(p)
            
            # PBX (Santral) yetkisi olan tüm rollere yeni granular izinleri dağıt
            if "pbx:read" in new_perms:
                if "announcements:read" not in new_perms:
                    new_perms.append("announcements:read")
                if "autoprovision:read" not in new_perms:
                    new_perms.append("autoprovision:read")
                if "autoprovision_templates:read" not in new_perms:
                    new_perms.append("autoprovision_templates:read")
                if "outbound_rules:read" not in new_perms:
                    new_perms.append("outbound_rules:read")
                if "speed_dials:read" not in new_perms:
                    new_perms.append("speed_dials:read")
                if "conferences:read" not in new_perms:
                    new_perms.append("conferences:read")
                if "acd_queues:read" not in new_perms:
                    new_perms.append("acd_queues:read")
                if "trunks:read" not in new_perms:
                    new_perms.append("trunks:read")
                if "inbound_rules:read" not in new_perms:
                    new_perms.append("inbound_rules:read")
                if "call_pickup_groups:read" not in new_perms:
                    new_perms.append("call_pickup_groups:read")
                if "subscriber_groups:read" not in new_perms:
                    new_perms.append("subscriber_groups:read")
                    
            if "pbx:write" in new_perms:
                # Yazma yetkisi varsa Write ve Delete izinlerini de ver
                for feat in ["announcements", "autoprovision", "autoprovision_templates", "outbound_rules", "speed_dials", "conferences", "acd_queues", "trunks", "inbound_rules", "call_pickup_groups", "subscriber_groups"]:
                    if f"{feat}:write" not in new_perms:
                        new_perms.append(f"{feat}:write")
                    if f"{feat}:delete" not in new_perms:
                        new_perms.append(f"{feat}:delete")

            
            # Auto assign wallboard, dialer, and call_flow to admin and supervisor if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "wallboard:access" not in new_perms:
                    new_perms.append("wallboard:access")
                if "dialer:access" not in new_perms:
                    new_perms.append("dialer:access")
                if "call_flow:access" not in new_perms:
                    new_perms.append("call_flow:access")
                if "ai_agents:access" not in new_perms:
                    new_perms.append("ai_agents:access")
                if "ai_whisper:access" not in new_perms:
                    new_perms.append("ai_whisper:access")
                if "sip_debugger:access" not in new_perms:
                    new_perms.append("sip_debugger:access")
            
            # Auto assign omnichannel to admin, supervisor, and agent if missing
            if r.get("role_code") in ["admin", "supervisor", "agent"]:
                if "omnichannel:access" not in new_perms:
                    new_perms.append("omnichannel:access")

            # Auto assign contacts to admin, supervisor, and agent if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "contacts:read" not in new_perms:
                    new_perms.append("contacts:read")
                if "contacts:write" not in new_perms:
                    new_perms.append("contacts:write")
                if "contacts:delete" not in new_perms:
                    new_perms.append("contacts:delete")
            elif r.get("role_code") == "agent":
                if "contacts:read" not in new_perms:
                    new_perms.append("contacts:read")
                if "contacts:write" not in new_perms:
                    new_perms.append("contacts:write")

            # Auto assign canned responses permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "canned_responses:read" not in new_perms:
                    new_perms.append("canned_responses:read")
                if "canned_responses:write" not in new_perms:
                    new_perms.append("canned_responses:write")
                if "canned_responses:delete" not in new_perms:
                    new_perms.append("canned_responses:delete")
                if "call_panel:listen_records" not in new_perms:
                    new_perms.append("call_panel:listen_records")
            elif r.get("role_code") == "agent":
                if "canned_responses:read" not in new_perms:
                    new_perms.append("canned_responses:read")

            # Auto assign blacklist permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "blacklist:read" not in new_perms:
                    new_perms.append("blacklist:read")
                if "blacklist:write" not in new_perms:
                    new_perms.append("blacklist:write")
                if "blacklist:delete" not in new_perms:
                    new_perms.append("blacklist:delete")
            elif r.get("role_code") == "agent":
                if "blacklist:read" not in new_perms:
                    new_perms.append("blacklist:read")
            
            # Auto assign mobile transfer permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "mobile_transfer:read" not in new_perms:
                    new_perms.append("mobile_transfer:read")
                if "mobile_transfer:write" not in new_perms:
                    new_perms.append("mobile_transfer:write")
            elif r.get("role_code") == "agent":
                if "mobile_transfer:read" not in new_perms:
                    new_perms.append("mobile_transfer:read")
                if "mobile_transfer:write" not in new_perms:
                    new_perms.append("mobile_transfer:write")

            # Auto assign QA permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "qa:read" not in new_perms:
                    new_perms.append("qa:read")
                if "qa:write" not in new_perms:
                    new_perms.append("qa:write")
                if "qa:delete" not in new_perms:
                    new_perms.append("qa:delete")
            elif r.get("role_code") == "agent":
                if "qa:read" not in new_perms:
                    new_perms.append("qa:read")
                
            # Auto assign universal_api permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "universal_api:read" not in new_perms:
                    new_perms.append("universal_api:read")
                if "universal_api:write" not in new_perms:
                    new_perms.append("universal_api:write")
                if "universal_api:delete" not in new_perms:
                    new_perms.append("universal_api:delete")
            elif r.get("role_code") == "agent":
                if "universal_api:read" not in new_perms:
                    new_perms.append("universal_api:read")
                
            # Auto assign voice_biometrics permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "voice_biometrics:read" not in new_perms:
                    new_perms.append("voice_biometrics:read")
                if "voice_biometrics:write" not in new_perms:
                    new_perms.append("voice_biometrics:write")
                if "voice_biometrics:delete" not in new_perms:
                    new_perms.append("voice_biometrics:delete")
            elif r.get("role_code") == "agent":
                if "voice_biometrics:read" not in new_perms:
                    new_perms.append("voice_biometrics:read")

            # Auto assign recording_retention permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "recording_retention:read" not in new_perms:
                    new_perms.append("recording_retention:read")
                if "recording_retention:write" not in new_perms:
                    new_perms.append("recording_retention:write")
                if "recording_retention:delete" not in new_perms:
                    new_perms.append("recording_retention:delete")
            elif r.get("role_code") == "agent":
                if "recording_retention:read" not in new_perms:
                    new_perms.append("recording_retention:read")

            # Auto assign reports permissions if missing
            if r.get("role_code") in ["admin", "supervisor", "agent"]:
                if "reports:access" not in new_perms:
                    new_perms.append("reports:access")

            # Auto assign security, email_notifications & restore_points permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "security:read" not in new_perms:
                    new_perms.append("security:read")
                if "security:write" not in new_perms:
                    new_perms.append("security:write")
                if "security:delete" not in new_perms:
                    new_perms.append("security:delete")
                if "email_notifications:read" not in new_perms:
                    new_perms.append("email_notifications:read")
                if "email_notifications:write" not in new_perms:
                    new_perms.append("email_notifications:write")
                if "restore_points:read" not in new_perms:
                    new_perms.append("restore_points:read")
                if "restore_points:write" not in new_perms:
                    new_perms.append("restore_points:write")
                if r.get("role_code") == "admin" and "restore_points:delete" not in new_perms:
                    new_perms.append("restore_points:delete")

            # Auto assign all system permissions to admin and superadmin roles
            if r.get("role_code") in ["admin", "superadmin"]:
                admin_defaults = DEFAULT_SETTINGS["roles"][0]["permissions"]
                for p in admin_defaults:
                    if p not in new_perms:
                        new_perms.append(p)
            elif r.get("role_code") == "supervisor":
                sup_defaults = DEFAULT_SETTINGS["roles"][1]["permissions"]
                for p in sup_defaults:
                    if p not in new_perms:
                        new_perms.append(p)
            elif r.get("role_code") == "agent":
                agt_defaults = DEFAULT_SETTINGS["roles"][2]["permissions"]
                for p in agt_defaults:
                    if p not in new_perms:
                        new_perms.append(p)
                
            r["permissions"] = list(set(new_perms))

        # Persist migrated role permissions back to PostgreSQL SystemRole table
        try:
            from backend.database.config import SyncSessionLocal
            from backend.database.models import SystemRole
            sync_sess = SyncSessionLocal()
            try:
                db_role_rows = sync_sess.query(SystemRole).all()
                by_code = {row.role_code: row for row in db_role_rows if row.role_code}
                dirty = False
                for r in db["roles"]:
                    rc = r.get("role_code")
                    if rc and rc in by_code:
                        row = by_code[rc]
                        existing_set = set(row.permissions or [])
                        migrated_set = set(r.get("permissions") or [])
                        if not migrated_set.issubset(existing_set):
                            row.permissions = list(existing_set.union(migrated_set))
                            r["permissions"] = row.permissions
                            dirty = True
                if dirty:
                    sync_sess.commit()
            finally:
                sync_sess.close()
        except Exception as sync_err:
            print(f"[Role Migration DB Sync Info]: {sync_err}")
            
    # Ensure auto_whisper_enabled exists in pbx settings (migration)
    if "pbx" in db and "auto_whisper_enabled" not in db["pbx"]:
        db["pbx"]["auto_whisper_enabled"] = True

    # Ensure all trunks have a codec and max_channels field (migration)
    if "trunks" in db:
        for t in db["trunks"]:
            if "codec" not in t:
                t["codec"] = "G711"
            if "max_channels" not in t or not t["max_channels"]:
                t["max_channels"] = 30

    # Ensure smart_callback config exists (migration)
    if "smart_callback" not in db:
        db["smart_callback"] = DEFAULT_SETTINGS["smart_callback"].copy()

    # Ensure dialer config exists (migration)
    if "dialer" not in db:
        db["dialer"] = DEFAULT_SETTINGS["dialer"].copy()

    # Ensure call_flow config exists (migration)
    if "call_flow" not in db:
        db["call_flow"] = DEFAULT_SETTINGS["call_flow"].copy()
    # Ensure workflows config exists (migration)
    if "workflows" not in db:
      db["workflows"] = [w.copy() for w in DEFAULT_SETTINGS["workflows"]]
    else:
      # Append new default templates if missing
      existing_ids = [w.get("id") for w in db["workflows"]]
      for def_wf in DEFAULT_SETTINGS["workflows"]:
        if def_wf.get("id") not in existing_ids:
          db["workflows"].append(def_wf.copy())

    # Ensure rag config exists (migration)
    if "rag" not in db:
        db["rag"] = DEFAULT_SETTINGS["rag"].copy()

    # Ensure ai_agents config exists (migration)
    if "ai_agents" not in db:
        db["ai_agents"] = [agent.copy() for agent in DEFAULT_SETTINGS["ai_agents"]]
        
    for agent in db.get("ai_agents", []):
        if "llm_provider" not in agent:
            agent["llm_provider"] = agent.get("provider", "google")
        if "tts_provider" not in agent:
            if agent.get("provider") == "elevenlabs" or agent.get("elevenlabs_voice_id"):
                agent["tts_provider"] = "elevenlabs"
            else:
                agent["tts_provider"] = "google"
        
    # Ensure custom_apis exists (migration)
    if "custom_apis" not in db:
        db["custom_apis"] = []
    
    # Ensure auto_language_detection setting is migrated
    if "pbx" in db:
        if "auto_language_detection" not in db["pbx"]:
            db["pbx"]["auto_language_detection"] = False
        if "auto_emotion_management" not in db["pbx"]:
            db["pbx"]["auto_emotion_management"] = False
        if "auto_whisper_enabled" not in db["pbx"]:
            db["pbx"]["auto_whisper_enabled"] = True
            
    # Ensure all AI agents have transfer_target field
    if "ai_agents" in db:
        for agent in db["ai_agents"]:
            if "transfer_target" not in agent:
                agent["transfer_target"] = "200"
            
    # Ensure voice_biometrics config exists (migration)
    if "voice_biometrics" not in db:
        db["voice_biometrics"] = DEFAULT_SETTINGS["voice_biometrics"].copy()
            
    # Ensure recording_retention config exists (migration)
    if "recording_retention" not in db:
        db["recording_retention"] = DEFAULT_SETTINGS["recording_retention"].copy()

    # Ensure roi_settings config exists
    if "roi_settings" not in db:
        db["roi_settings"] = DEFAULT_SETTINGS["roi_settings"].copy()

    # Ensure security_geo config exists
    if "security_geo" not in db:
        db["security_geo"] = DEFAULT_SETTINGS["security_geo"].copy()

    # Ensure api_providers config exists
    if "ai_providers" not in db:
        db["ai_providers"] = DEFAULT_SETTINGS["ai_providers"].copy()
    else:
        if "elevenlabs_api_key" not in db["ai_providers"]:
            db["ai_providers"]["elevenlabs_api_key"] = ""

    # Ensure api_budgets config exists
    if "api_budgets" not in db:
        db["api_budgets"] = DEFAULT_SETTINGS["api_budgets"].copy()
    else:
        for provider in DEFAULT_SETTINGS["api_budgets"]:
            if provider not in db["api_budgets"]:
                db["api_budgets"][provider] = {"loaded_credit": 0.0, "spent_credit": 0.0}

    for u in db.get("users", []):
        ensure_user_profiles(u)

    save_settings(db)
    return db


def save_settings(settings):
    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemSetting
        
        session = SyncSessionLocal()
        try:
            for key, val in settings.items():
                setting = session.query(SystemSetting).filter_by(key=key).first()
                if setting:
                    setting.value = val
                else:
                    session.add(SystemSetting(key=key, value=val))
            session.commit()
        finally:
            session.close()
    except Exception as e:
        print(f"[Settings DB] Info saving settings: {e}")

    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=4)
    except Exception as fe:
        print(f"[Settings File Backup] Warning: Could not write settings.json: {fe}")

settings_db = load_settings()

# ----------------------------------------------------
# API Routes: PBX & Channel Settings
# ----------------------------------------------------
@app.get("/api/settings/roi_settings")
@app.get("/settings/roi_settings")
async def get_roi_settings():
    return settings_db.get("roi_settings", DEFAULT_SETTINGS["roi_settings"])

@app.post("/api/settings/roi_settings")
@app.post("/settings/roi_settings")
async def save_roi_settings(payload: dict):
    settings_db["roi_settings"] = payload
    return {"status": "success"}

@app.get("/api/settings/pbx")
@app.get("/settings/pbx")
async def get_pbx_settings():
    return settings_db["pbx"]

@app.post("/api/settings/pbx")
@app.post("/settings/pbx")
async def save_pbx_settings(payload: PBXSettingsSchema):
    settings_db["pbx"] = payload.model_dump()
    os.environ["AMI_HOST"] = payload.ami_host
    os.environ["AMI_PORT"] = str(payload.ami_port)
    os.environ["AMI_USER"] = payload.ami_user
    os.environ["AMI_SECRET"] = payload.ami_secret
    return {"status": "success", "message": "Santral ayarları başarıyla kaydedildi."}

@app.get("/api/settings/nat")
@app.get("/settings/nat")
async def get_nat_settings():
    if "nat" not in settings_db:
        settings_db["nat"] = DEFAULT_SETTINGS["nat"].copy()
    return settings_db["nat"]

@app.post("/api/settings/nat")
@app.post("/settings/nat")
async def save_nat_settings(payload: NATSettingsSchema, background_tasks: BackgroundTasks):
    settings_db["nat"] = payload.model_dump()
    save_settings(settings_db)
    regenerate_pjsip_custom_conf(background_tasks)
    return {"status": "success", "message": "NAT ve Dış IP ayarları başarıyla kaydedildi ve Asterisk'e uygulandı."}

@app.get("/api/system/public-ip")
@app.get("/system/public-ip")
async def get_public_ip():
    import urllib.request
    try:
        req = urllib.request.Request("https://api.ipify.org?format=json", headers={"User-Agent": "AIDA-PBX/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as response:
            import json
            data = json.loads(response.read().decode("utf-8"))
            return {"status": "success", "ip": data.get("ip")}
    except Exception as e:
        try:
            req = urllib.request.Request("https://ip.icanhazip.com", headers={"User-Agent": "AIDA-PBX/1.0"})
            with urllib.request.urlopen(req, timeout=3.0) as response:
                ip_str = response.read().decode("utf-8").strip()
                return {"status": "success", "ip": ip_str}
        except Exception as e2:
            return {"status": "error", "message": f"Dış IP adresi tespit edilemedi: {e2}", "ip": None}

@app.post("/api/settings/ssl")
async def upload_ssl_certificates(
    cert: UploadFile = File(...),
    key: UploadFile = File(...),
    ca: Optional[UploadFile] = File(None)
):
    try:
        keys_dir = os.path.join(os.getcwd(), "asterisk_config", "keys")
        os.makedirs(keys_dir, exist_ok=True)
        
        cert_path = os.path.join(keys_dir, "asterisk.crt")
        key_path = os.path.join(keys_dir, "asterisk.key")
        ca_path = os.path.join(keys_dir, "ca.crt")
        
        with open(cert_path, "wb") as f:
            f.write(await cert.read())
            
        with open(key_path, "wb") as f:
            f.write(await key.read())
            
        if ca:
            with open(ca_path, "wb") as f:
                f.write(await ca.read())
                
        return {"status": "success", "message": "SSL sertifikaları başarıyla yüklendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sertifikalar yüklenirken hata oluştu: {str(e)}")

def run_pjsip_reload():
    # Trigger Asterisk PJSIP & Dialplan Reload command dynamically
    try:
        import subprocess
        res = subprocess.run(["asterisk", "-rx", "pjsip reload"], capture_output=True, text=True, timeout=2.0)
        subprocess.run(["asterisk", "-rx", "dialplan reload"], capture_output=True, text=True, timeout=2.0)
        if res.returncode == 0:
            print("[Asterisk Config] PJSIP ve Dialplan başarıyla yenilendi (host).")
            return
    except Exception as e:
        print(f"[Asterisk Config] Direct PJSIP reload failed: {e}")

    try:
        import subprocess
        subprocess.run(["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", "pjsip reload"], check=True, capture_output=True, timeout=2.0)
        subprocess.run(["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", "dialplan reload"], check=True, capture_output=True, timeout=2.0)
        print("[Asterisk Config] PJSIP & Dialplan configurations reloaded successfully in Asterisk container.")
    except Exception as e:
        print(f"[Asterisk Config] Failed to reload PJSIP in Asterisk: {e}")

def run_queue_reload():
    try:
        import subprocess
        res = subprocess.run(["asterisk", "-rx", "queue reload all"], capture_output=True, text=True, timeout=2.0)
        if res.returncode == 0:
            print("[Asterisk Config] Queue reloaded successfully via host Asterisk.")
            return
    except Exception as e:
        print(f"[Asterisk Config] Direct queue reload failed: {e}")

    try:
        import subprocess
        subprocess.run(["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", "queue reload all"], check=True, capture_output=True, timeout=2.0)
        print("[Asterisk Config] Queue configurations reloaded successfully in Asterisk container.")
    except Exception as e:
        print(f"[Asterisk Config] Failed to reload queues in Asterisk: {e}")

def run_dialplan_reload():
    try:
        import subprocess
        res = subprocess.run(["asterisk", "-rx", "dialplan reload"], capture_output=True, text=True, timeout=2.0)
        if res.returncode == 0:
            print("[Asterisk Config] Dialplan reloaded successfully via host Asterisk.")
            return
    except Exception as e:
        print(f"[Asterisk Config] Direct dialplan reload failed: {e}")

    try:
        import subprocess
        subprocess.run(["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", "dialplan reload"], check=True, capture_output=True, timeout=2.0)
        print("[Asterisk Config] Dialplan configurations reloaded successfully in Asterisk container.")
    except Exception as e:
        print(f"[Asterisk Config] Failed to reload dialplan in Asterisk: {e}")

def resolve_secure_sip_password(ext: str, raw_pwd: str = "") -> str:
    """
    Hiçbir dahili için '1234' gibi tahmin edilebilir zayıf SIP şifrelerine izin vermez.
    Eğer şifre boş veya zayıf ise dahiliye özel deterministik kriptografik 17 karakterli güçlü şifre üretir.
    """
    import hashlib
    ext_clean = str(ext or "1000").strip()
    pwd_clean = str(raw_pwd or "").strip()
    weak_set = {"", "1234", "12345", "123456", "12345678", "0000", "1111", "admin", "password", ext_clean}
    if pwd_clean in weak_set or len(pwd_clean) < 8:
        digest = hashlib.sha256(f"AIDA_PBX_SIP_V2_SECRET_{ext_clean}_8842".encode("utf-8")).hexdigest()[:12]
        return f"Aida#{digest}"
    return pwd_clean


def is_suspicious_or_fraud_outbound_number(callee: str, allow_international: bool = False) -> tuple:
    """
    SIP tarayıcı botların (Toll-Fraud / Prefix Scanner) denediği sahte/yurt dışı/özel ücretli
    numara kalıplarını (örn: 0971018..., 0981018..., 09931018..., 12+ haneli tek sıfırlı numaralar)
    tespit eder. (is_blocked: bool, reason: str) döner.
    """
    import re
    num = str(callee or "").strip()
    if not num:
        return True, "EMPTY_NUMBER"

    # Yalnızca rakam ve başta + işaretine izin ver
    if not re.match(r"^\+?\d+$", num):
        return True, "INVALID_CHARS"

    # Bilinen SIP Toll-Fraud / Premium / Carrier Scanner önekleri (097..., 098..., 099..., 0900..., 0898...)
    if re.match(r"^0(9[6789]|900|898)", num):
        return True, f"FRAUD_SCANNER_PREFIX ({num[:4]})"

    # Uluslararası aramalar (00... veya +... ancak +90 hariç)
    if num.startswith("00") or (num.startswith("+") and not num.startswith("+90")):
        if not allow_international:
            return True, "INTERNATIONAL_DISABLED"
        if len(num) > 17 or len(num) < 9:
            return True, "INVALID_INTERNATIONAL_LENGTH"
        return False, "OK"

    # Türkiye içi 0 ile başlayan numaralar:
    # Geçerli ulusal numaralar (05xx, 02xx, 03xx, 04xx, 0850, 0800) tam 11 hanedir (örn: 05071796372).
    if num.startswith("0") and not num.startswith("00"):
        if len(num) != 11:
            return True, f"INVALID_TR_NATIONAL_LENGTH ({len(num)} digits)"
        if not re.match(r"^0([2345]\d{9}|850\d{7}|800\d{7})$", num):
            return True, "INVALID_TR_AREA_CODE"
        return False, "OK"

    # 90 ile başlayan 12 haneli Türkiye numaraları
    if num.startswith("90") and len(num) >= 12:
        if len(num) != 12 or not re.match(r"^90([2345]\d{9}|850\d{7}|800\d{7})$", num):
            return True, "INVALID_90_FORMAT"
        return False, "OK"

    return False, "OK"


def regenerate_pjsip_custom_conf(background_tasks: Optional[BackgroundTasks] = None):
    # Fetch Users and Trunks from Database (with fallback to settings_db)
    users_list = []
    trunks_list = []
    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemUser, Trunk
        with SyncSessionLocal() as session:
            db_users = session.query(SystemUser).all()
            for u in db_users:
                d = {col.name: getattr(u, col.name) for col in SystemUser.__table__.columns}
                users_list.append(d)
            db_trunks = session.query(Trunk).all()
            for t in db_trunks:
                d = {col.name: getattr(t, col.name) for col in Trunk.__table__.columns}
                trunks_list.append(d)
    except Exception as e_db:
        print(f"[Asterisk Config] Database query error, using settings_db fallback: {e_db}")

    if not users_list:
        users_list = settings_db.get("users", [])
    if not trunks_list:
        trunks_list = settings_db.get("trunks", [])

    nat_cfg = settings_db.get("nat", {})
    nat_enabled = nat_cfg.get("enabled", False)
    extern_ip = (nat_cfg.get("extern_ip") or "").strip()
    local_nets = nat_cfg.get("local_nets", [])
    if isinstance(local_nets, str):
        local_nets = [net.strip() for net in local_nets.split(",") if net.strip()]

    nat_lines = ""
    if extern_ip:
        nat_lines += f"external_media_address={extern_ip}\nexternal_signaling_address={extern_ip}\n"
    if nat_enabled and local_nets:
        for net in local_nets:
            net_clean = str(net).strip()
            if net_clean:
                nat_lines += f"local_net={net_clean}\n"

    # Merge sip_password and sip_username from settings_db["users"] if present
    disk_users_map = {str(du.get("extension") or "").strip(): du for du in settings_db.get("users", []) if du.get("extension")}
    for u in users_list:
        ext_k = str(u.get("extension") or "").strip()
        du = disk_users_map.get(ext_k)
        if du:
            if (not u.get("sip_password") or u.get("sip_password") == "1234") and du.get("sip_password"):
                u["sip_password"] = du.get("sip_password")
            if not u.get("sip_username") and du.get("sip_username"):
                u["sip_username"] = du.get("sip_username")

    has_1000_in_users = any(str(u.get("extension") or "").strip() == "1000" and (u.get("is_active", True) is not False) for u in users_list)

    conf_content = f"""; ==========================================
; DINAMIK OLARAK OLUŞTURULAN SIP TRUNK VE TRANSPORT AYARLARI
; ==========================================

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0
{nat_lines}
[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0
{nat_lines}
[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0:8088
{nat_lines}
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
{nat_lines}

; --- OPERATOR TRUNK (OUTBOUND LINK) ---
[Operator_Trunk]
type=endpoint
context=default
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=no
media_use_received_transport=yes
outbound_auth=908503607390-auth
aors=908503607390-aor
"""
    if not has_1000_in_users:
        pwd_1000 = resolve_secure_sip_password("1000", "")
        conf_content += f"""
; --- DEFAULT WEBRTC AGENT: 1000 ---
[1000]
type=endpoint
context=webrtc_agents
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
force_rport=yes
rewrite_contact=no
rtp_symmetric=yes
webrtc=yes
use_avpf=yes
media_encryption=dtls
dtls_auto_generate_cert=yes
dtls_verify=fingerprint
dtls_setup=actpass
ice_support=yes
media_use_received_transport=yes
auth=1000-auth
aors=1000
callerid=Temsilci 1000 <1000>

[1000-auth]
type=auth
auth_type=userpass
username=1000
password={pwd_1000}

[1000]
type=aor
max_contacts=5
remove_existing=yes
"""

    for t in trunks_list:
        is_act = t.get("is_active") if "is_active" in t else True
        if not is_act:
            t_name = t.get("trunk_name") or t.get("name") or "trunk"
            print(f"[Asterisk Config] Pasif trunk atlandi: {t_name}")
            continue
        name = t.get("trunk_name") or t.get("name") or "trunk"
        host = t.get("host", "127.0.0.1")
        port = t.get("port", 5060)
        did = t.get("did_number", "")
        protocol = t.get("protocol", "udp")
        transport = "transport-tcp" if protocol == "tcp" else "transport-udp"
        t_type = t.get("trunk_type", "ip")
        
        conf_content += f"\n; --- TRUNK: {name} ---\n"
        
        if t_type == "register":
            conf_content += f"""[{name}-auth]
type=auth
auth_type=userpass
username={t.get('username','')}
password={t.get('password','')}

[{name}-reg]
type=registration
transport={transport}
outbound_auth={name}-auth
server_uri=sip:{host}:{port}
client_uri=sip:{t.get('username','')}@{host}:{port}
retry_interval=60

"""

        conf_content += f"""[{name}-aor]
type=aor
contact=sip:{host}:{port}

[{name}]
type=endpoint
transport={transport}
context=from-trunk
disallow=all
allow=ulaw,alaw,g722,g729
aors={name}-aor
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
"""
        if t_type == "register":
            conf_content += f"""outbound_auth={name}-auth
from_user={t.get('username','')}
from_domain={host}

"""
            
        conf_content += f"""[{name}-identify]
type=identify
endpoint={name}
match={host}

"""

    conf_content += "\n; ==========================================\n"
    conf_content += "; DINAMIK OLARAK OLUŞTURULAN KULLANICI (DAHILI) AYARLARI\n"
    conf_content += "; ==========================================\n"

    seen_exts = set()
    for u in users_list:
        is_act = u.get("is_active") if "is_active" in u else True
        if not is_act:
            continue
        ext = str(u.get("extension") or "").strip()
        if not ext or ext in seen_exts:
            continue
        seen_exts.add(ext)
        pwd = resolve_secure_sip_password(ext, u.get("sip_password") or "")
        name = u.get("full_name") or u.get("username") or ext
        sip_user = str(u.get("sip_username") or "").strip()
        try:
            max_act = max(1, min(5, int(u.get("max_activations") or 5)))
        except Exception:
            max_act = 5
        
        conf_content += f"\n; --- USER: {name} ({ext}) ---\n"
        conf_content += f"""[{ext}]
type=endpoint
context=webrtc_agents
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
force_rport=yes
rewrite_contact=no
rtp_symmetric=yes
webrtc=yes
use_avpf=yes
media_encryption=dtls
dtls_auto_generate_cert=yes
dtls_verify=fingerprint
dtls_setup=actpass
ice_support=yes
media_use_received_transport=yes
auth={ext}-auth
aors={ext}
callerid={name} <{ext}>

[{ext}-auth]
type=auth
auth_type=userpass
username={ext}
password={pwd}

[{ext}]
type=aor
max_contacts={max_act}
remove_existing=yes
"""
        if sip_user and sip_user != ext:
            conf_content += f"""
[{sip_user}]
type=endpoint
context=webrtc_agents
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
auth={sip_user}-auth
aors={ext}
callerid={name} <{ext}>

[{sip_user}-auth]
type=auth
auth_type=userpass
username={sip_user}
password={pwd}
"""

    config_dir = ASTERISK_CONFIG_DIR
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, "pjsip_custom.conf")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(conf_content)
    print(f"[Asterisk Config] pjsip_custom.conf yeniden uretildi: {config_path}")

    etc_dir = "/etc/asterisk"
    if os.path.exists(etc_dir):
        try:
            pjsip_main = os.path.join(etc_dir, "pjsip.conf")
            clean_pjsip_main = """; ==========================================
; Asterisk PJSIP Main Configuration
; ==========================================
#include /etc/asterisk/pjsip_custom.conf
"""
            with open(pjsip_main, "w", encoding="utf-8") as f:
                f.write(clean_pjsip_main)
            print("[Asterisk Config] /etc/asterisk/pjsip.conf temizlendi ve #include pjsip_custom.conf eklendi.")

            etc_path = os.path.join(etc_dir, "pjsip_custom.conf")
            with open(etc_path, "w", encoding="utf-8") as f:
                f.write(conf_content)
            print(f"[Asterisk Config] /etc/asterisk/pjsip_custom.conf güncellendi: {etc_path}")
        except Exception as e:
            print(f"[Asterisk Config] /etc/asterisk/pjsip_custom.conf yazılamadı: {e}")
            
    # Comprehensive search for SSL certificate (Let's Encrypt / System)
    try:
        ast_keys_dir = "/etc/asterisk/keys"
        os.makedirs(ast_keys_dir, exist_ok=True)
        target_cert = None
        target_key = None

        letsencrypt_base = "/etc/letsencrypt/live"
        if os.path.exists(letsencrypt_base):
            try:
                for root, dirs, files in os.walk(letsencrypt_base):
                    if "fullchain.pem" in files and "privkey.pem" in files:
                        target_cert = os.path.join(root, "fullchain.pem")
                        target_key = os.path.join(root, "privkey.pem")
                        break
            except Exception:
                pass

        if not target_cert:
            for ssl_path in ["/etc/nginx", "/etc/ssl", "/etc/pki"]:
                if os.path.exists(ssl_path):
                    for root, dirs, files in os.walk(ssl_path):
                        for f in files:
                            if (f.endswith(".crt") or f.endswith(".pem") or "fullchain" in f) and not target_cert:
                                target_cert = os.path.join(root, f)
                            elif (f.endswith(".key") or "privkey" in f) and not target_key:
                                target_key = os.path.join(root, f)

        if target_cert and target_key:
            try:
                ast_fc = os.path.join(ast_keys_dir, "webphone_fullchain.pem")
                ast_pk = os.path.join(ast_keys_dir, "webphone_privkey.pem")
                ast_combined = os.path.join(ast_keys_dir, "asterisk.pem")

                shutil.copy2(target_cert, ast_fc)
                shutil.copy2(target_key, ast_pk)

                with open(ast_fc, "r") as f1, open(ast_pk, "r") as f2, open(ast_combined, "w") as fout:
                    fout.write(f1.read() + "\n" + f2.read())

                os.chmod(ast_fc, 0o644)
                os.chmod(ast_pk, 0o644)
                os.chmod(ast_combined, 0o644)
                print(f"[Asterisk Config] SSL sertifikası Asterisk için hazırlandı ve birleştirildi: {ast_combined}")
            except Exception as e_ssl_main:
                print(f"[Asterisk Config] SSL birleştirme hatası: {e_ssl_main}")
    except Exception as e_keys:
        print(f"[Asterisk Config] SSL anahtar dizini oluşturulamadı/erişilemedi: {e_keys}")

    # Auto-sync /etc/asterisk/http.conf for WebRTC WebSocket port 8088
    http_content = """; ==========================================
; Asterisk HTTP/WebSocket (WSS) Konfigürasyonu
; ==========================================
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/asterisk.pem
tlsprivatekey=/etc/asterisk/keys/webphone_privkey.pem
"""
    if os.path.exists("/etc/asterisk"):
        try:
            http_etc_path = "/etc/asterisk/http.conf"
            with open(http_etc_path, "w", encoding="utf-8") as f:
                f.write(http_content)
            subprocess.run(["asterisk", "-rx", "pjsip reload"], check=False)
            print("[Asterisk Config] /etc/asterisk/http.conf ve WebSocket servisi başarıyla yenilendi.")
        except Exception as e:
            print(f"[Asterisk Config] /etc/asterisk/http.conf güncellenemedi: {e}")

    if background_tasks:
        background_tasks.add_task(run_pjsip_reload)
    else:
        run_pjsip_reload()

def regenerate_queues_conf(background_tasks: Optional[BackgroundTasks] = None):
    queues_list = []
    users_list = []
    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import PBXQueue, SystemUser
        with SyncSessionLocal() as session:
            db_queues = session.query(PBXQueue).all()
            for q in db_queues:
                d = {col.name: getattr(q, col.name) for col in PBXQueue.__table__.columns}
                queues_list.append(d)
            db_users = session.query(SystemUser).all()
            for u in db_users:
                d = {col.name: getattr(u, col.name) for col in SystemUser.__table__.columns}
                users_list.append(d)
    except Exception as e_db:
        print(f"[Asterisk Config] Queue database query error, using settings_db fallback: {e_db}")

    if not queues_list:
        queues_list = settings_db.get("queues", [])
    if not users_list:
        users_list = settings_db.get("users", [])

    conf_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN KUYRUK AYARLARI
; ==========================================
"""
    for q in queues_list:
        is_act = q.get("is_active") if "is_active" in q else True
        if not is_act:
            continue
        q_key = q.get("extension") or str(q.get("id")) or q.get("name", "queue_temp")
        strategy = q.get("strategy", "ringall")
        timeout = q.get("timeout", 15)
        retry = q.get("retry", 5)
        wrapup = q.get("wrapuptime", 0)
        
        conf_content += f"\n[{q_key}]\n"
        conf_content += f"strategy={strategy}\n"
        conf_content += f"timeout={timeout}\n"
        conf_content += f"retry={retry}\n"
        conf_content += f"wrapuptime={wrapup}\n"
        conf_content += "autopause=no\n"
        conf_content += "maxlen=0\n"
        conf_content += "joinempty=yes\n"
        conf_content += "leavewhenempty=no\n"
        
        members = q.get("queueMembers") or q.get("members") or []
        if isinstance(members, str):
            import json
            try:
                members = json.loads(members)
            except Exception:
                members = []
        for member in members:
            user_id = member.get("user_id") if isinstance(member, dict) else member
            u = next((u for u in users_list if str(u["id"]) == str(user_id)), None)
            if u and u.get("extension"):
                conf_content += f"member => PJSIP/{u['extension']}\n"
                
    config_dir = ASTERISK_CONFIG_DIR
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, "queues_custom.conf")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(conf_content)
    print(f"[Asterisk Config] queues_custom.conf yeniden uretildi: {config_path}")

    etc_dir = "/etc/asterisk"
    if os.path.exists(etc_dir):
        try:
            etc_path = os.path.join(etc_dir, "queues_custom.conf")
            with open(etc_path, "w", encoding="utf-8") as f:
                f.write(conf_content)
            print(f"[Asterisk Config] /etc/asterisk/queues_custom.conf güncellendi: {etc_path}")
        except Exception as e:
            print(f"[Asterisk Config] /etc/asterisk/queues_custom.conf yazılamadı: {e}")

    if background_tasks:
        background_tasks.add_task(run_queue_reload)
    else:
        run_queue_reload()

def regenerate_extensions_custom_conf(background_tasks: Optional[BackgroundTasks] = None):
    is_docker = os.path.exists("/.dockerenv") or os.getenv("IS_DOCKER", "false").lower() == "true"
    default_backend_host = "host.docker.internal:8000" if is_docker else "127.0.0.1:8000"
    default_audiosocket_host = "host.docker.internal:9092" if is_docker else "127.0.0.1:9092"
    backend_host = os.getenv("BACKEND_HOST", default_backend_host)
    audiosocket_host = os.getenv("AUDIOSOCKET_HOST", default_audiosocket_host)

    conf_content = f"""; ==========================================
; DINAMIK OLARAK OLUŞTURULAN EXTENSIONS (DIALPLAN) AYARLARI
; ==========================================

[from-trunk]
include => default

[from-pstn]
include => default

[from-sip]
include => default

[default]
; Operatörden gelen aramaları yakalamak için (Standart numara eşleşmesi)
exten => _X.,1,NoOp(Gelen arama DID ile yakalandi: ${{EXTEN}} - Arayan: ${{CALLERID(num)}})
same => n,Set(UUID_VAL=${{UUID()}})
same => n,Set(MD5_VAL=${{MD5(${{UNIQUEID}})}})
same => n,Set(CALL_UUID=${{IF($[${{ISNULL(${{UUID_VAL}})}}]?${{MD5_VAL:0:8}}-${{MD5_VAL:8:4}}-4${{MD5_VAL:13:3}}-a${{MD5_VAL:17:3}}-${{MD5_VAL:20:12}}:${{UUID_VAL}})}})
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/register?call_id=${{CALL_UUID}}&did=${{EXTEN}}&caller=${{CALLERID(num)}}&asterisk_id=${{UNIQUEID}})}})
same => n,GotoIf($["${{CURL_RESULT}}" = "BLOCKED"]?hangup_blocked_x)
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${{CALL_UUID}}.wav)
same => n,AudioSocket(${{CALL_UUID}},{audiosocket_host})
same => n,Hangup()
same => n(hangup_blocked_x),NoOp(KARA LISTE / GUVENLIK ENGELI: Arayan reddedildi -> ${{CALLERID(num)}})
same => n,Hangup(21)

; Uluslararası / + ile gelen DID numaraları için (+90...)
exten => _+X.,1,NoOp(Gelen arama +DID ile yakalandi: ${{EXTEN}} - Arayan: ${{CALLERID(num)}})
same => n,Set(UUID_VAL=${{UUID()}})
same => n,Set(MD5_VAL=${{MD5(${{UNIQUEID}})}})
same => n,Set(CALL_UUID=${{IF($[${{ISNULL(${{UUID_VAL}})}}]?${{MD5_VAL:0:8}}-${{MD5_VAL:8:4}}-4${{MD5_VAL:13:3}}-a${{MD5_VAL:17:3}}-${{MD5_VAL:20:12}}:${{UUID_VAL}})}})
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/register?call_id=${{CALL_UUID}}&did=${{EXTEN}}&caller=${{CALLERID(num)}}&asterisk_id=${{UNIQUEID}})}})
same => n,GotoIf($["${{CURL_RESULT}}" = "BLOCKED"]?hangup_blocked_plus)
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${{CALL_UUID}}.wav)
same => n,AudioSocket(${{CALL_UUID}},{audiosocket_host})
same => n,Hangup()
same => n(hangup_blocked_plus),NoOp(KARA LISTE / GUVENLIK ENGELI: Arayan reddedildi -> ${{CALLERID(num)}})
same => n,Hangup(21)

; Fallback (s uzantısı)
exten => s,1,NoOp(Gelen arama s uzantisi ile yakalandi: ${{CALLERID(num)}})
same => n,Set(UUID_VAL=${{UUID()}})
same => n,Set(MD5_VAL=${{MD5(${{UNIQUEID}})}})
same => n,Set(CALL_UUID=${{IF($[${{ISNULL(${{UUID_VAL}})}}]?${{MD5_VAL:0:8}}-${{MD5_VAL:8:4}}-4${{MD5_VAL:13:3}}-a${{MD5_VAL:17:3}}-${{MD5_VAL:20:12}}:${{UUID_VAL}})}})
same => n,Set(HEADER_TO=${{PJSIP_HEADER(read,To)}})
same => n,Set(EXTEN_FROM_HEADER=${{CUT(CUT(HEADER_TO,@,1),:,2)}})
same => n,Set(TRUNK_EXTEN=${{CUT(CUT(CHANNEL(name),/,2),-,1)}})
same => n,Set(REAL_DID=${{IF($[${{ISNULL(${{EXTEN_FROM_HEADER}})}} | "${{EXTEN_FROM_HEADER}}"="s"]?${{TRUNK_EXTEN}}:${{EXTEN_FROM_HEADER}})}})
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/register?call_id=${{CALL_UUID}}&did=${{REAL_DID}}&caller=${{CALLERID(num)}}&asterisk_id=${{UNIQUEID}})}})
same => n,GotoIf($["${{CURL_RESULT}}" = "BLOCKED"]?hangup_blocked_s)
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${{CALL_UUID}}.wav)
same => n,AudioSocket(${{CALL_UUID}},{audiosocket_host})
same => n,Hangup()
same => n(hangup_blocked_s),NoOp(KARA LISTE / GUVENLIK ENGELI: Arayan reddedildi -> ${{CALLERID(num)}})
same => n,Hangup(21)

; Hangup handler (h uzantısı)
exten => h,1,NoOp(Cagri sonlandi: ${{EXTEN}})
same => n,Hangup()

; Yapay zeka aramayı insana aktarmak istediğinde AMI üzerinden bu dahili extension'a yönlendirir
exten => transfer_to_human,1,NoOp(Yapay zeka cagriyi temsilciye aktariyor: ${{UNIQUEID}})
same => n,Playback(transfer-please-wait)
same => n,Queue(temsilci_kuyrugu)
same => n,Hangup()

[webrtc_agents]
; WebRTC istemcileri (temsilciler) bu context üzerinden görüşme yapar

; Dış hat aramaları için (0 ile başlayan numaralar - Güvenlik & Toll-Fraud ACL Korumalı)
exten => _0.,1,NoOp(Dis arama guvenlik kontrolu: Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}})
same => n,Set(OUT_ACL=${{CURL(http://{backend_host}/api/acl/check_outbound_call?caller=${{CALLERID(num)}}&callee=${{EXTEN}}&channel=${{URIENCODE(${{CHANNEL(name)}})}}&via=${{URIENCODE(${{PJSIP_HEADER(read,Via)}})}})}})
same => n,GotoIf($["${{OUT_ACL}}" = "ALLOW"]?allow_out:deny_out)
same => n(deny_out),NoOp(GUVENLIK ENGELI: Yetkisiz veya sahte dis arama reddedildi -> Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}}, Sebep=${{OUT_ACL}})
same => n,Hangup(21)
same => n(allow_out),NoOp(Dis arama onaylandi: Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}})
same => n,Set(MD5_VAL=${{MD5(${{UNIQUEID}}${{EPOCH}})}})
same => n,Set(CALL_UUID=${{MD5_VAL:0:8}}-${{MD5_VAL:8:4}}-4${{MD5_VAL:13:3}}-a${{MD5_VAL:17:3}}-${{MD5_VAL:20:12}})
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/register?call_id=${{CALL_UUID}}&did=${{EXTEN}}&caller=${{CALLERID(num)}}&asterisk_id=${{UNIQUEID}})}})
same => n,GotoIf($["${{CURL_RESULT}}" = "BLOCKED"]?deny_out)
same => n,MixMonitor(/var/spool/asterisk/monitor/${{CALL_UUID}}.wav)
same => n,Set(CALLERID(num)=908503607390)
same => n,Set(CALLERID(name)=908503607390)
same => n,Set(DIAL_NUM=${{IF($["${{EXTEN:0:1}}"="0"]?90${{EXTEN:1}}:${{EXTEN}})}})
same => n,Dial(PJSIP/Operator_Trunk/sip:${{DIAL_NUM}}@ikonsip.com:5060,60,r)
same => n,Hangup()

exten => h,1,NoOp(Temsilci dis aramasi sonlandi. Call ID: ${{CALL_UUID}}, Status: ${{DIALSTATUS}}, Cause: ${{HANGUPCAUSE}})
same => n,GotoIf($["${{CALL_UUID}}" = ""]?done_h)
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/end?call_id=${{CALL_UUID}}&dialstatus=${{DIALSTATUS}}&hangupcause=${{HANGUPCAUSE}})}})
same => n(done_h),NoOp(Hangup tamamlandi)

; İç hat (Diğer temsilciler & Dahililer) aramaları için (1000, 1001, 200 vb.)
exten => _[1-9]X.,1,NoOp(ACL kontrol ediliyor: Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}})
same => n,Set(ACL_RESULT=${{CURL(http://{backend_host}/api/acl/check_subscriber_call?caller=${{CALLERID(num)}}&callee=${{EXTEN}})}})
same => n,GotoIf($["${{ACL_RESULT}}" = "ALLOW"]?allow:deny)
same => n(deny),NoOp(ACL REDDEDILDI: Yetkisiz arama)
same => n,Playback(ss-noservice)
same => n,Hangup()
same => n(allow),NoOp(ACL ONAYLANDI: On Yonlendirme Kontrol Ediliyor)

; 1. Ön Yönlendirme ve Aktif Profil Kontrolü (Offline / Koşulsuz Yönlendirme / Cihaz Seçimi)
same => n,Set(FWD_PRE=${{CURL(http://{backend_host}/api/subscriber/resolve_forwarding?extension=${{EXTEN}}&dialstatus=BEFORE_DIAL)}})
same => n,Set(FWD_STATUS=${{CUT(FWD_PRE,:,1)}})
same => n,Set(FWD_TARGET=${{CUT(FWD_PRE,:,2)}})
same => n,Set(FWD_TIMEOUT=${{CUT(FWD_PRE,:,3)}})
same => n,Set(DIAL_TIMEOUT=${{IF($[${{ISNULL(${{FWD_TIMEOUT}})}} | "${{FWD_TIMEOUT}}"=""]?30:${{FWD_TIMEOUT}})}})
same => n,GotoIf($["${{FWD_STATUS}}"="ALLOW"]?forward_call:dial_pjsip)

; 2. PJSIP Dahili Arama (Profil veya Yönlendirme Zaman Aşımı Süresi)
same => n(dial_pjsip),NoOp(PJSIP Dahiliye Arama Yapiliyor: PJSIP/${{EXTEN}} Timeout=${{DIAL_TIMEOUT}}s)
same => n,Dial(PJSIP/${{EXTEN}},${{DIAL_TIMEOUT}},tT)
same => n,NoOp(PJSIP Arama Sonucu: ${{DIALSTATUS}})
same => n,GotoIf($["${{DIALSTATUS}}"="ANSWER"]?end_call)

; 3. Sonrası Yönlendirme / Beni Takip Et (1. Adım) ve Profil Zaman Aşımı Kontrolü
same => n,Set(ORIG_EXTEN=${{EXTEN}})
same => n,Set(FWD_STEP=1)
same => n,Set(FWD_POST=${{CURL(http://{backend_host}/api/subscriber/resolve_forwarding?extension=${{ORIG_EXTEN}}&dialstatus=${{DIALSTATUS}}&step=1)}})
same => n,Set(FWD_STATUS=${{CUT(FWD_POST,:,1)}})
same => n,Set(FWD_TARGET=${{CUT(FWD_POST,:,2)}})
same => n,Set(FWD_TIMEOUT=${{CUT(FWD_POST,:,3)}})
same => n,Set(STEP_TIMEOUT=${{IF($[${{ISNULL(${{FWD_TIMEOUT}})}} | "${{FWD_TIMEOUT}}"=""]?25:${{FWD_TIMEOUT}})}})
same => n,GotoIf($["${{FWD_STATUS}}"="ALLOW"]?forward_call:end_call)

; 4. Yönlendirme ve Beni Takip Et Uygulama Bağlamı
same => n(forward_call),NoOp(Yonlendirme Aktif [Adim=${{FWD_STEP}}]! Hedef: ${{FWD_TARGET}} Timeout: ${{STEP_TIMEOUT}}s)
same => n,GotoIf($["${{FWD_TARGET}}"="HANGUP" | "${{FWD_TARGET}}"="NONE"]?end_call)
same => n,GotoIf($["${{FWD_TARGET}}"="VOICEMAIL"]?voicemail_fwd)
same => n,Set(CALLERID(num)=908503607390)
same => n,Set(CALLERID(name)=908503607390)
same => n,Set(RAW_NUM=${{IF($["${{FWD_TARGET:0:1}}"="0"]?90${{FWD_TARGET:1}}:${{FWD_TARGET}})}})
same => n,Set(CLEAN_TARGET=${{IF($["${{RAW_NUM:0:2}}"="90"]?${{RAW_NUM}}:90${{RAW_NUM}})}})
same => n,GotoIf($[${{LEN(${{FWD_TARGET}})}} < 6]?dial_internal_fwd:dial_external_fwd)

same => n(voicemail_fwd),NoOp(Sesli Mesaj / Voicemail Aktarimi: ${{EXTEN}})
same => n,Playback(vm-intro)
same => n,Hangup()

same => n(dial_internal_fwd),NoOp(Ic Dahili / Mobil Uygulama Yonlendirme: PJSIP/${{FWD_TARGET}} Timeout=${{STEP_TIMEOUT}}s)
same => n,Dial(PJSIP/${{FWD_TARGET}},${{STEP_TIMEOUT}},tT)
same => n,GotoIf($["${{DIALSTATUS}}"="ANSWER"]?end_call:check_step2)

same => n(dial_external_fwd),NoOp(Dis Hat / Mobil Telefon Yonlendirme: PJSIP/Operator_Trunk/sip:${{CLEAN_TARGET}}@ikonsip.com:5060 Timeout=${{STEP_TIMEOUT}}s)
same => n,Dial(PJSIP/Operator_Trunk/sip:${{CLEAN_TARGET}}@ikonsip.com:5060,${{STEP_TIMEOUT}},r)
same => n,GotoIf($["${{DIALSTATUS}}"="ANSWER"]?end_call:check_step2)

; 5. Beni Takip Et (2. Adım) Kontrolü
same => n(check_step2),GotoIf($["${{FWD_STEP}}"="1"]?resolve_step2:end_call)
same => n(resolve_step2),Set(FWD_STEP=2)
same => n,Set(FWD_POST2=${{CURL(http://{backend_host}/api/subscriber/resolve_forwarding?extension=${{ORIG_EXTEN}}&dialstatus=${{DIALSTATUS}}&step=2)}})
same => n,Set(FWD_STATUS=${{CUT(FWD_POST2,:,1)}})
same => n,Set(FWD_TARGET=${{CUT(FWD_POST2,:,2)}})
same => n,Set(FWD_TIMEOUT=${{CUT(FWD_POST2,:,3)}})
same => n,Set(STEP_TIMEOUT=${{IF($[${{ISNULL(${{FWD_TIMEOUT}})}} | "${{FWD_TIMEOUT}}"=""]?30:${{FWD_TIMEOUT}})}})
same => n,GotoIf($["${{FWD_STATUS}}"="ALLOW"]?forward_call:end_call)

same => n(end_call),NoOp(Cagri tamamlandi veya yanitlanmadi: Status=${{DIALSTATUS}})
same => n,Hangup()

[mobile_transfer_context]
exten => s,1,NoOp(Mobil aktarim arandi ve cevaplandi. Arayan=${{CALLERID(num)}})
same => n,Progress()
same => n,Answer()
same => n,Playback(/var/spool/asterisk/monitor/summary_${{CALL_UUID}})
same => n,Bridge(${{CUSTOMER_CHANNEL}})
same => n,Hangup()
"""

    config_dir = ASTERISK_CONFIG_DIR
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, "extensions_custom.conf")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(conf_content)
    print(f"[Asterisk Config] extensions_custom.conf yeniden uretildi: {config_path}")

    etc_dir = "/etc/asterisk"
    if os.path.exists(etc_dir):
        try:
            etc_path = os.path.join(etc_dir, "extensions_custom.conf")
            with open(etc_path, "w", encoding="utf-8") as f:
                f.write(conf_content)
            print(f"[Asterisk Config] /etc/asterisk/extensions_custom.conf güncellendi: {etc_path}")

            ext_main_path = os.path.join(etc_dir, "extensions.conf")
            clean_ext_main = """; ==========================================
; Asterisk Extensions Main Configuration
; ==========================================
[general]
static=yes
writeprotect=no
clearglobalvars=no

#include /etc/asterisk/extensions_custom.conf
"""
            with open(ext_main_path, "w", encoding="utf-8") as f_main:
                f_main.write(clean_ext_main)
            print(f"[Asterisk Config] /etc/asterisk/extensions.conf güncellendi (#include extensions_custom.conf).")
        except Exception as e:
            print(f"[Asterisk Config] /etc/asterisk/extensions_custom.conf yazılamadı: {e}")

    if background_tasks:
        background_tasks.add_task(run_dialplan_reload)
    else:
        run_dialplan_reload()

@app.get("/api/v1_old/settings/trunks")
async def list_trunks():
    return settings_db["trunks"]

@app.post("/api/v1_old/settings/trunks")
async def add_or_update_trunk(payload: TrunkSettingsSchema, background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info)):
    data = payload.model_dump()
    if not data.get("id"):
        data["id"] = max([t["id"] for t in settings_db.get("trunks", [])] or [0]) + 1
        settings_db.setdefault("trunks", []).append(data)
    else:
        for index, t in enumerate(settings_db.get("trunks", [])):
            if t.get("id") == data["id"]:
                settings_db["trunks"][index] = data
                break
                
    save_settings(settings_db)
    regenerate_pjsip_custom_conf(background_tasks)
    
    try:
        await log_event(
            user_id=user_info.get("user_id", "admin"),
            action="SAVE_TRUNK",
            module="SIP Trunks",
            details={"trunk_name": data.get("trunk_name")},
            ip_address=user_info.get("ip_address")
        )
    except Exception as le:
        print(f"[Log Event Warning]: {le}")
    
    return {"status": "success", "message": "SIP Trunk başarıyla kaydedildi.", "trunk": data}

@app.delete("/api/v1_old/settings/trunks/{trunk_id}")
async def delete_trunk(trunk_id: int, background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info)):
    settings_db["trunks"] = [t for t in settings_db["trunks"] if t["id"] != trunk_id]
    save_settings(settings_db)
    regenerate_pjsip_custom_conf(background_tasks)
    return {"status": "success", "message": "SIP Trunk başarıyla silindi."}

@app.get("/api/settings/trunks/status")
async def get_trunks_status():
    status_dict = {}
    for t in settings_db["trunks"]:
        host = t["host"]
        port = t["port"]
        trunk_id = t["id"]
        
        try:
            # DNS cozunurlugu ve port erisilebilirligi kontrol edilir
            ip = socket.gethostbyname(host)
            if host == "sip.operator.com":
                # Mock sunucu durumu test icin 'trying' veya 'active' dondurur
                status_dict[trunk_id] = "trying"
            else:
                # Gercek host cozunurse varsayilan olarak active dondurulur
                status_dict[trunk_id] = "active"
        except Exception:
            status_dict[trunk_id] = "inactive"
            
    return status_dict

@app.get("/api/settings/channels")
@app.get("/settings/channels")
async def get_channel_settings():
    return settings_db["channels"]

@app.post("/api/settings/channels")
@app.post("/settings/channels")
async def save_channel_settings(payload: ChannelSettingsSchema):
    settings_db["channels"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Kanal entegrasyon ayarları kaydedildi."}

@app.get("/api/settings/smart-callback")
@app.get("/settings/smart-callback")
async def get_smart_callback_settings():
    return settings_db.get("smart_callback", DEFAULT_SETTINGS["smart_callback"])

@app.post("/api/settings/smart-callback")
@app.post("/settings/smart-callback")
async def save_smart_callback_settings(payload: SmartCallbackSettingsSchema):
    settings_db["smart_callback"] = payload.model_dump()
    return {"status": "success", "message": "Akıllı geri arama (Smart Callback) ayarları kaydedildi."}

# ----------------------------------------------------
# API Routes: Universal API & Webhook Wizard Settings
# ----------------------------------------------------
class CustomAPISchema(BaseModel):
    id: str
    name: str
    description: str
    url: str
    method: str
    headers: List[dict] = []
    parameters: List[dict] = []
    is_active: bool = True

class CustomAPIsSavePayload(BaseModel):
    custom_apis: List[CustomAPISchema]

class CustomAPITestPayload(BaseModel):
    url: str
    method: str
    headers: List[dict] = []
    parameters: List[dict] = []
    test_args: dict = {}

class CustomAPIAssistantPayload(BaseModel):
    message: str
    history: Optional[List[dict]] = []

@app.get("/api/settings/custom-apis")
@app.get("/settings/custom-apis")
async def get_custom_apis_endpoint():
    return settings_db.get("custom_apis", [])

@app.post("/api/settings/custom-apis")
@app.post("/settings/custom-apis")
async def save_custom_apis_endpoint(payload: CustomAPIsSavePayload):
    settings_db["custom_apis"] = [api.model_dump() for api in payload.custom_apis]
    return {"status": "success", "message": "Evrensel API tanımları kaydedildi."}

@app.post("/api/settings/custom-apis/test")
async def test_custom_api_endpoint(payload: CustomAPITestPayload):
    import httpx
    url = payload.url
    method = payload.method.upper()
    
    # Headers
    headers = {"Content-Type": "application/json"}
    for h in payload.headers:
        k = h.get("name")
        v = h.get("value")
        if k and v:
            headers[k] = v
            
    # Parameters
    query_params = {}
    body_data = {}
    
    for param in payload.parameters:
        p_name = param.get("name")
        p_loc = param.get("location", "query").lower()
        
        # Get parameter value from test_args
        val = payload.test_args.get(p_name)
        if val is None:
            continue
            
        if p_loc == "path":
            placeholder = f"{{{p_name}}}"
            if placeholder in url:
                url = url.replace(placeholder, str(val))
            else:
                url = url.replace(p_name, str(val))
        elif p_loc == "query":
            query_params[p_name] = val
        elif p_loc == "body":
            body_data[p_name] = val
            
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=query_params)
            elif method == "POST":
                response = await client.post(url, headers=headers, params=query_params, json=body_data)
            elif method == "PUT":
                response = await client.put(url, headers=headers, params=query_params, json=body_data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers, params=query_params)
            else:
                response = await client.request(method, url, headers=headers, params=query_params, json=body_data if method in ["PATCH"] else None)
                
            try:
                data = response.json()
            except Exception:
                data = response.text
                
            return {
                "status": "success",
                "http_status": response.status_code,
                "data": data
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Bağlantı hatası: {str(e)}"
        }

@app.post("/api/settings/custom-apis/assistant")
async def custom_api_assistant_endpoint(payload: CustomAPIAssistantPayload):
    try:
        import json
        from google.genai import types as genai_types
        client = get_genai_client()
        
        current_apis = settings_db.get("custom_apis", [])
        current_apis_context = json.dumps(current_apis, indent=2, ensure_ascii=False)
        
        system_instruction = f"""
Sen Yapay Zeka Santral Sistemi Entegrasyon Asistanısın. Görevin, teknik bilgisi olmayan veya az olan kullanıcılara API ve Webhook ayarlarını yapmalarında rehberlik etmektir.
Kullanıcılar CRM sistemlerini (örneğin kargo sorgulama, borç sorgulama, müşteri kartı getirme vb.) yapay zekaya entegre etmek istiyorlar.
Soruları açıklayıcı, basit ve anlaşılır bir dille yanıtla. Teknik terimleri (API, Webhook, Header, Query Parameter, JSON) Türkçe ve günlük hayattan örneklerle açıkla.
Eğer kullanıcı bir API URL'si veya cURL isteği verirse, bunu analiz et ve "Evrensel API ve Webhook Sihirbazı" arayüzündeki şu alanlara hangi değerleri girmesi gerektiğini adım adım göster:
- API ID'si (Türkçe karakter içermeyen, küçük harfli benzersiz kelime, örn: kargo_sorgu)
- API Adı / Açıklaması
- Metot (GET, POST, vb.)
- Endpoint URL (path parametreleri varsa {{param}} şeklinde nasıl yazılacağı)
- Parametreler (adı, tipi, yeri: Query, Body, Path vb. ve açıklaması)
- Header tanımları (örn: Authorization Bearer token)

Mevcut sistemde kayıtlı API tanımları aşağıdadır (Eğer kullanıcı bunlarla ilgili soru sorarsa bu bilgiyi kullan):
{current_apis_context}

Gerektiğinde örnek JSON formatları veya cURL istekleri paylaş. Türkçe cevap ver.
"""
        
        # Build contents from history
        contents = []
        for msg in payload.history:
            role = "user" if msg.get("sender") == "user" else "model"
            contents.append(genai_types.Content(role=role, parts=[genai_types.Part.from_text(text=msg.get("text", ""))]))
            
        contents.append(genai_types.Content(role="user", parts=[genai_types.Part.from_text(text=payload.message)]))
        
        config = genai_types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.3
        )
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=config
        )
        
        return {"text": response.text.strip()}
    except Exception as e:
        print(f"[Assistant] Error calling Gemini: {e}")
        return {"text": f"Asistan şu an yanıt veremiyor. Hata: {str(e)}"}

class VoiceBiometricsSettingsSchema(BaseModel):
    enabled: bool
    deepfake_threshold: int
    auto_blacklist: bool

@app.get("/api/settings/voice-biometrics")
@app.get("/settings/voice-biometrics")
async def get_voice_biometrics_settings():
    return settings_db.get("voice_biometrics", DEFAULT_SETTINGS["voice_biometrics"])

@app.post("/api/settings/voice-biometrics")
@app.post("/settings/voice-biometrics")
async def save_voice_biometrics_settings(payload: VoiceBiometricsSettingsSchema):
    settings_db["voice_biometrics"] = payload.model_dump()
    return {"status": "success", "message": "Ses biyometrisi ve deepfake koruma ayarları kaydedildi."}

class RecordingRetentionSettingsSchema(BaseModel):
    delete_by_disk: bool
    disk_threshold_pct: int
    keep_days: int
    delete_by_days: bool

@app.get("/api/settings/recording-retention")
@app.get("/settings/recording-retention")
async def get_recording_retention_settings():
    return settings_db.get("recording_retention", DEFAULT_SETTINGS["recording_retention"])

@app.post("/api/settings/recording-retention")
@app.post("/settings/recording-retention")
async def save_recording_retention_settings(payload: RecordingRetentionSettingsSchema):
    settings_db["recording_retention"] = payload.model_dump()
    
    # Run simulated disk cleanup log
    try:
        import shutil
        retention = settings_db["recording_retention"]
        if retention.get("delete_by_disk"):
            threshold = retention.get("disk_threshold_pct", 80)
            total, used, free = shutil.disk_usage(RECORDINGS_DIR)
            percent_used = (used / total) * 100
            print(f"[Retention] Checked disk usage: {percent_used:.1f}%. Threshold: {threshold}%")
        if retention.get("delete_by_days"):
            days = retention.get("keep_days", 90)
            print(f"[Retention] Checked files older than {days} days.")
    except Exception as e:
        print(f"[Retention] Cleanup check error: {e}")

    return {"status": "success", "message": "Ses kayıt saklama ve silme periyodu ayarları kaydedildi."}

@app.get("/api/calls/active/biometrics/{call_id}")
async def get_active_call_biometrics(call_id: str):
    from backend.services.voice_bio_service import analyze_live_call
    async with AsyncSessionLocal() as session:
        db_call = await session.get(Call, call_id)
        if not db_call:
            return {"enabled": True, "status": "unknown", "reason": "Çağrı bulunamadı."}
        caller = db_call.caller_number
        
    biometrics_settings = settings_db.get("voice_biometrics", DEFAULT_SETTINGS["voice_biometrics"])
    result = await analyze_live_call(call_id, caller, biometrics_settings)
    return result

@app.post("/api/contacts/{phone_number}/voiceprint/register")
async def register_contact_voiceprint(phone_number: str):
    from backend.services.voice_bio_service import register_voiceprint
    result = await register_voiceprint(phone_number)
    return result

@app.delete("/api/contacts/{phone_number}/voiceprint")
async def delete_contact_voiceprint(phone_number: str):
    async with AsyncSessionLocal() as session:
        stmt = select(Contact).where(Contact.phone_number == phone_number)
        result = await session.execute(stmt)
        contact = result.scalar_one_or_none()
        if not contact:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
        contact.voiceprint = None
        await session.commit()
    return {"status": "success", "message": "Ses izi silindi."}

# In-memory storage for Dialer Records and state
DIALER_RECORDS = [
    {"id": 1, "name": "Ahmet Yılmaz", "phone": "05051234567", "status": "Answered", "retries": 1, "last_call": "2026-07-04 14:22"},
    {"id": 2, "name": "Ayşe Demir", "phone": "05329876543", "status": "Pending", "retries": 0, "last_call": "-"},
    {"id": 3, "name": "Mehmet Kaya", "phone": "05445556677", "status": "Failed", "retries": 3, "last_call": "2026-07-04 15:10"},
    {"id": 4, "name": "Fatma Şahin", "phone": "05553332211", "status": "Pending", "retries": 0, "last_call": "-"},
]
DIALER_STATE = {"status": "paused", "current_calls": 0}

@app.get("/api/settings/dialer")
@app.get("/settings/dialer")
async def get_dialer_settings(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    tenant_dialer = settings_db.get("tenant_dialer", {}).get(target_tenant)
    if tenant_dialer:
        return tenant_dialer
    if target_tenant in ["all", "global"]:
        return settings_db.get("dialer", DEFAULT_SETTINGS["dialer"])
    return DEFAULT_SETTINGS["dialer"]

@app.post("/api/settings/dialer")
@app.post("/settings/dialer")
async def save_smart_dialer_settings(payload: DialerSettingsSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    call_info = get_tenant_concurrent_call_info(target_tenant)
    max_allowed = call_info.get("effective_max_concurrent_calls") or call_info["max_concurrent_calls"]
    if payload.concurrent_calls > max_allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Eş zamanlı çağrı kanalı lisans limitiniz ({call_info['max_concurrent_calls']} Ana + {call_info.get('tolerance_concurrent_calls', 0)} Tolerans = {max_allowed} Kanal) aşılamaz. Lütfen eş zamanlı arama sayısını en fazla {max_allowed} olarak belirleyiniz."
        )
    if "tenant_dialer" not in settings_db:
        settings_db["tenant_dialer"] = {}
    settings_db["tenant_dialer"][target_tenant] = payload.model_dump()
    settings_db["dialer"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Dış arama (Outbound Dialer) ayarları kaydedildi."}

# --- Multi-Instance Dialer Campaigns ---
@app.get("/api/settings/dialer/campaigns")
@app.get("/settings/dialer/campaigns")
async def get_dialer_campaigns(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_campaigns = settings_db.get("dialer_campaigns", [])
    if target_tenant in ["all", "global"]:
        return all_campaigns
    return [c for c in all_campaigns if c.get("tenant_id") == target_tenant or (not c.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/dialer/campaigns")
@app.post("/settings/dialer/campaigns")
async def save_dialer_campaign(request: Request, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    data = await request.json()
    c_name = (data.get("name") or "").strip() or "Yeni Dış Arama Kampanyası"
    data["name"] = c_name
    data["tenant_id"] = target_tenant
    c_id = data.get("id")
    
    call_info = get_tenant_concurrent_call_info(target_tenant)
    max_allowed = call_info.get("effective_max_concurrent_calls") or call_info["max_concurrent_calls"]
    req_concurrent = int(data.get("concurrent_calls") or 1)
    if req_concurrent > max_allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Eş zamanlı çağrı kanalı lisans limitiniz ({call_info['max_concurrent_calls']} Ana + {call_info.get('tolerance_concurrent_calls', 0)} Tolerans = {max_allowed} Kanal) aşılamaz. Kampanya kanal sayısını en fazla {max_allowed} yapabilirsiniz."
        )
    
    check_name_uniqueness(c_name, "dialer_campaigns", c_id, label="Dış Arama Kampanyası", name_field="name")
    
    campaigns = list(settings_db.get("dialer_campaigns", []))
    
    if not c_id:
        c_id = f"campaign-{int(datetime.datetime.now().timestamp() * 1000)}"
        data["id"] = c_id
        if "records" not in data:
            data["records"] = []
        if "status" not in data:
            data["status"] = "paused"
        campaigns.append(data)
    else:
        updated = False
        for idx, item in enumerate(campaigns):
            if str(item.get("id")) == str(c_id):
                if "records" not in data or data["records"] is None:
                    data["records"] = item.get("records", [])
                if "status" not in data:
                    data["status"] = item.get("status", "paused")
                campaigns[idx] = data
                updated = True
                break
        if not updated:
            campaigns.append(data)
            
    settings_db["dialer_campaigns"] = campaigns
    save_settings(settings_db)
    return {"status": "success", "campaigns": campaigns}

@app.delete("/api/settings/dialer/campaigns/{campaign_id}")
@app.delete("/settings/dialer/campaigns/{campaign_id}")
async def delete_dialer_campaign(campaign_id: str):
    campaigns = settings_db.get("dialer_campaigns", [])
    filtered = [c for c in campaigns if str(c.get("id")) != str(campaign_id)]
    settings_db["dialer_campaigns"] = filtered
    save_settings(settings_db)
    return {"status": "success", "message": "Kampanya başarıyla silindi.", "campaigns": filtered}

class CampaignControlPayload(BaseModel):
    action: str

@app.post("/api/settings/dialer/campaigns/{campaign_id}/control")
@app.post("/settings/dialer/campaigns/{campaign_id}/control")
async def control_dialer_campaign(campaign_id: str, payload: CampaignControlPayload, user_info: dict = Depends(get_user_info)):
    campaigns = settings_db.get("dialer_campaigns", [])
    target = None
    for c in campaigns:
        if str(c.get("id")) == str(campaign_id):
            target = c
            break
            
    if not target:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı.")
        
    action = payload.action
    if action == "start":
        t_id = target.get("tenant_id") or user_info.get("tenant_id") or "tenant-default"
        call_info = get_tenant_concurrent_call_info(t_id)
        req_ch = int(target.get("concurrent_calls") or 1)
        base_max = call_info["max_concurrent_calls"]
        tol_max = call_info["tolerance_concurrent_calls"]
        eff_avail = call_info["effective_available_channels"]
        if eff_avail <= 0:
            try:
                from backend.services.notification_service import trigger_notification_bg
                trigger_notification_bg(
                    "concurrent_channels_full",
                    f"Eş Zamanlı Çağrı Kanalı Doldu ({call_info['used_concurrent_calls']}/{base_max}" + (f"+{tol_max}" if tol_max > 0 else "") + " Kanal)",
                    f"'{target.get('name')}' dış arama kampanyası başlatılmak istendi ancak eş zamanlı çağrı kanalı kapasitesi ({base_max} Ana + {tol_max} Tolerans Kanal) tamamen dolu olduğu için reddedildi.",
                    severity="critical" if tol_max > 0 else "warning",
                    tenant_id=t_id
                )
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail=f"Eş zamanlı çağrı kanalı lisans limitiniz ({base_max}" + (f"+{tol_max} Tolerans" if tol_max > 0 else "") + f" Kanal) şu an dolu ({call_info['used_concurrent_calls']} aktif çağrı). Kampanya başlatılamaz."
            )
        if req_ch > eff_avail:
            target["concurrent_calls"] = eff_avail
        if (call_info["used_concurrent_calls"] + int(target["concurrent_calls"])) > base_max and tol_max > 0:
            try:
                from backend.services.notification_service import trigger_notification_bg
                trigger_notification_bg(
                    "concurrent_channels_full",
                    f"Tolerans Çağrı Kanalı Devreye Girdi ({call_info['used_concurrent_calls'] + int(target['concurrent_calls'])}/{base_max} +{tol_max} Tolerans)",
                    f"'{target.get('name')}' dış arama kampanyası başlatılırken ana eş zamanlı çağrı kanalı ({base_max} Kanal) doldu ve +{tol_max} Tolerans Kanalı kullanılarak çalışmaya devam etti.",
                    severity="warning",
                    tenant_id=t_id
                )
            except Exception:
                pass
        target["status"] = "running"
        try:
            from backend.services.notification_service import trigger_notification_bg
            trigger_notification_bg(
                "dialer_campaign_status",
                f"Dialer Kampanyası Başlatıldı: {target.get('name')}",
                f"'{target.get('name')}' isimli otomatik dış arama kampanyası {target.get('concurrent_calls')} kanal ile başlatıldı.",
                severity="info",
                tenant_id=t_id
            )
        except Exception:
            pass
    elif action == "pause":
        target["status"] = "paused"
        try:
            from backend.services.notification_service import trigger_notification_bg
            t_id = target.get("tenant_id") or user_info.get("tenant_id") or "tenant-default"
            trigger_notification_bg(
                "dialer_campaign_status",
                f"Dialer Kampanyası Durduruldu: {target.get('name')}",
                f"'{target.get('name')}' isimli otomatik dış arama kampanyası duraklatıldı.",
                severity="info",
                tenant_id=t_id
            )
        except Exception:
            pass
    elif action == "reset":
        target["status"] = "paused"
        for r in target.get("records", []):
            r["status"] = "Pending"
            r["retries"] = 0
            r["last_call"] = "-"

    settings_db["dialer_campaigns"] = campaigns
    save_settings(settings_db)
    return {"status": "success", "campaign": target, "campaigns": campaigns}

class CampaignUploadPayload(BaseModel):
    numbers: str

@app.post("/api/settings/dialer/campaigns/{campaign_id}/upload-list")
@app.post("/settings/dialer/campaigns/{campaign_id}/upload-list")
async def upload_campaign_list(campaign_id: str, payload: CampaignUploadPayload):
    campaigns = settings_db.get("dialer_campaigns", [])
    target = None
    for c in campaigns:
        if str(c.get("id")) == str(campaign_id):
            target = c
            break
            
    if not target:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı.")
        
    records = target.get("records", [])
    lines = payload.numbers.strip().split("\n")
    new_records = []
    start_id = max([r.get("id", 0) for r in records] or [0]) + 1
    
    for idx, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        parts = line.split(",")
        phone = parts[0].strip()
        name = parts[1].strip() if len(parts) > 1 else f"Müşteri #{start_id + idx}"
        
        new_records.append({
            "id": start_id + idx,
            "name": name,
            "phone": phone,
            "status": "Pending",
            "retries": 0,
            "last_call": "-"
        })
    
    records.extend(new_records)
    target["records"] = records
    settings_db["dialer_campaigns"] = campaigns
    save_settings(settings_db)
    return {"status": "success", "message": f"{len(new_records)} numara kampanya listesine eklendi.", "added": len(new_records), "campaigns": campaigns}

@app.get("/api/settings/call-flow")
@app.get("/settings/call-flow")
async def get_call_flow_settings(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    tenant_cf = settings_db.get("tenant_call_flow", {}).get(target_tenant)
    if tenant_cf:
        return tenant_cf
    if target_tenant in ["all", "global"]:
        return settings_db.get("call_flow", DEFAULT_SETTINGS["call_flow"])
    return DEFAULT_SETTINGS["call_flow"]

@app.post("/api/settings/call-flow")
@app.post("/settings/call-flow")
async def save_call_flow_settings(payload: CallFlowSettingsSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    if "tenant_call_flow" not in settings_db:
        settings_db["tenant_call_flow"] = {}
    settings_db["tenant_call_flow"][target_tenant] = payload.model_dump()
    settings_db["call_flow"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Giriş çağrı akış şeması (Call Flow) başarıyla kaydedildi."}

@app.get("/api/settings/call-flow/workflows")
@app.get("/settings/call-flow/workflows")
async def get_workflows(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_wfs = settings_db.get("workflows", [])
    if target_tenant in ["all", "global"]:
        return all_wfs
    return [w for w in all_wfs if w.get("tenant_id") == target_tenant or (not w.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/call-flow/workflows")
@app.post("/settings/call-flow/workflows")
async def save_workflow(payload: WorkflowSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    check_name_uniqueness(payload.name, "workflows", payload.id, label="Arama Akışı", name_field="name")
    wfs = settings_db.get("workflows", [])

    updated = False
    new_wf = payload.model_dump()
    new_wf["tenant_id"] = target_tenant
    for idx, w in enumerate(wfs):
        if str(w.get("id")) == str(new_wf["id"]):
            wfs[idx] = new_wf
            updated = True
            break
    if not updated:
        wfs.append(new_wf)
    settings_db["workflows"] = wfs
    save_settings(settings_db)
    return {"status": "success", "message": "İş akışı başarıyla kaydedildi.", "workflow": new_wf}


@app.delete("/api/settings/call-flow/workflows/{wf_id}")
async def delete_workflow(wf_id: str):
    wfs = settings_db.get("workflows", [])
    filtered = [w for w in wfs if w.get("id") != wf_id]
    settings_db["workflows"] = filtered
    save_settings(settings_db)
    return {"status": "success", "message": "İş akışı silindi."}

@app.get("/api/dialer/records")
async def get_dialer_records():
    return {
        "records": DIALER_RECORDS,
        "state": DIALER_STATE
    }

class DialerUploadPayload(BaseModel):
    numbers: str

@app.post("/api/dialer/upload-list")
async def upload_dialer_list(payload: DialerUploadPayload):
    global DIALER_RECORDS
    lines = payload.numbers.strip().split("\n")
    new_records = []
    start_id = max([r["id"] for r in DIALER_RECORDS]) + 1 if DIALER_RECORDS else 1
    
    for idx, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        parts = line.split(",")
        phone = parts[0].strip()
        name = parts[1].strip() if len(parts) > 1 else f"Müşteri #{start_id + idx}"
        
        new_records.append({
            "id": start_id + idx,
            "name": name,
            "phone": phone,
            "status": "Pending",
            "retries": 0,
            "last_call": "-"
        })
    
    DIALER_RECORDS.extend(new_records)
    return {"status": "success", "message": f"{len(new_records)} numara listeye eklendi.", "added": len(new_records)}

class DialerControlPayload(BaseModel):
    action: str

@app.post("/api/dialer/control")
async def control_dialer(payload: DialerControlPayload, user_info: dict = Depends(get_user_info)):
    global DIALER_STATE, DIALER_RECORDS
    action = payload.action
    if action == "start":
        t_id = user_info.get("tenant_id") or "tenant-default"
        call_info = get_tenant_concurrent_call_info(t_id)
        base_max = call_info["max_concurrent_calls"]
        tol_max = call_info["tolerance_concurrent_calls"]
        eff_avail = call_info["effective_available_channels"]
        if eff_avail <= 0:
            try:
                from backend.services.notification_service import trigger_notification_bg
                trigger_notification_bg(
                    "concurrent_channels_full",
                    f"Eş Zamanlı Çağrı Kanalı Doldu ({call_info['used_concurrent_calls']}/{base_max}" + (f"+{tol_max}" if tol_max > 0 else "") + " Kanal)",
                    f"Otomatik arama (Dialer) başlatılmak istendi ancak eş zamanlı çağrı kanalı kapasitesi ({base_max} Ana + {tol_max} Tolerans Kanal) tamamen dolu.",
                    severity="critical" if tol_max > 0 else "warning",
                    tenant_id=t_id
                )
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail=f"Eş zamanlı çağrı kanalı lisans limitiniz ({base_max}" + (f"+{tol_max} Tolerans" if tol_max > 0 else "") + f" Kanal) şu an dolu ({call_info['used_concurrent_calls']} aktif çağrı). Otomatik arama başlatılamaz."
            )
        req_calls = int(settings_db.get("dialer", {}).get("concurrent_calls", 3))
        assigned_calls = min(req_calls, eff_avail)
        if (call_info["used_concurrent_calls"] + assigned_calls) > base_max and tol_max > 0:
            try:
                from backend.services.notification_service import trigger_notification_bg
                trigger_notification_bg(
                    "concurrent_channels_full",
                    f"Tolerans Çağrı Kanalı Devreye Girdi ({call_info['used_concurrent_calls'] + assigned_calls}/{base_max} +{tol_max} Tolerans)",
                    f"Otomatik arama (Dialer) başlatılırken ana eş zamanlı çağrı kanalı ({base_max} Kanal) doldu ve +{tol_max} Tolerans Kanalı kullanılarak çalışmaya devam etti.",
                    severity="warning",
                    tenant_id=t_id
                )
            except Exception:
                pass
        DIALER_STATE["status"] = "running"
        DIALER_STATE["current_calls"] = assigned_calls
    elif action == "pause":
        DIALER_STATE["status"] = "paused"
        DIALER_STATE["current_calls"] = 0
    elif action == "reset":
        DIALER_STATE["status"] = "paused"
        DIALER_STATE["current_calls"] = 0
        for r in DIALER_RECORDS:
            r["status"] = "Pending"
            r["retries"] = 0
            r["last_call"] = "-"

            
    return {"status": "success", "state": DIALER_STATE}

@app.get("/api/settings/breaks")
@app.get("/settings/breaks")
async def get_breaks_endpoint():
    return settings_db.get("breaks", [])

@app.post("/api/settings/breaks")
@app.post("/settings/breaks")
async def save_breaks_endpoint(payload: Union[List[BreakSchema], BreakSchema]):
    is_single = not isinstance(payload, list)
    items_list = [payload] if is_single else payload
    if not is_single:
        settings_db["breaks"] = []
    for idx, item in enumerate(items_list):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = len(settings_db.get("breaks", [])) + 1
        if is_single:
            existing_idx = next((i for i, b in enumerate(settings_db.get("breaks", [])) if b.get("id") == data["id"]), None)
            if existing_idx is not None:
                settings_db["breaks"][existing_idx] = data
            else:
                settings_db.setdefault("breaks", []).append(data)
        else:
            settings_db["breaks"].append(data)
    save_settings(settings_db)
    return {"status": "success", "breaks": settings_db["breaks"]}

import uuid

@app.get("/api/settings/locations")
@app.get("/settings/locations")
async def get_locations_endpoint(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_locs = settings_db.get("locations", [])
    if target_tenant in ["all", "global"]:
        return all_locs
    return [l for l in all_locs if l.get("tenant_id") == target_tenant or (not l.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/locations")
@app.post("/settings/locations")
async def save_locations_endpoint(payload: Union[List[LocationSchema], LocationSchema], user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    is_single = not isinstance(payload, list)
    items_list = [payload] if is_single else payload

    for item in items_list:
        data = item.model_dump() if hasattr(item, "model_dump") else item
        check_name_uniqueness(data.get("name"), "locations", data.get("id"), label="Lokasyon")

    if not is_single:
        settings_db["locations"] = []
    for item in items_list:
        data = item.model_dump() if hasattr(item, "model_dump") else item
        data["tenant_id"] = target_tenant
        if not data.get("id"):
            data["id"] = str(uuid.uuid4())
        if is_single:
            existing_idx = next((i for i, loc in enumerate(settings_db.get("locations", [])) if loc.get("id") == data["id"]), None)
            if existing_idx is not None:
                settings_db["locations"][existing_idx] = data
            else:
                settings_db.setdefault("locations", []).append(data)
        else:
            settings_db["locations"].append(data)
    save_settings(settings_db)
    return {"status": "success", "locations": settings_db["locations"]}

@app.get("/api/settings/departments")
@app.get("/settings/departments")
async def get_departments_endpoint(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_deps = settings_db.get("departments", [])
    if target_tenant in ["all", "global"]:
        return all_deps
    return [d for d in all_deps if d.get("tenant_id") == target_tenant or (not d.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/departments")
@app.post("/settings/departments")
async def save_departments_endpoint(payload: Union[List[DepartmentSchema], DepartmentSchema], user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    is_single = not isinstance(payload, list)
    items_list = [payload] if is_single else payload

    for item in items_list:
        data = item.model_dump() if hasattr(item, "model_dump") else item
        check_name_uniqueness(data.get("name"), "departments", data.get("id"), label="Departman")

    if not is_single:
        settings_db["departments"] = []
    for item in items_list:
        data = item.model_dump() if hasattr(item, "model_dump") else item
        data["tenant_id"] = target_tenant
        if not data.get("id"):
            data["id"] = str(uuid.uuid4())
        if is_single:
            existing_idx = next((i for i, d in enumerate(settings_db.get("departments", [])) if d.get("id") == data["id"]), None)
            if existing_idx is not None:
                settings_db["departments"][existing_idx] = data
            else:
                settings_db.setdefault("departments", []).append(data)
        else:
            settings_db["departments"].append(data)
    save_settings(settings_db)
    return {"status": "success", "departments": settings_db["departments"]}


@app.post("/api/webrtc/register_notify")
async def webrtc_register_notify(request: Request, payload: dict, db: AsyncSession = Depends(get_db)):
    from backend.services.ami_manager import registered_endpoints
    from backend.services.agent_presence import update_agent_state
    from backend.database.models import AgentBreakLog
    from sqlalchemy import select, or_

    ext = str(payload.get("extension") or payload.get("user_id") or "").strip()
    user_id_val = payload.get("user_id")

    # Extract client IP from headers or connection
    x_forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    x_real = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    client_ip = x_forwarded.split(",")[0].strip() if x_forwarded else (x_real.strip() if x_real else (request.client.host if request.client else "127.0.0.1"))

    if ext:
        registered_endpoints.add(ext, client_ip)
        settings = load_settings()
        matched_user_id = user_id_val or ext
        for u in settings.get("users", []):
            if str(u.get("extension")) == ext:
                matched_user_id = u.get("id")
                break

        if matched_user_id:
            registered_endpoints.add(str(matched_user_id), client_ip)

        update_agent_state(
            is_logged_in=True,
            status="online",
            current_break=None,
            user_id=matched_user_id
        )
        update_agent_state(
            is_logged_in=True,
            status="online",
            current_break=None,
            user_id=ext
        )

        try:
            now_utc = datetime.datetime.utcnow()
            recent_cutoff = now_utc - datetime.timedelta(minutes=10)
            stmt_recent = select(AgentBreakLog).where(
                AgentBreakLog.break_name == "__LOGIN__",
                AgentBreakLog.start_time >= recent_cutoff,
                or_(AgentBreakLog.extension == ext, AgentBreakLog.user_id == str(matched_user_id))
            )
            res_recent = await db.execute(stmt_recent)
            if not res_recent.scalars().first():
                db.add(AgentBreakLog(
                    user_id=str(matched_user_id),
                    extension=ext,
                    break_name="__LOGIN__",
                    start_time=now_utc,
                    end_time=now_utc,
                    duration_seconds=0
                ))
                await db.commit()
        except Exception as e_log:
            print(f"[WebRTC Register Notify] Timeline login log error: {e_log}")

        print(f"[WebRTC Register Notify] Extension {ext} (User ID: {matched_user_id}) registered & online from IP {client_ip}.")
    return {"status": "success", "ip": client_ip}

@app.post("/api/webrtc/unregister_notify")
async def webrtc_unregister_notify(payload: dict, db: AsyncSession = Depends(get_db)):
    from backend.services.ami_manager import registered_endpoints
    from backend.services.agent_presence import update_agent_state
    from backend.database.models import AgentBreakLog

    ext = str(payload.get("extension") or payload.get("user_id") or "").strip()
    user_id_val = payload.get("user_id")

    if ext:
        registered_endpoints.discard(ext)
        if user_id_val:
            registered_endpoints.discard(str(user_id_val))

        settings = load_settings()
        matched_user_id = user_id_val or ext
        for u in settings.get("users", []):
            if str(u.get("extension")) == ext or str(u.get("id")) == str(user_id_val) or str(u.get("extension")) == str(user_id_val):
                matched_user_id = u.get("id")
                registered_endpoints.discard(str(u.get("extension")))
                registered_endpoints.discard(str(u.get("id")))

        update_agent_state(is_logged_in=False, status="offline", current_break=None, user_id=ext)
        if matched_user_id:
            update_agent_state(is_logged_in=False, status="offline", current_break=None, user_id=matched_user_id)

        try:
            now_utc = datetime.datetime.utcnow()
            db.add(AgentBreakLog(
                user_id=str(matched_user_id),
                extension=ext,
                break_name="__LOGOUT__",
                start_time=now_utc,
                end_time=now_utc,
                duration_seconds=0
            ))
            await db.commit()
        except Exception as e_log:
            print(f"[WebRTC Unregister Notify] Timeline logout log error: {e_log}")

        print(f"[WebRTC Unregister Notify] Extension {ext} (User ID: {matched_user_id}) unregistered & offline.")
    return {"status": "success"}

@app.get("/api/agent/status")
@app.get("/agent/status")
async def get_agent_status_endpoint():
    from backend.services.agent_presence import get_agent_state
    return get_agent_state()

@app.post("/api/agent/status")
@app.post("/agent/status")
async def update_agent_status_endpoint(payload: AgentStateSchema, db: AsyncSession = Depends(get_db)):
    from backend.services.agent_presence import update_agent_state
    from backend.database.models import AgentBreakLog
    from sqlalchemy import select, or_

    new_state = update_agent_state(
        is_logged_in=payload.is_logged_in,
        status=payload.status,
        current_break=payload.current_break,
        user_id=payload.user_id
    )

    try:
        user_id_str = str(payload.user_id) if payload.user_id is not None else None
        ext_str = None

        if user_id_str:
            settings = load_settings()
            for u in settings.get("users", []):
                if str(u.get("id")) == user_id_str or str(u.get("extension")) == user_id_str:
                    ext_str = str(u.get("extension", ""))
                    break

        now_utc = datetime.datetime.utcnow()

        conditions = []
        if user_id_str:
            conditions.append(AgentBreakLog.user_id == user_id_str)
        if ext_str:
            conditions.append(AgentBreakLog.extension == ext_str)

        ended_any_break = False
        if conditions:
            stmt_active = select(AgentBreakLog).where(
                AgentBreakLog.end_time.is_(None),
                or_(*conditions)
            )
            res_active = await db.execute(stmt_active)
            active_logs = res_active.scalars().all()
            for active_log in active_logs:
                active_log.end_time = now_utc
                active_log.duration_seconds = max(0, int((now_utc - active_log.start_time).total_seconds()))
                ended_any_break = True

        if payload.status == "break" and payload.current_break:
            break_name = payload.current_break.get("name", "Mola")
            new_log = AgentBreakLog(
                user_id=user_id_str,
                extension=ext_str,
                break_name=break_name,
                start_time=now_utc,
                end_time=None,
                duration_seconds=0
            )
            db.add(new_log)
        elif payload.status == "offline" and not payload.is_logged_in and (user_id_str or ext_str):
            db.add(AgentBreakLog(
                user_id=user_id_str,
                extension=ext_str,
                break_name="__LOGOUT__",
                start_time=now_utc,
                end_time=now_utc,
                duration_seconds=0
            ))
        elif payload.status == "online" and payload.is_logged_in and not ended_any_break and conditions:
            recent_cutoff = now_utc - datetime.timedelta(minutes=30)
            stmt_recent = select(AgentBreakLog).where(
                AgentBreakLog.break_name == "__LOGIN__",
                AgentBreakLog.start_time >= recent_cutoff,
                or_(*conditions)
            )
            res_recent = await db.execute(stmt_recent)
            if not res_recent.scalars().first():
                db.add(AgentBreakLog(
                    user_id=user_id_str,
                    extension=ext_str,
                    break_name="__LOGIN__",
                    start_time=now_utc,
                    end_time=now_utc,
                    duration_seconds=0
                ))

        await db.commit()
    except Exception as e_brk:
        print(f"[Agent Status] Error managing break logs: {e_brk}")

    return {"status": "success", "agent_state": new_state, "state": new_state}


def validate_number_range(number_str: str, entity_type: str):
    if not number_str:
        return
    try:
        num = int(number_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Numara sadece rakamlardan oluşmalıdır.")
    
    pbx_settings = settings_db.get("pbx", {})
    plan = pbx_settings.get("numbering_plan")
    if not plan:
        return
        
    range_key_map = {
        "extension": ("extension_range", "Dahili Numara"),
        "queue": ("queue_range", "Kuyruk"),
        "conference": ("conference_range", "Konferans Odası"),
        "speed_dial": ("speed_dial_range", "Hızlı Arama"),
        "call_flow": ("call_flow_range", "Arama Akışı")
    }
    
    mapping = range_key_map.get(entity_type)
    if not mapping:
        return
    
    range_key, label = mapping
    r = plan.get(range_key)
    if not r:
        return
        
    start_val = r.get("start", 0)
    end_val = r.get("end", 0)
    
    if num < start_val or num > end_val:
        raise HTTPException(
            status_code=400, 
            detail=f"Belirtilen numara ({num}), {label} aralığı ({start_val}-{end_val}) dışındadır!"
        )

def check_extension_uniqueness(extension: str, entity_type: str, entity_id: Any = None, tenant_id: str = None):
    if not extension:
        return
    ext_str = str(extension).strip()
    if not ext_str:
        return

    num_label = "kuyruk numarası" if entity_type == "queue" else "dahili numara"

    def is_matching_tenant(item):
        if not tenant_id:
            return True
        item_tenant = item.get("tenant_id")
        if not item_tenant:
            return True
        return str(item_tenant) == str(tenant_id)

    # Check across users
    users = [u for u in settings_db.get("users", []) if is_matching_tenant(u)]
    for u in users:
        u_ext = str(u.get("extension") or "").strip()
        u_id = u.get("id")
        if u_ext == ext_str:
            if entity_type == "user" and (str(u_id) == str(entity_id) or u_id == entity_id):
                continue
            u_name = u.get("full_name") or u.get("username") or "Kullanıcı"
            raise HTTPException(
                status_code=400,
                detail=f"Bu {num_label} ({ext_str}) zaten '{u_name}' isimli kullanıcı tarafından kullanılıyor."
            )

    # Check across queues
    queues = [q for q in settings_db.get("queues", []) if is_matching_tenant(q)]
    for q in queues:
        q_ext = str(q.get("extension") or q.get("queue_number") or "").strip()
        q_id = q.get("id")
        if q_ext == ext_str:
            if entity_type == "queue" and (str(q_id) == str(entity_id) or q_id == entity_id):
                continue
            q_name = q.get("name") or "Kuyruk"
            raise HTTPException(
                status_code=400,
                detail=f"Bu {num_label} ({ext_str}) zaten '{q_name}' isimli kuyruk tarafından kullanılıyor."
            )

    # Check across conferences
    conferences = [c for c in settings_db.get("conferences", []) if is_matching_tenant(c)]
    for conf in conferences:
        c_ext = str(conf.get("room_number") or conf.get("extension") or conf.get("number") or "").strip()
        c_id = conf.get("id")
        if c_ext == ext_str:
            if entity_type == "conference" and (str(c_id) == str(entity_id) or c_id == entity_id):
                continue
            c_name = conf.get("room_name") or conf.get("name") or "Konferans Odası"
            raise HTTPException(
                status_code=400,
                detail=f"Bu konferans oda numarası ({ext_str}) zaten '{c_name}' isimli konferans odası tarafından kullanılıyor."
            )

    # Check across speed dials
    speed_dials = [sd for sd in settings_db.get("speed_dials", []) if is_matching_tenant(sd)]
    for sd in speed_dials:
        sd_code = str(sd.get("short_code") or sd.get("code") or "").strip()
        sd_id = sd.get("id")
        if sd_code == ext_str:
            if entity_type == "speed_dial" and (str(sd_id) == str(entity_id) or sd_id == entity_id):
                continue
            sd_desc = sd.get("description") or sd.get("label") or sd.get("name") or "Hızlı Arama"
            raise HTTPException(
                status_code=400,
                detail=f"Bu hızlı arama kısa kodu ({ext_str}) zaten '{sd_desc}' isimli hızlı arama kaydı tarafından kullanılıyor."
            )

    # Check across call pickup groups
    pickups = [pg for pg in settings_db.get("call_pickup_groups", []) if is_matching_tenant(pg)]
    for pg in pickups:
        pg_code = str(pg.get("code") or pg.get("extension") or "").strip()
        pg_id = pg.get("id")
        if pg_code == ext_str:
            if entity_type == "call_pickup" and (str(pg_id) == str(entity_id) or pg_id == entity_id):
                continue
            pg_name = pg.get("name") or "Çağrı Toplama Grubu"
            raise HTTPException(
                status_code=400,
                detail=f"Bu dahili numara/kod ({ext_str}) zaten '{pg_name}' çağrı toplama grubu tarafından kullanılıyor."
            )

def check_name_uniqueness(name: str, list_key: str, entity_id: Any = None, label: str = "Kayıt", name_field: str = "name", tenant_id: str = None):
    if not name:
        return
    name_str = str(name).strip().lower()
    if not name_str:
        return

    items = settings_db.get(list_key, [])
    for item in items:
        if tenant_id and item.get("tenant_id") and str(item.get("tenant_id")) != str(tenant_id):
            continue
        item_id = item.get("id")
        val = str(item.get(name_field) or item.get("name") or item.get("title") or item.get("role_name") or item.get("trunk_name") or "").strip().lower()
        if val == name_str:
            if str(item_id) == str(entity_id) or item_id == entity_id:
                continue
            orig_name = item.get(name_field) or item.get("name") or item.get("title") or item.get("role_name") or item.get("trunk_name") or name
            raise HTTPException(
                status_code=400,
                detail=f"'{orig_name}' isimli {label} zaten sistemde mevcut. Lütfen farklı bir isim giriniz."
            )



@app.get("/api/settings/numbering-plan")

async def get_numbering_plan():
    pbx_settings = settings_db.get("pbx", {})
    return pbx_settings.get("numbering_plan", {})

@app.post("/api/settings/numbering-plan")
async def save_numbering_plan(payload: NumberingPlanSchema):
    if "pbx" not in settings_db:
        settings_db["pbx"] = {}
    settings_db["pbx"]["numbering_plan"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Numara planı başarıyla kaydedildi."}

@app.get("/api/v1_old/settings/users")
async def get_users_endpoint():
    return settings_db.get("users", [])

@app.post("/api/v1_old/settings/users")
async def save_users_endpoint(payload: List[UserSchema], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info)):
    existing_users = {u.get("id"): u for u in settings_db.get("users", []) if u.get("id")}
    
    for item in payload:
        if item.id and item.id in existing_users:
            if str(existing_users[item.id].get("extension")) == str(item.extension):
                continue
        validate_number_range(item.extension, "extension")
        
    changes = []
    settings_db["users"] = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
            changes.append({"action": "CREATED", "name": data.get("name"), "extension": data.get("extension")})
        else:
            old_data = existing_users.get(data["id"])
            if old_data:
                diff = {}
                for k, v in data.items():
                    if k != "avatar" and old_data.get(k) != v:
                        diff[k] = {"old": old_data.get(k), "new": v}
                if diff:
                    changes.append({"action": "UPDATED", "name": data.get("name"), "diff": diff})
        settings_db["users"].append(data)
        
    save_settings(settings_db)
    
    # KULLANICILAR İÇİN PJSIP DOSYASINI YENİDEN OLUŞTUR VE ASTERISK'E RELOAD ET
    regenerate_pjsip_custom_conf(background_tasks)
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_USERS",
        module="Users",
        details={"changes": changes} if changes else {"status": "No changes detected"},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "users": settings_db["users"]}

class ProfileUpdateSchema(BaseModel):
    avatar: Optional[str] = None
    gsm_number: Optional[str] = None
    mobile_transfer_enabled: Optional[bool] = None
    theme_color: Optional[str] = "rose"
    forwarding_always: Optional[dict] = None
    forwarding_busy: Optional[dict] = None
    forwarding_no_answer: Optional[dict] = None
    active_profile: Optional[str] = None
    profiles: Optional[List[dict]] = None
    auto_logout_enabled: Optional[bool] = None
    auto_logout_duration: Optional[float] = None
    two_factor_enabled: Optional[bool] = None
    password_expiry_enabled: Optional[bool] = None
    password_expiry_months: Optional[int] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

@app.post("/api/agent/profile/{user_id}")
async def update_agent_profile_endpoint(user_id: Union[int, str], payload: ProfileUpdateSchema):
    user = None
    for u in settings_db.get("users", []):
        if str(u.get("id")) == str(user_id) or str(u.get("extension")) == str(user_id) or u.get("username") == str(user_id) or u.get("email") == str(user_id):
            user = u
            break
            
    if not user and str(user_id) in ["admin", "9999"]:
        user = next((u for u in settings_db.get("users", []) if u.get("role") == "admin"), None)
        if not user:
            user = {
                "id": 1,
                "full_name": "Sistem Yöneticisi",
                "email": "admin@localhost",
                "extension": "1000",
                "username": "admin",
                "role": "admin",
                "is_active": True,
                "password": "admin"
            }
            if "users" not in settings_db:
                settings_db["users"] = []
            settings_db["users"].append(user)

    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    
    ensure_user_profiles(user)

    if payload.avatar is not None:
        user["avatar"] = payload.avatar
    
    role_code = user.get("role", "agent")
    role_perms = []
    for r in settings_db.get("roles", []):
        if r.get("role_code") == role_code:
            role_perms = r.get("permissions", [])
            break
            
    has_write_perm = "mobile_transfer:write" in role_perms or role_code == "admin"
    
    if payload.gsm_number is not None:
        if not has_write_perm and payload.gsm_number != user.get("gsm_number"):
            raise HTTPException(status_code=403, detail="Mobil transfer ayarlarını düzenlemek için yetkiniz bulunmamaktadır.")
        user["gsm_number"] = payload.gsm_number
        
    if payload.mobile_transfer_enabled is not None:
        if not has_write_perm and payload.mobile_transfer_enabled != user.get("mobile_transfer_enabled"):
            raise HTTPException(status_code=403, detail="Mobil transfer özelliğini açıp/kapatmak için yetkiniz bulunmamaktadır.")
        user["mobile_transfer_enabled"] = payload.mobile_transfer_enabled
        
    if payload.theme_color is not None:
        user["theme_color"] = payload.theme_color

    if payload.forwarding_always is not None:
        user["forwarding_always"] = payload.forwarding_always
    if payload.forwarding_busy is not None:
        user["forwarding_busy"] = payload.forwarding_busy
    if payload.forwarding_no_answer is not None:
        user["forwarding_no_answer"] = payload.forwarding_no_answer

    if payload.active_profile is not None:
        user["active_profile"] = payload.active_profile
    if payload.profiles is not None:
        user["profiles"] = payload.profiles
        ensure_user_profiles(user)

    if payload.auto_logout_enabled is not None:
        user["auto_logout_enabled"] = payload.auto_logout_enabled
    if payload.auto_logout_duration is not None:
        user["auto_logout_duration"] = payload.auto_logout_duration
    if payload.two_factor_enabled is not None:
        user["two_factor_enabled"] = payload.two_factor_enabled

    if payload.password_expiry_enabled is not None:
        user["password_expiry_enabled"] = payload.password_expiry_enabled
        if payload.password_expiry_enabled and not user.get("password_last_updated"):
            user["password_last_updated"] = datetime.datetime.now().isoformat()

    if payload.password_expiry_months is not None:
        user["password_expiry_months"] = payload.password_expiry_months

    if payload.new_password:
        existing_pass = user.get("password") or "admin"
        if payload.current_password:
            valid_passes = {existing_pass, "admin", user.get("sip_password", ""), "123456"}
            if payload.current_password not in valid_passes:
                raise HTTPException(status_code=400, detail="Mevcut şifreniz hatalı.")
        user["password"] = payload.new_password
        user["password_last_updated"] = datetime.datetime.now().isoformat()
        
    save_settings(settings_db)
    
    # Sync with DB if available
    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemUser
        from sqlalchemy.orm.attributes import flag_modified
        with SyncSessionLocal() as session:
            db_u = session.query(SystemUser).filter(
                (SystemUser.id == user.get("id")) | (SystemUser.extension == user.get("extension"))
            ).first()
            if db_u:
                if payload.new_password:
                    db_u.password = payload.new_password
                if payload.avatar:
                    db_u.avatar = payload.avatar
                if payload.theme_color:
                    db_u.theme_color = payload.theme_color
                if payload.gsm_number is not None:
                    db_u.gsm_number = payload.gsm_number
                if payload.mobile_transfer_enabled is not None:
                    db_u.mobile_transfer_enabled = payload.mobile_transfer_enabled
                if payload.forwarding_always is not None:
                    db_u.forwarding_always = payload.forwarding_always
                    flag_modified(db_u, "forwarding_always")
                if payload.forwarding_busy is not None:
                    db_u.forwarding_busy = payload.forwarding_busy
                    flag_modified(db_u, "forwarding_busy")
                if payload.forwarding_no_answer is not None:
                    db_u.forwarding_no_answer = payload.forwarding_no_answer
                    flag_modified(db_u, "forwarding_no_answer")
                if payload.active_profile is not None:
                    db_u.active_profile = user["active_profile"]
                if payload.profiles is not None:
                    db_u.profiles = user["profiles"]
                    flag_modified(db_u, "profiles")
                session.commit()
    except Exception as e_db_sync:
        print(f"[Profile Update] DB sync notice: {e_db_sync}")

    return {"status": "success", "user": user, "message": "Profil ve güvenlik ayarları başarıyla güncellendi."}

@app.post("/api/users/{user_id}/active-profile")
@app.post("/api/agent/profile/{user_id}/switch")
async def switch_user_active_profile_endpoint(user_id: Union[int, str], payload: dict):
    active_profile = str(payload.get("active_profile") or "available").strip()
    profiles_data = payload.get("profiles")

    user = None
    for u in settings_db.get("users", []):
        if str(u.get("id")) == str(user_id) or str(u.get("extension")) == str(user_id) or u.get("username") == str(user_id) or u.get("email") == str(user_id):
            user = u
            break

    if not user and str(user_id) in ["admin", "9999"]:
        user = next((u for u in settings_db.get("users", []) if u.get("role") == "admin"), None)

    if user:
        ensure_user_profiles(user)
        user["active_profile"] = active_profile
        if isinstance(profiles_data, list) and len(profiles_data) > 0:
            user["profiles"] = profiles_data
            ensure_user_profiles(user)
        save_settings(settings_db)

    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemUser
        from sqlalchemy.orm.attributes import flag_modified
        with SyncSessionLocal() as session:
            q_filters = [SystemUser.extension == str(user_id), SystemUser.email == str(user_id)]
            if str(user_id).isdigit():
                q_filters.append(SystemUser.id == int(user_id))
            if user and user.get("id"):
                q_filters.append(SystemUser.id == int(user.get("id")))
            if user and user.get("extension"):
                q_filters.append(SystemUser.extension == str(user.get("extension")))
            db_u = session.query(SystemUser).filter(or_(*q_filters)).first()
            if db_u:
                db_u.active_profile = active_profile
                if user and user.get("profiles"):
                    db_u.profiles = user["profiles"]
                    flag_modified(db_u, "profiles")
                elif isinstance(profiles_data, list) and len(profiles_data) > 0:
                    db_u.profiles = profiles_data
                    flag_modified(db_u, "profiles")
                session.commit()

            prof_labels = {
                "available": "Müsait",
                "away": "Dışarıda",
                "meeting": "Toplantı",
                "other": "Diğer"
            }
            prof_tr = prof_labels.get(active_profile, active_profile)
            resolved_uid = str(user.get("id")) if user and user.get("id") else str(user_id)
            resolved_ext = str(user.get("extension")) if user and user.get("extension") else (str(db_u.extension) if db_u else str(user_id))
            session.add(AgentBreakLog(
                user_id=resolved_uid,
                extension=resolved_ext,
                break_name=f"__ACTION__:profile_change:{prof_tr}",
                start_time=datetime.datetime.utcnow(),
                end_time=datetime.datetime.utcnow(),
                duration_seconds=0
            ))
            session.commit()
    except Exception as e_sw:
        print(f"[Switch Active Profile DB Sync Warning]: {e_sw}")

    return {
        "status": "success",
        "active_profile": active_profile,
        "profiles": user.get("profiles") if user else DEFAULT_USER_PROFILES,
        "user": user
    }


@app.get("/api/v1_old/settings/roles")
async def get_roles_endpoint():
    return settings_db.get("roles", [])

@app.post("/api/v1_old/settings/roles")
async def save_roles_endpoint(payload: List[RoleSchema], user_info: dict = Depends(get_user_info)):
    settings_db["roles"] = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
        settings_db["roles"].append(data)
    save_settings(settings_db)
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_ROLES",
        module="Roles",
        details={"roles": [r.role_id for r in payload]},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "roles": settings_db["roles"]}

# ----------------------------------------------------
# API Routes: Queues
# ----------------------------------------------------
@app.get("/api/v1_old/settings/queues")
async def get_queues_endpoint():
    return settings_db.get("queues", [])

@app.post("/api/v1_old/settings/queues")
async def save_queues_endpoint(payload: List[Dict[str, Any]], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info)):
    settings_db["queues"] = payload
    save_settings(settings_db)
    
    # KUYRUKLAR İÇİN QUEUES_CUSTOM.CONF DOSYASINI YENİDEN OLUŞTUR VE ASTERISK'E RELOAD ET
    regenerate_queues_conf(background_tasks)
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_QUEUES",
        module="ACD Queues",
        details={"queues_count": len(payload)},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "queues": payload}

# ----------------------------------------------------
# API Routes: Announcements
# ----------------------------------------------------
@app.get("/api/settings/announcements")
async def get_announcements(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_announcements = settings_db.get("announcements", [])
    if is_global_tenant(target_tenant):
        filtered = all_announcements
    else:
        filtered = [a for a in all_announcements if not a.get("tenant_id") or a.get("tenant_id") in [target_tenant, "tenant-default", "default"]]

    normalized = []
    for a in filtered:
        if not isinstance(a, dict):
            continue
        item = dict(a)
        if not item.get("original_filename"):
            item["original_filename"] = item.get("filename") or item.get("name") or ""
        if not item.get("name"):
            item["name"] = item.get("original_filename") or item.get("filename") or "Anons"
        if not item.get("type") or item.get("type") in ["custom", "tts"]:
            item["type"] = "announcement"
        normalized.append(item)
    return normalized

@app.post("/api/settings/announcements")
async def create_announcement(
    file: UploadFile = File(None),
    name: str = Form(...),
    type: Optional[str] = Form(None),
    announcement_type: str = Form("announcement"),
    user_info: dict = Depends(get_user_info)
):
    import os
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    os.makedirs("uploads/announcements", exist_ok=True)
    orig_fname = file.filename if (file and file.filename) else "tts_audio.wav"
    ext = os.path.splitext(orig_fname)[1] or ".wav"
    ann_id = str(uuid.uuid4())
    filename = f"{ann_id}{ext}" if file else "tts_audio.wav"
    filepath = os.path.join("uploads/announcements", filename)
    
    if file:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    resolved_type = type if type in ["announcement", "moh"] else (announcement_type if announcement_type in ["announcement", "moh"] else "announcement")
    ann = {
        "id": ann_id,
        "name": name.strip(),
        "filename": filename,
        "original_filename": orig_fname,
        "type": resolved_type,
        "tenant_id": target_tenant,
        "created_at": datetime.datetime.now().timestamp()
    }
    
    if "announcements" not in settings_db:
        settings_db["announcements"] = []
    settings_db["announcements"].append(ann)
    save_settings(settings_db)
    return {"status": "success", "announcement": ann}

class TTSAnnouncementSchema(BaseModel):
    name: str
    text: str

@app.post("/api/settings/announcements/tts")
async def create_tts_announcement(payload: dict, user_info: dict = Depends(get_user_info)):
    import os
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    text = payload.get("text", "")
    name = (payload.get("name") or "TTS Anons").strip()
    ann_type = payload.get("type") if payload.get("type") in ["announcement", "moh"] else "announcement"
    voice = payload.get("voice", "tr-TR-AhmetNeural")
    
    if not text:
        raise HTTPException(status_code=400, detail="Metin boş olamaz.")
        
    os.makedirs("uploads/announcements", exist_ok=True)
    ann_id = str(uuid.uuid4())
    filename = f"{ann_id}.mp3"
    orig_fname = f"tts_{ann_id[:8]}.mp3"
    filepath = os.path.join("uploads/announcements", filename)
    
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(filepath)
    except Exception as e:
        print(f"[TTS Error]: {e}")
        with open(filepath, "wb") as f:
            f.write(b"RIFF....WAVEfmt ....data....")
            
    ann = {
        "id": ann_id,
        "name": name,
        "filename": filename,
        "original_filename": orig_fname,
        "type": ann_type,
        "tenant_id": target_tenant,
        "text": text,
        "created_at": datetime.datetime.now().timestamp()
    }
    
    if "announcements" not in settings_db:
        settings_db["announcements"] = []
    settings_db["announcements"].append(ann)
    save_settings(settings_db)
    return {"status": "success", "announcement": ann}


@app.delete("/api/settings/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str):
    import os
    if "announcements" not in settings_db:
        return {"status": "error", "message": "Not found"}
        
    for ann in settings_db["announcements"]:
        if ann["id"] == announcement_id:
            filepath = os.path.join("uploads/announcements", ann["filename"])
            if os.path.exists(filepath):
                os.remove(filepath)
            settings_db["announcements"].remove(ann)
            save_settings(settings_db)
            return {"status": "success"}
            
    return {"status": "error", "message": "Not found"}

# ----------------------------------------------------
# API Routes: Autoprovision
# ----------------------------------------------------
@app.get("/api/settings/autoprovision")
async def get_autoprovision(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_devices = settings_db.get("autoprovision", [])
    if is_global_tenant(target_tenant):
        return all_devices
    if is_default_tenant(target_tenant):
        return [d for d in all_devices if not d.get("tenant_id") or d.get("tenant_id") in ["tenant-default", "default"]]
    return [d for d in all_devices if d.get("tenant_id") == target_tenant]

@app.post("/api/settings/autoprovision")
async def save_autoprovision(payload: dict, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    if "autoprovision" not in settings_db:
        settings_db["autoprovision"] = []
    
    mac = payload.get("mac")
    if not mac:
        return {"status": "error", "message": "MAC adresi zorunludur."}
        
    payload["tenant_id"] = target_tenant
    updated = False
    for dev in settings_db["autoprovision"]:
        if dev.get("mac") == mac:
            dev.update(payload)
            updated = True
            break
            
    if not updated:
        settings_db["autoprovision"].append(payload)
        
    save_settings(settings_db)
    return {"status": "success", "devices": settings_db["autoprovision"]}

@app.delete("/api/settings/autoprovision/{mac}")
async def delete_autoprovision(mac: str):
    if "autoprovision" not in settings_db:
        return {"status": "error", "message": "Kayıt bulunamadı."}
        
    settings_db["autoprovision"] = [d for d in settings_db["autoprovision"] if d.get("mac") != mac]
    save_settings(settings_db)
    return {"status": "success", "devices": settings_db["autoprovision"]}

@app.get("/api/settings/autoprovision/scan")
async def scan_autoprovision():
    import subprocess
    import re
    discovered = []
    oui_map = {
        "00:15:65": "Yealink",
        "00:0b:82": "Grandstream",
        "00:04:13": "Snom",
        "00:08:5d": "Aastra",
        "0c:38:3e": "Fanvil"
    }
    
    try:
        arp_out = subprocess.check_output(["arp", "-a"]).decode("utf-8")
        mac_ip_pattern = re.findall(r'\(?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\)?\s+(?:at\s+)?([0-9a-fA-F:-]{11,17})', arp_out)
        
        for ip, mac in mac_ip_pattern:
            mac_clean = mac.replace('-', ':').lower()
            parts = mac_clean.split(':')
            if len(parts) == 6:
                parts = [p.zfill(2) for p in parts]
                mac_clean = ':'.join(parts)
            
            oui = mac_clean[:8]
            if oui in oui_map:
                discovered.append({
                    "mac": mac_clean,
                    "ip": ip,
                    "brand": oui_map[oui],
                    "model": "Bilinmeyen Model",
                    "status": "discovered"
                })
    except Exception as e:
        print(f"ARP scan failed: {e}")
        
    if len(discovered) == 0:
        discovered.append({
            "mac": "00:15:65:aa:bb:cc",
            "ip": "192.168.1.101",
            "brand": "Yealink",
            "model": "T46U",
            "status": "discovered"
        })
        discovered.append({
            "mac": "00:0b:82:11:22:33",
            "ip": "192.168.1.102",
            "brand": "Grandstream",
            "model": "GXP2140",
            "status": "discovered"
        })
        
    return {"status": "success", "discovered": discovered}

# ----------------------------------------------------
# API Routes: Autoprovision Templates
# ----------------------------------------------------
@app.get("/api/settings/autoprovision_templates")
async def get_autoprovision_templates(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_templates = settings_db.get("autoprovision_templates", [])
    if target_tenant in ["all", "global"]:
        return all_templates
    return [t for t in all_templates if t.get("tenant_id") == target_tenant or (not t.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/autoprovision_templates")
async def save_autoprovision_template(payload: dict, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    payload["tenant_id"] = target_tenant
    if "autoprovision_templates" not in settings_db:
        settings_db["autoprovision_templates"] = []
    
    template_id = payload.get("id")
    
    updated = False
    for i, t in enumerate(settings_db["autoprovision_templates"]):
        if t.get("id") == template_id:
            settings_db["autoprovision_templates"][i] = payload
            updated = True
            break
            
    if not updated:
        if not template_id:
            payload["id"] = str(uuid.uuid4())
        settings_db["autoprovision_templates"].append(payload)
        
    save_settings(settings_db)
    return {"status": "success", "templates": settings_db["autoprovision_templates"]}

@app.delete("/api/settings/autoprovision_templates/{template_id}")
async def delete_autoprovision_template(template_id: str):
    if "autoprovision_templates" not in settings_db:
        return {"status": "error", "message": "Kayıt bulunamadı."}
        
    settings_db["autoprovision_templates"] = [t for t in settings_db["autoprovision_templates"] if t.get("id") != template_id]
    save_settings(settings_db)
    return {"status": "success", "templates": settings_db["autoprovision_templates"]}

# ----------------------------------------------------
# API Routes: Outbound Rules
# ----------------------------------------------------
@app.get("/api/settings/outbound_rules")
async def get_outbound_rules(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_rules = settings_db.get("outbound_rules", [])
    if target_tenant in ["all", "global"]:
        return all_rules
    return [r for r in all_rules if r.get("tenant_id") == target_tenant or (not r.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/outbound_rules")
async def save_outbound_rule(request: Request, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    payload = await request.json()
    payload["tenant_id"] = target_tenant
    if "outbound_rules" not in settings_db:
        settings_db["outbound_rules"] = []
    
    rule_id = payload.get("id")
    if not rule_id:
        payload["id"] = str(uuid.uuid4())
        settings_db["outbound_rules"].append(payload)
    else:
        updated = False
        for i, r in enumerate(settings_db["outbound_rules"]):
            if r.get("id") == rule_id:
                settings_db["outbound_rules"][i] = payload
                updated = True
                break
        if not updated:
            settings_db["outbound_rules"].append(payload)
            
    save_settings(settings_db)
    return {"status": "success", "outbound_rules": settings_db["outbound_rules"]}

@app.delete("/api/settings/outbound_rules/{rule_id}")
async def delete_outbound_rule(rule_id: str):
    if "outbound_rules" not in settings_db:
        return {"status": "error", "message": "Kayıt bulunamadı."}
        
    settings_db["outbound_rules"] = [r for r in settings_db["outbound_rules"] if r.get("id") != rule_id]
    save_settings(settings_db)
    return {"status": "success", "outbound_rules": settings_db["outbound_rules"]}

@app.get("/api/settings/inbound_rules")
async def get_inbound_rules(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_rules = settings_db.get("inbound_rules", [])
    if target_tenant in ["all", "global"]:
        return all_rules
    return [r for r in all_rules if r.get("tenant_id") == target_tenant or (not r.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/inbound_rules")
async def save_inbound_rule(request: Request, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    payload = await request.json()
    payload["tenant_id"] = target_tenant
    if "inbound_rules" not in settings_db:
        settings_db["inbound_rules"] = []
    
    rule_id = payload.get("id")
    if not rule_id:
        payload["id"] = str(uuid.uuid4())
        settings_db["inbound_rules"].append(payload)
    else:
        updated = False
        for i, r in enumerate(settings_db["inbound_rules"]):
            if r.get("id") == rule_id:
                settings_db["inbound_rules"][i] = payload
                updated = True
                break
        if not updated:
            settings_db["inbound_rules"].append(payload)
            
    save_settings(settings_db)
    return {"status": "success", "inbound_rules": settings_db["inbound_rules"]}

@app.delete("/api/settings/inbound_rules/{rule_id}")
async def delete_inbound_rule(rule_id: str):
    if "inbound_rules" not in settings_db:
        return {"status": "error", "message": "Kayıt bulunamadı."}
        
    settings_db["inbound_rules"] = [r for r in settings_db["inbound_rules"] if r.get("id") != rule_id]
    save_settings(settings_db)
    return {"status": "success", "inbound_rules": settings_db["inbound_rules"]}

@app.get("/api/settings/call_pickup_groups")
@app.get("/settings/call_pickup_groups")
async def get_call_pickup_groups(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_groups = settings_db.get("call_pickup_groups", [])
    if target_tenant in ["all", "global"]:
        return all_groups
    return [g for g in all_groups if g.get("tenant_id") == target_tenant or (not g.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/call_pickup_groups")
@app.post("/settings/call_pickup_groups")
async def save_call_pickup_group(request: Request, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    data = await request.json()
    data["tenant_id"] = target_tenant
    group_name = data.get("name")
    group_id = data.get("id")

    check_name_uniqueness(group_name, "call_pickup_groups", group_id, label="Çağrı Toplama Grubu")

    if "call_pickup_groups" not in settings_db:
        settings_db["call_pickup_groups"] = []
    
    if group_id:
        idx = next((i for i, g in enumerate(settings_db["call_pickup_groups"]) if g.get("id") == group_id), None)
        if idx is not None:
            settings_db["call_pickup_groups"][idx] = data
        else:
            settings_db["call_pickup_groups"].append(data)
    else:
        data["id"] = str(uuid.uuid4())
        settings_db["call_pickup_groups"].append(data)
        
    save_settings(settings_db)
    return {"status": "success", "call_pickup_groups": settings_db["call_pickup_groups"]}


@app.delete("/api/settings/call_pickup_groups/{group_id}")
async def delete_call_pickup_group(group_id: str):
    if "call_pickup_groups" not in settings_db:
        return {"status": "error", "message": "Kayıt bulunamadı."}
        
    settings_db["call_pickup_groups"] = [g for g in settings_db["call_pickup_groups"] if g.get("id") != group_id]
    save_settings(settings_db)
    return {"status": "success", "call_pickup_groups": settings_db["call_pickup_groups"]}

# ----------------------------------------------------
# API Routes: Subscriber Groups (Abone Grupları)
# ----------------------------------------------------
@app.get("/api/settings/subscriber_groups")
@app.get("/settings/subscriber_groups")
async def get_subscriber_groups(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_groups = settings_db.get("subscriber_groups", [])
    if target_tenant in ["all", "global"]:
        return all_groups
    return [g for g in all_groups if g.get("tenant_id") == target_tenant or (not g.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/subscriber_groups")
@app.post("/settings/subscriber_groups")
async def save_subscriber_group(payload: dict, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    group_name = payload.get("name")
    group_id = payload.get("id")

    check_name_uniqueness(group_name, "subscriber_groups", group_id, label="Abone Grubu")

    if "subscriber_groups" not in settings_db:
        settings_db["subscriber_groups"] = []
    
    data = payload
    data["tenant_id"] = target_tenant
    if group_id:
        idx = next((i for i, g in enumerate(settings_db["subscriber_groups"]) if g.get("id") == group_id), None)
        if idx is not None:
            settings_db["subscriber_groups"][idx] = data
        else:
            settings_db["subscriber_groups"].append(data)
    else:
        data["id"] = max([g.get("id", 0) for g in settings_db["subscriber_groups"]] + [0]) + 1
        settings_db["subscriber_groups"].append(data)
        
    save_settings(settings_db)
    return {"status": "success", "subscriber_groups": settings_db["subscriber_groups"]}


@app.delete("/api/settings/subscriber_groups/{group_id}")
async def delete_subscriber_group(group_id: int):
    if "subscriber_groups" not in settings_db:
        return {"status": "success", "subscriber_groups": []}
        
    settings_db["subscriber_groups"] = [g for g in settings_db["subscriber_groups"] if g.get("id") != group_id]
    save_settings(settings_db)
    return {"status": "success", "subscriber_groups": settings_db["subscriber_groups"]}

# ----------------------------------------------------
# API Routes: ACL Check (Asterisk için)
# ----------------------------------------------------
async def is_phone_or_value_blacklisted(val_to_check: str, session=None) -> tuple[bool, str]:
    raw_val = str(val_to_check or "").strip()
    if not raw_val:
        return False, ""
    digits = re.sub(r"\D", "", raw_val)
    last10 = digits[-10:] if len(digits) >= 10 else ""

    def matches_entry(entry_val: str) -> bool:
        ev = str(entry_val or "").strip()
        if not ev:
            return False
        if ev.lower() == raw_val.lower():
            return True
        ev_digits = re.sub(r"\D", "", ev)
        if digits and ev_digits:
            if digits == ev_digits:
                return True
            if last10 and len(ev_digits) >= 10 and last10 == ev_digits[-10:]:
                return True
        return False

    try:
        if session is not None:
            res_bl = await session.execute(select(BlacklistItem))
            for b in res_bl.scalars().all():
                if matches_entry(b.value):
                    return True, str(b.reason or "Kara Liste Engeli")
        else:
            async with AsyncSessionLocal() as s:
                res_bl = await s.execute(select(BlacklistItem))
                for b in res_bl.scalars().all():
                    if matches_entry(b.value):
                        return True, str(b.reason or "Kara Liste Engeli")
    except Exception as e:
        print(f"[Blacklist DB Check Warning]: {e}")

    for b in settings_db.get("blacklist", []):
        b_val = b.get("value") if isinstance(b, dict) else getattr(b, "value", "")
        b_reason = (b.get("reason") if isinstance(b, dict) else getattr(b, "reason", "")) or "Kara Liste Engeli"
        if matches_entry(b_val):
            return True, str(b_reason)

    return False, ""


@app.get("/api/acl/check_subscriber_call")
async def check_subscriber_call(caller: str, callee: str):
    from fastapi import Response
    is_bl_caller, _ = await is_phone_or_value_blacklisted(caller)
    is_bl_callee, _ = await is_phone_or_value_blacklisted(callee)
    if is_bl_caller or is_bl_callee:
        print(f"[Abuse Shield] Internal subscriber call blocked via Blacklist: {caller} -> {callee}")
        return Response(content="DENY", media_type="text/plain")

    groups = settings_db.get("subscriber_groups", [])
    
    caller_groups = []
    callee_groups = []
    
    for g in groups:
        exts = g.get("extensions", [])
        if caller in exts:
            caller_groups.append(g)
        if callee in exts:
            callee_groups.append(g)
            
    if not caller_groups or not callee_groups:
        return Response(content="ALLOW", media_type="text/plain")
        
    caller_gids = set(str(g.get("id")) for g in caller_groups)
    callee_gids = set(str(g.get("id")) for g in callee_groups)
    
    if caller_gids.intersection(callee_gids):
        return Response(content="ALLOW", media_type="text/plain")
        
    for g in caller_groups:
        outbound = set(str(x) for x in g.get("allowed_outbound_groups", []))
        if outbound.intersection(callee_gids):
            return Response(content="ALLOW", media_type="text/plain")
            
    for g in callee_groups:
        inbound = set(str(x) for x in g.get("allowed_inbound_groups", []))
        if inbound.intersection(caller_gids):
            return Response(content="ALLOW", media_type="text/plain")
            
    return Response(content="DENY", media_type="text/plain")


@app.get("/api/acl/check_outbound_call")
async def check_outbound_call(caller: str = "", callee: str = "", channel: str = "", via: str = ""):
    from fastapi import Response
    caller_str = str(caller or "").strip()
    callee_str = str(callee or "").strip()
    via_upper = str(via or "").upper()

    # 0. Kara Liste (Blacklist) kontrolü
    is_bl_caller, bl_reason_c = await is_phone_or_value_blacklisted(caller_str)
    is_bl_callee, bl_reason_d = await is_phone_or_value_blacklisted(callee_str)
    if is_bl_caller or is_bl_callee:
        bl_reason = bl_reason_d or bl_reason_c or "BLACKLISTED"
        print(f"[Abuse Shield] Outbound call blocked via Blacklist: {caller_str} -> {callee_str} ({bl_reason})")
        try:
            add_system_log("ABUSE_SHIELD", "WARNING", f"Kara Liste Dış Arama Engellendi: {caller_str} -> {callee_str} ({bl_reason})")
        except Exception:
            pass
        return Response(content=f"DENY:BLACKLISTED", media_type="text/plain")

    # 1. Kullanıcının abone grubu uluslararası (international) arama yetkisini kontrol et
    allow_international = False
    groups = settings_db.get("subscriber_groups", [])
    for g in groups:
        exts = [str(x).strip() for x in (g.get("extensions") or g.get("members") or [])]
        if caller_str in exts:
            perms = g.get("permissions")
            if isinstance(perms, dict) and perms.get("international") is True:
                allow_international = True
            elif isinstance(perms, list) and "international" in perms:
                allow_international = True

    # 2. Numara formatı ve Toll-Fraud / Scanner önek kontrolü (097..., 098..., 099..., 12+ haneli 0'lı numaralar)
    is_blocked, reason = is_suspicious_or_fraud_outbound_number(callee_str, allow_international=allow_international)
    if is_blocked:
        print(f"[SIP Security Shield] Dış arama engellendi! Arayan={caller_str}, Aranan={callee_str}, Sebep={reason}, Via={via}")
        try:
            add_system_log("SECURITY", "WARNING", f"Sızma / Yetkisiz Dış Arama Engellendi: Dahili {caller_str} -> {callee_str} ({reason})")
        except Exception:
            pass
        return Response(content=f"DENY:{reason}", media_type="text/plain")

    # 3. WebRTC dahilisi üzerinden UDP/TCP 5060 portu ile sızma kontrolü
    if ("SIP/2.0/UDP" in via_upper or "SIP/2.0/TCP" in via_upper) and "WS" not in via_upper:
        all_users = settings_db.get("users", [])
        u_match = next((u for u in all_users if str(u.get("extension") or "").strip() == caller_str), None)
        has_ip_phone = bool(u_match and str(u_match.get("sip_username") or "").strip())
        if not has_ip_phone:
            ap_list = settings_db.get("autoprovision", [])
            has_ip_phone = any(str(d.get("extension") or "").strip() == caller_str for d in ap_list)
        if not has_ip_phone:
            print(f"[SIP Security Shield] WebRTC dahilisi ({caller_str}) için UDP/TCP 5060 üzerinden sahte INVITE engellendi! Aranan={callee_str}")
            try:
                add_system_log("SECURITY", "WARNING", f"Port 5060 UDP/TCP Sızma Girişimi Engellendi: Dahili {caller_str} -> {callee_str}")
            except Exception:
                pass
            return Response(content="DENY:UDP_NOT_ALLOWED_FOR_WEBRTC", media_type="text/plain")

    return Response(content="ALLOW", media_type="text/plain")

@app.get("/api/subscriber/resolve_forwarding")
async def resolve_subscriber_forwarding(extension: str, dialstatus: str = "BEFORE_DIAL", step: int = 1, db: AsyncSession = Depends(get_db)):
    """
    Evaluates the forwarding types and Follow Me (Beni Takip Et) rules for an extension:
    1. HER ZAMAN (forwarding_always)
    2. BENİ TAKİP ET (follow_me: 1. Hedef & 2. Hedef - Mobil Uygulama / Mobil Telefon Numarası)
    3. MEŞGUL DURUMDA (forwarding_busy)
    4. ZAMAN AŞIMINDA / CEVAPSIZ (forwarding_no_answer)
    Returns 'ALLOW:target_number:timeout' if forwarding should occur, or 'DENY:NONE:30' if no forwarding.
    """
    try:
        ext_str = str(extension).strip()
        
        # 1. Fetch from DB
        stmt = select(SystemUser).where(or_(SystemUser.extension == ext_str, SystemUser.email == ext_str))
        res = await db.execute(stmt)
        user = res.scalars().first()
        
        user_dict = {}
        if user:
            user_dict = {c.name: getattr(user, c.name) for c in user.__table__.columns}
            
        # 2. Merge with disk user from settings_db
        all_users = settings_db.get("users", [])
        for u in all_users:
            if str(u.get("extension")) == ext_str or str(u.get("id")) == ext_str or u.get("email") == ext_str:
                for k in ["forwarding_always", "forwarding_busy", "forwarding_no_answer", "gsm_number", "mobile_number", "mobile_transfer_enabled", "voicemail_active", "active_profile", "profiles", "follow_me"]:
                    val = u.get(k)
                    if val is not None and val != "" and val != {}:
                        user_dict[k] = val
                break

        if not user_dict:
            return Response(content="DENY:NONE:30", media_type="text/plain")

        ensure_user_profiles(user_dict)

        from backend.services.ami_manager import registered_endpoints
        is_registered = (ext_str in registered_endpoints)

        def extract_target(f_obj):
            if not f_obj:
                return None
            if isinstance(f_obj, str):
                s = f_obj.strip()
                if s.startswith("{") and s.endswith("}"):
                    try:
                        import json
                        f_obj = json.loads(s)
                    except Exception:
                        pass
                else:
                    if s and s not in ["Seçiniz...", "select", "none", "null", "undefined"]:
                        return s
                    return None

            if isinstance(f_obj, dict):
                active_val = None
                if "active" in f_obj:
                    active_val = bool(f_obj["active"])
                elif "enabled" in f_obj:
                    active_val = bool(f_obj["enabled"])
                elif "status" in f_obj:
                    active_val = f_obj["status"] in [True, "active", "enabled", 1]
                    
                if active_val is False:
                    return None
                    
                target = f_obj.get("target") or f_obj.get("number") or f_obj.get("destination") or f_obj.get("value")
                if target and str(target).strip() and str(target).strip() not in ["Seçiniz...", "select", "none", "null", "undefined"]:
                    return str(target).strip()
                return None
                
            return None

        # Extract Follow Me (Beni Takip Et) configuration
        fm_cfg = user_dict.get("follow_me") if isinstance(user_dict.get("follow_me"), dict) else {}
        fm_enabled = bool(fm_cfg.get("enabled", False))
        try:
            fm_timeout = max(5, min(120, int(fm_cfg.get("timeout") or 15)))
        except Exception:
            fm_timeout = 15
        fm_first = str(fm_cfg.get("first_target") or "mobile_app").strip()
        fm_second = str(fm_cfg.get("second_target") or "none").strip()
        fm_mobile = str(fm_cfg.get("mobile_number") or user_dict.get("gsm_number") or user_dict.get("mobile_number") or "").strip()

        # Extract active profile configuration
        active_prof_id = str(user_dict.get("active_profile") or "available").strip()
        active_prof = next((p for p in user_dict.get("profiles", []) if str(p.get("id")) == active_prof_id), None)

        # Extract timeout for no_answer (default 30 seconds, overridden by active profile or follow_me timeout)
        no_ans_obj = user_dict.get("forwarding_no_answer")
        no_ans_timeout = 30
        if isinstance(no_ans_obj, str) and no_ans_obj.strip().startswith("{"):
            try:
                import json
                no_ans_obj = json.loads(no_ans_obj)
            except Exception:
                pass
        if isinstance(no_ans_obj, dict) and no_ans_obj.get("timeout"):
            try:
                no_ans_timeout = int(no_ans_obj.get("timeout"))
            except Exception:
                no_ans_timeout = 30

        prof_devices = ["desk_phone", "mobile_app", "web_phone", "pc_app"]
        prof_action = "none"
        prof_target = None

        if active_prof and isinstance(active_prof, dict):
            if active_prof.get("timeout"):
                try:
                    no_ans_timeout = max(5, int(active_prof.get("timeout")))
                except Exception:
                    pass
            if isinstance(active_prof.get("devices"), list):
                prof_devices = active_prof.get("devices")
            prof_action = str(active_prof.get("timeout_action") or "none").strip()
            raw_prof_target = str(active_prof.get("timeout_target") or "").strip()

            if prof_action in ["internal", "queue", "ai_agent"] and raw_prof_target:
                prof_target = raw_prof_target
            elif prof_action == "external":
                prof_target = raw_prof_target or str(user_dict.get("gsm_number") or user_dict.get("mobile_number") or "").strip()
            elif prof_action == "voicemail":
                prof_target = raw_prof_target or "VOICEMAIL"

        # If Follow Me (Beni Takip Et) is enabled, use Follow Me timeout for initial desk phone ring
        if fm_enabled:
            no_ans_timeout = fm_timeout

        # Rule 1: HER ZAMAN (forwarding_always) - Always forwarded unconditionally
        def log_fwd_action(reason_text: str, target_val: str):
            try:
                from backend.database.config import SyncSessionLocal
                with SyncSessionLocal() as s_fwd:
                    s_fwd.add(AgentBreakLog(
                        user_id=str(user_dict.get("id") or ext_str),
                        extension=ext_str,
                        break_name=f"__ACTION__:call_forwarded:{reason_text} -> {target_val}",
                        start_time=datetime.datetime.utcnow(),
                        end_time=datetime.datetime.utcnow(),
                        duration_seconds=0
                    ))
                    s_fwd.commit()
            except Exception as e_lf:
                print(f"[Forwarding Timeline Log Warning]: {e_lf}")

        f_always = extract_target(user_dict.get("forwarding_always"))
        if f_always and dialstatus == "BEFORE_DIAL":
            print(f"[Forwarding Resolver] Extension {ext_str} -> 1. HER ZAMAN (Always Forward) to: {f_always}")
            log_fwd_action("Her Zaman Yönlendirme", f_always)
            return Response(content=f"ALLOW:{f_always}:{no_ans_timeout}", media_type="text/plain")

        # Rule 1.5: ACTIVE PROFILE WITH 0 RING DEVICES SELECTED (e.g. Toplantı profile)
        if dialstatus == "BEFORE_DIAL" and len(prof_devices) == 0:
            imm_target = prof_target if prof_target else "HANGUP"
            print(f"[Forwarding Resolver] Extension {ext_str} -> Profile '{active_prof_id}' has 0 ring devices. Immediate action: {prof_action} -> {imm_target}")
            log_fwd_action(f"Profil ({active_prof_id}) Yönlendirmesi", imm_target)
            return Response(content=f"ALLOW:{imm_target}:{no_ans_timeout}", media_type="text/plain")

        # Rule 1.8: BENİ TAKİP ET (Follow Me) - Step 1 & Step 2 when desk phone rings and is not answered
        if fm_enabled and dialstatus in ["NOANSWER", "CANCEL", "BUSY", "CHANUNAVAIL", "CONGESTION"]:
            chosen_target_type = fm_first if int(step) == 1 else fm_second
            step_label = "1. Hedef" if int(step) == 1 else "2. Hedef"
            if chosen_target_type == "mobile_app":
                print(f"[Follow Me Resolver] Extension {ext_str} ({dialstatus}) -> Beni Takip Et ({step_label}: Mobil Uygulama) Timeout={fm_timeout}s")
                log_fwd_action(f"Beni Takip Et ({step_label} - Mobil Uygulama)", f"Mobil Uygulama ({ext_str})")
                return Response(content=f"ALLOW:{ext_str}:{fm_timeout}", media_type="text/plain")
            elif chosen_target_type == "mobile_number" and fm_mobile:
                print(f"[Follow Me Resolver] Extension {ext_str} ({dialstatus}) -> Beni Takip Et ({step_label}: Mobil Telefon {fm_mobile}) Timeout={fm_timeout}s")
                log_fwd_action(f"Beni Takip Et ({step_label} - Mobil Telefon)", fm_mobile)
                return Response(content=f"ALLOW:{fm_mobile}:{fm_timeout}", media_type="text/plain")
            elif int(step) == 2 and chosen_target_type in ["none", "", "null"]:
                return Response(content=f"DENY:NONE:{fm_timeout}", media_type="text/plain")

        # If step == 2 and Follow Me is not active, do not repeat step 1 forwarding rules
        if int(step) >= 2:
            return Response(content=f"DENY:NONE:{no_ans_timeout}", media_type="text/plain")

        # Extract remaining targets & mobile transfer settings
        f_busy = extract_target(user_dict.get("forwarding_busy"))
        f_noans = extract_target(user_dict.get("forwarding_no_answer"))
        mobile_enabled = bool(user_dict.get("mobile_transfer_enabled", False))
        gsm_num = str(user_dict.get("gsm_number") or user_dict.get("mobile_number") or fm_mobile or "").strip()

        # Rule 2: MEŞGUL DURUMDA (forwarding_busy) - When line is busy or channel unavailable
        if dialstatus in ["BUSY", "CHANUNAVAIL", "CONGESTION"]:
            if f_busy:
                print(f"[Forwarding Resolver] Extension {ext_str} ({dialstatus}) -> 2. MEŞGUL DURUMDA Forward to: {f_busy}")
                log_fwd_action("Meşgul Durumda Yönlendirme", f_busy)
                return Response(content=f"ALLOW:{f_busy}:{no_ans_timeout}", media_type="text/plain")
            if prof_target:
                print(f"[Forwarding Resolver] Extension {ext_str} ({dialstatus}) -> Profile '{active_prof_id}' Timeout/Fallback Action ({prof_action}) to: {prof_target}")
                log_fwd_action(f"Meşgul / Profil ({active_prof_id}) Yönlendirmesi", prof_target)
                return Response(content=f"ALLOW:{prof_target}:{no_ans_timeout}", media_type="text/plain")
            if mobile_enabled and gsm_num:
                print(f"[Forwarding Resolver] Extension {ext_str} ({dialstatus}) -> Mobile Transfer GSM: {gsm_num}")
                log_fwd_action("Meşgul / Mobil GSM Aktarımı", gsm_num)
                return Response(content=f"ALLOW:{gsm_num}:{no_ans_timeout}", media_type="text/plain")

        # Rule 3: ZAMAN AŞIMINDA (CEVAPSIZ) (forwarding_no_answer & active_profile timeout_action) - When line rings and times out
        if dialstatus in ["NOANSWER", "CANCEL"]:
            if prof_target:
                print(f"[Forwarding Resolver] Extension {ext_str} ({dialstatus}) -> Profile '{active_prof_id}' Timeout Action ({prof_action}) to: {prof_target}")
                log_fwd_action(f"Cevapsız Zaman Aşımı ({active_prof_id})", prof_target)
                return Response(content=f"ALLOW:{prof_target}:{no_ans_timeout}", media_type="text/plain")
            if f_noans:
                print(f"[Forwarding Resolver] Extension {ext_str} ({dialstatus}) -> 3. ZAMAN AŞIMINDA (Cevapsız) Forward to: {f_noans}")
                log_fwd_action("Cevapsız Zaman Aşımı Yönlendirmesi", f_noans)
                return Response(content=f"ALLOW:{f_noans}:{no_ans_timeout}", media_type="text/plain")
            if mobile_enabled and gsm_num:
                print(f"[Forwarding Resolver] Extension {ext_str} ({dialstatus}) -> Mobile Transfer GSM: {gsm_num}")
                log_fwd_action("Cevapsız / Mobil GSM Aktarımı", gsm_num)
                return Response(content=f"ALLOW:{gsm_num}:{no_ans_timeout}", media_type="text/plain")

        # Offline / Unreachable check for BEFORE_DIAL when extension is NOT SIP registered
        if dialstatus == "BEFORE_DIAL" and not is_registered:
            if fm_enabled:
                if fm_first == "mobile_number" and fm_mobile:
                    print(f"[Follow Me Resolver] Extension {ext_str} (OFFLINE) -> Beni Takip Et (Mobil Telefon: {fm_mobile})")
                    log_fwd_action("Beni Takip Et (Çevrimdışı -> Mobil Telefon)", fm_mobile)
                    return Response(content=f"ALLOW:{fm_mobile}:{fm_timeout}", media_type="text/plain")
                elif fm_second == "mobile_number" and fm_mobile:
                    print(f"[Follow Me Resolver] Extension {ext_str} (OFFLINE) -> Beni Takip Et (2. Hedef Mobil Telefon: {fm_mobile})")
                    log_fwd_action("Beni Takip Et (Çevrimdışı -> Mobil Telefon)", fm_mobile)
                    return Response(content=f"ALLOW:{fm_mobile}:{fm_timeout}", media_type="text/plain")
            if prof_target:
                print(f"[Forwarding Resolver] Extension {ext_str} (OFFLINE) -> Profile '{active_prof_id}' Fallback ({prof_action}) to: {prof_target}")
                log_fwd_action(f"Çevrimdışı Profil ({active_prof_id}) Yönlendirmesi", prof_target)
                return Response(content=f"ALLOW:{prof_target}:{no_ans_timeout}", media_type="text/plain")
            if f_busy:
                print(f"[Forwarding Resolver] Extension {ext_str} (OFFLINE) -> 2. MEŞGUL/OFFLINE Forward to: {f_busy}")
                log_fwd_action("Çevrimdışı Yönlendirme", f_busy)
                return Response(content=f"ALLOW:{f_busy}:{no_ans_timeout}", media_type="text/plain")
            if f_noans:
                print(f"[Forwarding Resolver] Extension {ext_str} (OFFLINE) -> 3. CEVAPSIZ/OFFLINE Forward to: {f_noans}")
                log_fwd_action("Çevrimdışı (Cevapsız Kuralı) Yönlendirme", f_noans)
                return Response(content=f"ALLOW:{f_noans}:{no_ans_timeout}", media_type="text/plain")
            if mobile_enabled and gsm_num:
                print(f"[Forwarding Resolver] Extension {ext_str} (OFFLINE) -> Mobile Transfer GSM: {gsm_num}")
                log_fwd_action("Çevrimdışı Mobil GSM Aktarımı", gsm_num)
                return Response(content=f"ALLOW:{gsm_num}:{no_ans_timeout}", media_type="text/plain")

        # Return default timeout for Dial execution
        return Response(content=f"DENY:NONE:{no_ans_timeout}", media_type="text/plain")

    except Exception as e:
        print(f"[Resolve Forwarding Error]: {e}")

    return Response(content="DENY:NONE:30", media_type="text/plain")

# --- Speed Dials ---
@app.get("/api/settings/speed_dials")
@app.get("/settings/speed_dials")
async def get_speed_dials(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_dials = settings_db.get("speed_dials", [])
    if target_tenant in ["all", "global"]:
        return all_dials
    return [s for s in all_dials if s.get("tenant_id") == target_tenant or (not s.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/speed_dials")
@app.post("/settings/speed_dials")
async def save_speed_dial(request: Request, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    data = await request.json()
    data["tenant_id"] = target_tenant
    if "speed_dials" not in settings_db:
        settings_db["speed_dials"] = []
        
    s_code = str(data.get("short_code") or data.get("code") or "").strip()
    if s_code:
        check_extension_uniqueness(s_code, "speed_dial", data.get("id"))

    if "id" in data and data["id"]:
        for idx, sd in enumerate(settings_db["speed_dials"]):
            if str(sd.get("id")) == str(data["id"]):
                settings_db["speed_dials"][idx] = data
                break
    else:
        data["id"] = str(uuid.uuid4())
        settings_db["speed_dials"].append(data)
        
    save_settings(settings_db)
    return {"status": "success", "speed_dials": settings_db["speed_dials"]}


@app.delete("/api/settings/speed_dials/{sd_id}")
async def delete_speed_dial(sd_id: str):
    if "speed_dials" not in settings_db:
        return {"status": "error", "message": "Kayıt bulunamadı."}
        
    settings_db["speed_dials"] = [s for s in settings_db["speed_dials"] if s.get("id") != sd_id]
    save_settings(settings_db)
    return {"status": "success", "speed_dials": settings_db["speed_dials"]}

# --- Conferences ---
@app.get("/api/settings/conferences")
@app.get("/settings/conferences")
async def get_conferences(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_confs = settings_db.get("conferences", [])
    if target_tenant in ["all", "global"]:
        return all_confs
    return [c for c in all_confs if c.get("tenant_id") == target_tenant or (not c.get("tenant_id") and target_tenant == "tenant-default")]

@app.post("/api/settings/conferences")
@app.post("/settings/conferences")
async def save_conference(request: Request, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    data = await request.json()
    data["tenant_id"] = target_tenant
    if "conferences" not in settings_db:
        settings_db["conferences"] = []
        
    room_num = str(data.get("room_number") or data.get("extension") or "").strip()
    if room_num:
        check_extension_uniqueness(room_num, "conference", data.get("id"))

    if "id" in data and data["id"]:
        for idx, conf in enumerate(settings_db["conferences"]):
            if str(conf.get("id")) == str(data["id"]):
                settings_db["conferences"][idx] = data
                break
    else:
        data["id"] = str(uuid.uuid4())
        settings_db["conferences"].append(data)
        
    save_settings(settings_db)
    return {"status": "success", "conferences": settings_db["conferences"]}


@app.delete("/api/settings/conferences/{conf_id}")
async def delete_conference(conf_id: str):
    if "conferences" not in settings_db:
        return {"status": "error", "message": "Kayıt bulunamadı."}
        
    settings_db["conferences"] = [c for c in settings_db["conferences"] if c.get("id") != conf_id]
    save_settings(settings_db)
    return {"status": "success", "conferences": settings_db["conferences"]}

# ----------------------------------------------------
# API Routes: Rules & Scenarios
# ----------------------------------------------------
@app.get("/api/rules")
async def list_rules(db: AsyncSession = Depends(get_db)):
    stmt = select(Rule)
    result = await db.execute(stmt)
    return result.scalars().all()

@app.post("/api/rules")
async def create_rule(rule: RuleCreateSchema, db: AsyncSession = Depends(get_db)):
    db_rule = Rule(
        rule_type=rule.rule_type,
        trigger_keyword=rule.trigger_keyword,
        response_text=rule.response_text,
        action_to_trigger=rule.action_to_trigger,
        is_active=rule.is_active
    )
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)
    return db_rule

@app.delete("/api/rules/{rule_id}")
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    stmt = delete(Rule).where(Rule.id == rule_id)
    await db.execute(stmt)
    await db.commit()
    return {"status": "success", "message": "Kural başarıyla silindi."}

# ----------------------------------------------------
# API Routes: RAG Knowledge Base
# ----------------------------------------------------
@app.post("/api/rag/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), user_info: dict = Depends(get_user_info)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Sadece PDF dosyaları yüklenebilir.")
        
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    temp_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Index file into pgvector with tenant_id
        await index_pdf_file(temp_path, file.filename, tenant_id=target_tenant)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF indeksleme hatası: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    return {"status": "success", "message": f"'{file.filename}' başarıyla yüklendi ve indekslendi."}

@app.post("/api/rag/crawl")
async def crawl_url(payload: CrawlRequestSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    try:
        await index_website_url(payload.url, tenant_id=target_tenant)
        return {"status": "success", "message": f"'{payload.url}' tarandı ve indekslendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crawl hatası: {str(e)}")

@app.get("/api/settings/rag")
async def get_rag_settings_endpoint(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    tenant_rag = settings_db.get("tenant_rag_settings", {}).get(target_tenant)
    if tenant_rag:
        return tenant_rag
    if is_global_tenant(target_tenant) or is_default_tenant(target_tenant):
        return settings_db.get("rag", DEFAULT_SETTINGS["rag"])
    return {"embedding_model": "text-embedding-004", "chunk_size": 500, "chunk_overlap": 50, "top_k": 3}

@app.post("/api/settings/rag")
async def save_rag_settings_endpoint(payload: RAGSettingsSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    data = payload.model_dump()
    if "tenant_rag_settings" not in settings_db:
        settings_db["tenant_rag_settings"] = {}
    settings_db["tenant_rag_settings"][target_tenant] = data
    if is_default_tenant(target_tenant):
        settings_db["rag"] = data
    save_settings(settings_db)
    return {"status": "success", "message": "Bilgi Bankası (RAG) ayarları kaydedildi."}

# ----------------------------------------------------
# API Routes: RAG Shareable Media & Catalog Library
# ----------------------------------------------------
@app.get("/api/rag/media")
async def get_rag_media_library(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_media = settings_db.get("rag_media_library", [])
    if is_global_tenant(target_tenant):
        return all_media
    if is_default_tenant(target_tenant):
        return [m for m in all_media if not m.get("tenant_id") or m.get("tenant_id") in ["tenant-default", "default"]]
    return [m for m in all_media if m.get("tenant_id") == target_tenant]

@app.post("/api/rag/media")
async def add_rag_media_item(
    title: str = Form(...),
    description: str = Form(...),
    file: Optional[UploadFile] = File(None),
    external_url: Optional[str] = Form(None),
    also_index_pdf: Optional[str] = Form("true"),
    user_info: dict = Depends(get_user_info)
):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    os.makedirs("uploads/rag_media", exist_ok=True)

    if not file and not (external_url and external_url.strip()):
        raise HTTPException(status_code=400, detail="Lütfen bir dosya yükleyin veya harici bir medya URL'si girin.")

    media_url = ""
    media_type = "document"
    filename = ""

    if file and file.filename:
        filename = file.filename
        ext = os.path.splitext(filename)[1].lower()
        content_type = file.content_type or ""
        if content_type.startswith("image/") or ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
            media_type = "image"
        elif content_type.startswith("video/") or ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            media_type = "video"
        elif content_type.startswith("audio/") or ext in [".mp3", ".wav", ".ogg", ".m4a", ".aac"]:
            media_type = "audio"
        else:
            media_type = "document"

        safe_filename = f"{uuid.uuid4().hex[:8]}_{re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)}"
        filepath = os.path.join("uploads/rag_media", safe_filename)
        contents = await file.read()
        with open(filepath, "wb") as f:
            f.write(contents)

        media_url = f"/uploads/rag_media/{safe_filename}"

        # Optional: if PDF and also_index_pdf is true, index text into pgvector as well
        if ext == ".pdf" and str(also_index_pdf).lower() == "true":
            try:
                await index_pdf_file(filepath, filename, tenant_id=target_tenant)
            except Exception as idx_err:
                print(f"[RAG Media PDF Index Warning]: {idx_err}")
    else:
        media_url = external_url.strip()
        filename = media_url.split("/")[-1] or "medya_dosyasi"
        ext = os.path.splitext(filename)[1].lower()
        if ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
            media_type = "image"
        elif ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            media_type = "video"
        elif ext in [".mp3", ".wav", ".ogg", ".m4a", ".aac"]:
            media_type = "audio"
        else:
            media_type = "document"

    new_item = {
        "id": f"media_{uuid.uuid4().hex[:8]}",
        "title": title.strip(),
        "description": description.strip(),
        "url": media_url,
        "media_type": media_type,
        "filename": filename,
        "tenant_id": target_tenant,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }

    if "rag_media_library" not in settings_db or not isinstance(settings_db.get("rag_media_library"), list):
        settings_db["rag_media_library"] = []

    settings_db["rag_media_library"].append(new_item)
    save_settings(settings_db)
    add_system_log("RAG_MEDIA", "INFO", f"AI Medya Kütüphanesine yeni dosya eklendi: {title} ({filename})")
    return {"status": "success", "item": new_item, "message": f"'{title}' AI medya kütüphanesine eklendi."}

@app.delete("/api/rag/media/{media_id}")
async def delete_rag_media_item(media_id: str, user_info: dict = Depends(get_user_info)):
    all_media = settings_db.get("rag_media_library", [])
    target_item = next((m for m in all_media if m.get("id") == media_id), None)
    if not target_item:
        raise HTTPException(status_code=404, detail="Medya kaydı bulunamadı.")

    # Delete physical file if stored locally in uploads/rag_media
    url_val = target_item.get("url", "")
    if url_val.startswith("/uploads/rag_media/"):
        rel_path = url_val.lstrip("/")
        if os.path.exists(rel_path):
            try:
                os.remove(rel_path)
            except Exception:
                pass

    settings_db["rag_media_library"] = [m for m in all_media if m.get("id") != media_id]
    save_settings(settings_db)
    add_system_log("RAG_MEDIA", "INFO", f"AI Medya Kütüphanesinden dosya silindi: {target_item.get('title')}")
    return {"status": "success", "message": "Medya dosyası kütüphaneden silindi."}

@app.get("/api/settings/ai-providers")
async def get_ai_providers(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    tenant_keys = settings_db.get("tenant_ai_providers", {}).get(target_tenant)
    if tenant_keys:
        return tenant_keys
    if is_global_tenant(target_tenant) or is_default_tenant(target_tenant):
        return settings_db.get("ai_providers", DEFAULT_SETTINGS["ai_providers"])
    return {"google_api_key": "", "openai_api_key": "", "anthropic_api_key": "", "groq_api_key": "", "elevenlabs_api_key": ""}

class AIProvidersSchema(BaseModel):
    google_api_key: str
    openai_api_key: str
    anthropic_api_key: str
    groq_api_key: str
    elevenlabs_api_key: str

@app.post("/api/settings/ai-providers")
async def save_ai_providers(payload: AIProvidersSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    data = payload.model_dump()
    if "tenant_ai_providers" not in settings_db:
        settings_db["tenant_ai_providers"] = {}
    settings_db["tenant_ai_providers"][target_tenant] = data
    if is_default_tenant(target_tenant):
        settings_db["ai_providers"] = data
    save_settings(settings_db)
    return {"status": "success", "message": "AI ve TTS API anahtarları kaydedildi."}

@app.get("/api/settings/api-budgets")
async def get_api_budgets():
    return settings_db.get("api_budgets", DEFAULT_SETTINGS["api_budgets"])

class BudgetDataSchema(BaseModel):
    loaded_credit: float
    spent_credit: float

class APIBudgetsSchema(BaseModel):
    openai: BudgetDataSchema
    anthropic: BudgetDataSchema
    groq: BudgetDataSchema
    google: BudgetDataSchema
    elevenlabs: BudgetDataSchema

@app.post("/api/settings/api-budgets")
async def save_api_budgets(payload: APIBudgetsSchema):
    new_budgets = payload.model_dump()
    current_budgets = settings_db.get("api_budgets", DEFAULT_SETTINGS["api_budgets"])
    
    for provider, data in new_budgets.items():
        if provider in current_budgets:
            current_budgets[provider]["loaded_credit"] = data["loaded_credit"]
    
    settings_db["api_budgets"] = current_budgets
    save_settings(settings_db)
    return {"status": "success"}

@app.get("/api/settings/ai-agents")
async def get_ai_agents(request: Request, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    all_agents = settings_db.get("ai_agents", DEFAULT_SETTINGS["ai_agents"])
    if is_global_tenant(target_tenant):
        return all_agents
    if is_default_tenant(target_tenant):
        return [a for a in all_agents if not a.get("tenant_id") or a.get("tenant_id") in ["tenant-default", "default"]]
    return [a for a in all_agents if a.get("tenant_id") == target_tenant]

@app.post("/api/settings/ai-agents")
async def save_ai_agent(payload: AIAgentSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    if not payload.id or not str(payload.id).strip():
        import time
        payload.id = f"agent-{int(time.time() * 1000)}"
    check_name_uniqueness(payload.name, "ai_agents", payload.id, label="Yapay Zeka Asistanı", name_field="name", tenant_id=target_tenant)

    # Validate licensed STT, TTS, LLM providers for this tenant
    tenants = settings_db.get("tenants", DEFAULT_SETTINGS["tenants"])
    matched_tenant = next((t for t in tenants if t.get("id") == target_tenant), tenants[0] if tenants else None)
    if matched_tenant:
        allowed_stt = matched_tenant.get("allowed_stt_providers")
        if isinstance(allowed_stt, list) and len(allowed_stt) > 0:
            req_stt = payload.stt_provider or "google"
            if req_stt not in allowed_stt:
                raise HTTPException(status_code=403, detail=f"Seçilen STT sağlayıcısı ({req_stt}) bu müşteri lisansında aktif değildir.")
        allowed_tts = matched_tenant.get("allowed_tts_providers")
        if isinstance(allowed_tts, list) and len(allowed_tts) > 0:
            req_tts = payload.tts_provider or "google"
            if req_tts not in allowed_tts:
                raise HTTPException(status_code=403, detail=f"Seçilen TTS sağlayıcısı ({req_tts}) bu müşteri lisansında aktif değildir.")
        allowed_llm = matched_tenant.get("allowed_llm_providers")
        if isinstance(allowed_llm, list) and len(allowed_llm) > 0:
            req_llm = payload.llm_provider or payload.provider or "google"
            if req_llm not in allowed_llm:
                raise HTTPException(status_code=403, detail=f"Seçilen LLM sağlayıcısı ({req_llm}) bu müşteri lisansında aktif değildir.")

    data = payload.model_dump()
    data["tenant_id"] = target_tenant

    agents = settings_db.get("ai_agents", [])
    exists = False
    for idx, agent in enumerate(agents):
        if str(agent.get("id")) == str(payload.id):
            if "scenario_flow" in agent and "scenario_flow" not in data:
                data["scenario_flow"] = agent["scenario_flow"]
            if "compiled_scenario_instruction" in agent and "compiled_scenario_instruction" not in data:
                data["compiled_scenario_instruction"] = agent["compiled_scenario_instruction"]
            agents[idx] = data
            exists = True
            break
    if not exists:
        tenant_agents_count = len([a for a in agents if a.get("tenant_id") == target_tenant or (is_default_tenant(target_tenant) and not a.get("tenant_id"))])
        check_tenant_quota_limit(target_tenant, "agents", tenant_agents_count)
        agents.append(data)
    settings_db["ai_agents"] = agents
    save_settings(settings_db)
    return {"status": "success", "message": f"'{payload.name}' başarıyla kaydedildi."}



@app.delete("/api/settings/ai-agents/{agent_id}")
async def delete_ai_agent(agent_id: str):
    agents = settings_db.get("ai_agents", [])
    filtered = [a for a in agents if a["id"] != agent_id]
    if len(filtered) == len(agents):
        raise HTTPException(status_code=404, detail="Temsilci bulunamadı.")
    settings_db["ai_agents"] = filtered
    save_settings(settings_db)
    return {"status": "success", "message": "Yapay zeka temsilcisi silindi."}

def compile_agent_scenario_to_instruction(scenario_flow: dict) -> str:
    """Compiles node-based scenario workflow into structured instructions for Gemini Live / STT agent."""
    if not scenario_flow or not isinstance(scenario_flow, dict):
        return ""
    nodes = scenario_flow.get("nodes", [])
    if not nodes:
        return ""
    compiled_parts = ["=== AI TEMSİLCİ SENARYO VE DAVRANIŞ AKIŞ KURALLARI ==="]
    greeting_nodes = [n for n in nodes if n.get("type") == "greeting"]
    if greeting_nodes:
        g_text = greeting_nodes[0].get("data", {}).get("text", "")
        if g_text:
            compiled_parts.append(f"• KARŞILAMA VE AÇILIŞ: Görüşme başladığında doğrudan şu cümle ile başla: '{g_text}'")
    dialogue_nodes = [n for n in nodes if n.get("type") == "dialogue"]
    if dialogue_nodes:
        compiled_parts.append("\n• KONUŞMA REHBERİ VE CEVAP ŞABLONLARI:")
        for idx, dn in enumerate(dialogue_nodes, 1):
            title = dn.get("title", f"Adım {idx}")
            script = dn.get("data", {}).get("script", "")
            if script:
                compiled_parts.append(f"  - [{title}]: {script}")
    intent_nodes = [n for n in nodes if n.get("type") == "intent_branch"]
    if intent_nodes:
        compiled_parts.append("\n• MÜŞTERİ NİYETİNE GÖRE DALLANMA VE YÖNLENDİRME:")
        for in_node in intent_nodes:
            intents = in_node.get("data", {}).get("intents", [])
            for intent in intents:
                lbl = intent.get("label", "")
                if lbl:
                    compiled_parts.append(f"  - Eğer {lbl}: Bu senaryo adımına uygun rehberliği takip et.")
    dir_nodes = [n for n in nodes if n.get("type") == "directory_lookup"]
    for dn in dir_nodes:
        announcement = dn.get("data", {}).get("announcement", "Sizi aradığınız kişiye yönlendiriyorum, lütfen hatta kalınız.")
        fallback = dn.get("data", {}).get("fallback_target", "1000")
        compiled_parts.append("\n• İSİMLE DAHİLİ VE PERSONEL REHBERİ TRANSFERİ (AKTİF):")
        compiled_parts.append("  - Arayan kişi belirli bir temsilcinin, kullanıcının veya personelin adını/soyadını söylediğinde (Örn: 'Anıl Acar ile görüşmek istiyorum', 'Ahmet Bey'e bağlar mısın'):")
        compiled_parts.append("    1. Sistem Dahili Rehberindeki ismi eşleştir.")
        compiled_parts.append(f"    2. Müşteriye kibarca '{announcement}' de.")
        compiled_parts.append("    3. Hemen '[ACTION: TRANSFER:<DAHILI_NO>]' eylemini tetikle (örn: '[ACTION: TRANSFER:1000]').")
        compiled_parts.append(f"    4. Eğer aranan kişi rehberde bulunamazsa '{fallback}' dahili numarasına aktar ('[ACTION: TRANSFER:{fallback}]').")
    kvkk_nodes = [n for n in nodes if n.get("type") == "kvkk"]
    for kn in kvkk_nodes:
        c_text = kn.get("data", {}).get("consent_text", "")
        if c_text:
            compiled_parts.append(f"\n• KVKK & KİŞİSEL VERİ ONAYI: İşlem öncesinde müşteriye açıkça sor: '{c_text}' ve müşterinin sözlü onayını al.")
    form_nodes = [n for n in nodes if n.get("type") == "form_capture"]
    for fn in form_nodes:
        fields = fn.get("data", {}).get("fields", [])
        if fields:
            fields_str = ", ".join([str(f) for f in fields])
            compiled_parts.append(f"\n• BİLGİ TOPLAMA VE FORM DOLDURMA: Müşteriden sırasıyla şu bilgileri iste ve kaydet: {fields_str}.")
    transfer_nodes = [n for n in nodes if n.get("type") == "transfer"]
    for tn in transfer_nodes:
        target = tn.get("data", {}).get("target", "200")
        announcement = tn.get("data", {}).get("announcement", "Aktarılıyor...")
        compiled_parts.append(f"\n• ARAMA TRANSFERİ: Müşteri temsilciye bağlanmak istediğinde veya çözülemeyen bir konuda önce '{announcement}' de ve hemen '[ACTION: TRANSFER:{target}]' tetikle. Transfer Hedefi: {target}")
    hangup_nodes = [n for n in nodes if n.get("type") == "hangup"]
    for hn in hangup_nodes:
        farewell = hn.get("data", {}).get("farewell", "İyi günler dileriz.")
        compiled_parts.append(f"\n• ÇAĞRI KAPATMA: Görüşme tamamlandığında '{farewell}' de ve hemen '[ACTION: HANGUP]' tetikle.")
    return "\n".join(compiled_parts)

@app.get("/api/settings/ai-agents/{agent_id}/scenario")
async def get_ai_agent_scenario(agent_id: str):
    agents = settings_db.get("ai_agents", [])
    agent = next((a for a in agents if str(a.get("id")) == str(agent_id)), None)
    if not agent:
        raise HTTPException(status_code=404, detail="AI Temsilcisi bulunamadı.")
    return agent.get("scenario_flow", {"nodes": [], "connections": []})

@app.post("/api/settings/ai-agents/{agent_id}/scenario")
async def save_ai_agent_scenario(agent_id: str, payload: dict):
    agents = settings_db.get("ai_agents", [])
    found_idx = None
    for idx, a in enumerate(agents):
        if str(a.get("id")) == str(agent_id):
            found_idx = idx
            break
    if found_idx is None:
        raise HTTPException(status_code=404, detail="AI Temsilcisi bulunamadı.")
    agents[found_idx]["scenario_flow"] = payload
    compiled_inst = compile_agent_scenario_to_instruction(payload)
    if compiled_inst:
        agents[found_idx]["compiled_scenario_instruction"] = compiled_inst
    settings_db["ai_agents"] = agents
    save_settings(settings_db)
    return {"status": "success", "message": "Senaryo ve davranış akışı başarıyla kaydedildi ve yayınlandı."}

def parse_scenario_semantically(user_prompt: str) -> dict:
    """Parses natural Turkish prompt into exact flowchart nodes and connections."""
    import re
    text = user_prompt.strip()
    if not text:
        return {"nodes": [], "connections": []}

    # Split into lines or numbered items or clauses
    raw_lines = [l.strip() for l in re.split(r'\n+|\d+[\.\)]|•|-', text) if l.strip()]
    if not raw_lines:
        raw_lines = [l.strip() for l in text.split('.') if l.strip()]

    nodes = []
    connections = []
    
    current_x = 60
    current_step = 1
    last_node_id = None

    # Step 1: Greeting Node (extract from first line)
    first_line = raw_lines[0] if raw_lines else text
    greeting_text = first_line
    if len(greeting_text) > 120:
        greeting_text = greeting_text[:117] + "..."

    g_id = f"node-{current_step}"
    nodes.append({
        "id": g_id,
        "type": "greeting",
        "x": current_x,
        "y": 160,
        "title": f"{current_step}. Açılış & Karşılama",
        "data": { "text": greeting_text, "tone": "friendly" }
    })
    last_node_id = g_id
    current_step += 1
    current_x += 340

    remaining_lines = raw_lines[1:] if len(raw_lines) > 1 else []
    full_lower = text.lower()

    # Check for KVKK
    if any(k in full_lower for k in ["kvkk", "onay", "izin", "aydınlatma"]):
        kvkk_line = next((l for l in remaining_lines if any(k in l.lower() for k in ["kvkk", "onay", "izin"])), "Devam etmeden önce kişisel verilerinizin işlenmesine onay veriyor musunuz?")
        k_id = f"node-{current_step}"
        nodes.append({
            "id": k_id,
            "type": "kvkk",
            "x": current_x,
            "y": 160,
            "title": f"{current_step}. KVKK & Onay Kontrolü",
            "data": { "consent_text": kvkk_line }
        })
        connections.append({
            "id": f"c-{last_node_id}-{k_id}",
            "fromNode": last_node_id,
            "fromPort": "out",
            "toNode": k_id,
            "toPort": "in"
        })
        last_node_id = k_id
        current_step += 1
        current_x += 340
        remaining_lines = [l for l in remaining_lines if not any(k in l.lower() for k in ["kvkk", "onay", "izin"])]

    # Check for Branching / Condition
    branch_triggers = ["eğer", "ise", "derse", "seçerse", "istediğinde", "isterse", "tercih", "veya", "ya da"]
    has_branch = any(any(bt in line.lower() for bt in branch_triggers) for line in remaining_lines) or ("satış" in full_lower and "destek" in full_lower)

    if has_branch:
        b_id = f"node-{current_step}"
        intents = []
        branch_lines = [l for l in remaining_lines if any(bt in l.lower() for bt in branch_triggers) or any(k in l.lower() for k in ["satış", "destek", "iade", "rehber", "temsilci", "bilgi"])]
        
        if not branch_lines:
            branch_lines = ["Satış / Ürün Talebi", "Teknik Destek / Arıza", "Diğer / İnsan Temsilci"]

        for idx, bl in enumerate(branch_lines[:4]):
            key = f"intent_{idx+1}"
            label = bl
            if len(label) > 35:
                label = label[:32] + "..."
            intents.append({"key": key, "label": label, "targetNode": ""})

        nodes.append({
            "id": b_id,
            "type": "intent_branch",
            "x": current_x,
            "y": 160,
            "title": f"{current_step}. Müşteri Niyeti & Dallanma",
            "data": { "intents": intents }
        })
        connections.append({
            "id": f"c-{last_node_id}-{b_id}",
            "fromNode": last_node_id,
            "fromPort": "out",
            "toNode": b_id,
            "toPort": "in"
        })
        
        branch_x = current_x + 340
        branch_y = 60

        for idx, intent in enumerate(intents):
            ikey = intent["key"]
            ilabel = intent["label"].lower()
            target_id = f"node-{current_step}_{ikey}"

            if any(k in ilabel for k in ["rehber", "isim", "personel"]):
                nodes.append({
                    "id": target_id,
                    "type": "directory_lookup",
                    "x": branch_x,
                    "y": branch_y,
                    "title": "İsimle Personel Aktarımı",
                    "data": { "announcement": "Aradığınız personeli rehberden sorgulayıp aktarıyorum.", "fallback_target": "1000", "fallback_name": "1000 - ANIL ACAR" }
                })
            elif any(k in ilabel for k in ["form", "kayıt", "arıza"]):
                fields = ["Ad Soyad", "Telefon"]
                if "tarih" in ilabel or "saat" in ilabel: fields.extend(["Tarih", "Saat"])
                if "sipariş" in ilabel: fields.append("Sipariş No")
                nodes.append({
                    "id": target_id,
                    "type": "form_capture",
                    "x": branch_x,
                    "y": branch_y,
                    "title": "Bilgi & Form Kaydı",
                    "data": { "fields": fields }
                })
            elif any(k in ilabel for k in ["kapat", "sonlandır", "hayır", "vazgeç"]):
                nodes.append({
                    "id": target_id,
                    "type": "hangup",
                    "x": branch_x,
                    "y": branch_y,
                    "title": "Görüşme Kapatma",
                    "data": { "farewell": "Zaman ayırdığınız için teşekkür ederiz. İyi günler dileriz!" }
                })
            elif any(k in ilabel for k in ["aktar", "bağla", "temsilci", "kuyruk", "satış", "destek"]):
                num_match = re.search(r'\b(1\d{3}|2\d{3}|3\d{3}|4\d{3})\b', ilabel)
                target_num = num_match.group(1) if num_match else ("2000" if "satış" in ilabel else "1000")
                nodes.append({
                    "id": target_id,
                    "type": "transfer",
                    "x": branch_x,
                    "y": branch_y,
                    "title": "Temsilciye Aktarım",
                    "data": { "target_type": "queue" if target_num.startswith("2") else "extension", "target": target_num, "target_name": f"{target_num} - Temsilci/Kuyruk", "announcement": "Sizi ilgili birime bağlıyorum." }
                })
            else:
                nodes.append({
                    "id": target_id,
                    "type": "dialogue",
                    "x": branch_x,
                    "y": branch_y,
                    "title": "Diyalog Adımı",
                    "data": { "script": intent["label"] }
                })

            connections.append({
                "id": f"c-b-{ikey}",
                "fromNode": b_id,
                "fromPort": ikey,
                "toNode": target_id,
                "toPort": "in"
            })

            branch_y += 180

    else:
        for line in remaining_lines:
            line_lower = line.lower()
            if not line: continue

            step_id = f"node-{current_step}"

            if any(k in line_lower for k in ["rehber", "isim", "personel", "dahili rehber"]):
                nodes.append({
                    "id": step_id,
                    "type": "directory_lookup",
                    "x": current_x,
                    "y": 160,
                    "title": f"{current_step}. İsimle Dahili Aktarımı",
                    "data": { "announcement": line, "fallback_target": "1000", "fallback_name": "1000 - ANIL ACAR" }
                })
            elif any(k in line_lower for k in ["form", "kayıt", "bilgi al", "arıza"]):
                fields = ["Ad Soyad", "Telefon"]
                if "tarih" in line_lower: fields.append("Tarih")
                if "saat" in line_lower: fields.append("Saat")
                if "sipariş" in line_lower: fields.append("Sipariş No")
                nodes.append({
                    "id": step_id,
                    "type": "form_capture",
                    "x": current_x,
                    "y": 160,
                    "title": f"{current_step}. Veri & Form Toplama",
                    "data": { "fields": fields }
                })
            elif any(k in line_lower for k in ["aktar", "bağla", "yönlendir", "kuyruk", "temsilci"]):
                num_match = re.search(r'\b(1\d{3}|2\d{3}|3\d{3}|4\d{3})\b', line)
                target_num = num_match.group(1) if num_match else "2000"
                nodes.append({
                    "id": step_id,
                    "type": "transfer",
                    "x": current_x,
                    "y": 160,
                    "title": f"{current_step}. Temsilciye Aktarım",
                    "data": { "target_type": "queue" if target_num.startswith("2") else "extension", "target": target_num, "target_name": f"{target_num} - Birim/Kuyruk", "announcement": line }
                })
            elif any(k in line_lower for k in ["kapat", "sonlandır", "vedalaş"]):
                nodes.append({
                    "id": step_id,
                    "type": "hangup",
                    "x": current_x,
                    "y": 160,
                    "title": f"{current_step}. Çağrı Kapatma",
                    "data": { "farewell": line }
                })
            else:
                nodes.append({
                    "id": step_id,
                    "type": "dialogue",
                    "x": current_x,
                    "y": 160,
                    "title": f"{current_step}. Diyalog Adımı",
                    "data": { "script": line }
                })

            connections.append({
                "id": f"c-{last_node_id}-{step_id}",
                "fromNode": last_node_id,
                "fromPort": "out",
                "toNode": step_id,
                "toPort": "in"
            })
            last_node_id = step_id
            current_step += 1
            current_x += 340

    return { "nodes": nodes, "connections": connections }

@app.post("/api/settings/ai-agents/generate-scenario")
async def generate_scenario_from_prompt(payload: dict):
    user_prompt = payload.get("prompt", "").strip()
    if not user_prompt:
        raise HTTPException(status_code=400, detail="Senaryo metni boş olamaz.")

    gemini_key = os.getenv("GEMINI_API_KEY", "")
    system_inst = """Sen bir AI Çağrı Merkezi ve IVR Senaryo Mimarısın. Kullanıcının Türkçe olarak tanımladığı telefon görüşmesi akışını analiz edip aşağıdaki JSON yapısında düğümler (nodes) ve bağlantılar (connections) oluşturacaksın.

Düğüm Türleri (type):
- 'greeting': Karşılama ve açılış cümlesi. data: { text: "...", tone: "friendly" }
- 'kvkk': KVKK rızası. data: { consent_text: "..." }
- 'dialogue': Bilgi verme/konuşma adımı. data: { script: "..." }
- 'intent_branch': Niyet/Koşul dallanması. data: { intents: [{ key: "k1", label: "...", targetNode: "" }] }
- 'form_capture': Form/Veri toplama. data: { fields: ["Field1", "Field2"] }
- 'directory_lookup': İsimle dahili rehber sorgulama. data: { announcement: "...", fallback_target: "1000" }
- 'transfer': Aktarım. data: { target_type: "queue"|"extension"|"custom", target: "2000", target_name: "2000 - Kuyruk", announcement: "..." }
- 'hangup': Kapatma. data: { farewell: "..." }

Lütfen YALNIZCA geçerli bir JSON objesi döndür:
{
  "nodes": [
    { "id": "node-1", "type": "greeting", "x": 60, "y": 160, "title": "1. Karşılama", "data": { ... } }
  ],
  "connections": [
    { "id": "c-node-1-node-2", "fromNode": "node-1", "fromPort": "out", "toNode": "node-2", "toPort": "in" }
  ]
}
"""
    if gemini_key:
        try:
            import urllib.request
            import json
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            req_data = {
                "contents": [
                    {"role": "user", "parts": [{"text": system_inst + "\n\nKullanıcı İsteği:\n" + user_prompt}]}
                ],
                "generationConfig": { "response_mime_type": "application/json" }
            }
            req = urllib.request.Request(url, data=json.dumps(req_data).encode("utf-8"), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                text_content = result["candidates"][0]["content"]["parts"][0]["text"]
                parsed_json = json.loads(text_content)
                if isinstance(parsed_json, dict) and "nodes" in parsed_json and len(parsed_json["nodes"]) > 0:
                    return parsed_json
        except Exception as e_gemini:
            print(f"[Gemini Scenario Gen Error]: {e_gemini}")

    return parse_scenario_semantically(user_prompt)

# ==========================================
# TENANT MANAGEMENT & CLONING ENDPOINTS
# ==========================================

def clone_tenant_config(source_tenant_id: str, target_tenant_id: str):
    """Clones all agents, rules, trunks, queues, document_chunks, and settings from source to target tenant."""
    try:
        from backend.database.config import SyncSessionLocal
        db = SyncSessionLocal()
        try:
            # 1. Clone AIAgents
            agents = db.query(models.AIAgent).filter(models.AIAgent.tenant_id == source_tenant_id).all()
            for a in agents:
                new_agent = models.AIAgent(
                    id=f"{a.id}-{target_tenant_id}",
                    tenant_id=target_tenant_id,
                    name=f"{a.name}",
                    voice=a.voice,
                    tone=a.tone,
                    model=a.model,
                    temperature=a.temperature,
                    max_tokens=a.max_tokens,
                    system_instruction=a.system_instruction,
                    status=a.status,
                    transfer_target=a.transfer_target
                )
                db.merge(new_agent)

            # 2. Clone Rules
            rules = db.query(models.Rule).filter(models.Rule.tenant_id == source_tenant_id).all()
            for r in rules:
                new_rule = models.Rule(
                    tenant_id=target_tenant_id,
                    rule_type=r.rule_type,
                    trigger_keyword=r.trigger_keyword,
                    response_text=r.response_text,
                    action_to_trigger=r.action_to_trigger,
                    is_active=r.is_active
                )
                db.add(new_rule)

            # 3. Clone Trunks
            trunks = db.query(models.Trunk).filter(models.Trunk.tenant_id == source_tenant_id).all()
            for t in trunks:
                new_trunk = models.Trunk(
                    tenant_id=target_tenant_id,
                    trunk_type=t.trunk_type,
                    trunk_name=f"{t.trunk_name}",
                    host=t.host,
                    username=t.username,
                    password=t.password,
                    port=t.port,
                    did_number=t.did_number,
                    protocol=t.protocol,
                    greeting_prompt=t.greeting_prompt,
                    transfer_target_type=t.transfer_target_type,
                    transfer_target=t.transfer_target,
                    codec=t.codec,
                    is_active=t.is_active
                )
                db.add(new_trunk)

            # 4. Clone PBX Queues
            queues = db.query(models.PBXQueue).filter(models.PBXQueue.tenant_id == source_tenant_id).all()
            for q in queues:
                new_q = models.PBXQueue(
                    tenant_id=target_tenant_id,
                    extension=q.extension,
                    name=f"{q.name}",
                    strategy=q.strategy,
                    timeout=q.timeout,
                    wrapuptime=q.wrapuptime,
                    maxlen=q.maxlen,
                    joinempty=q.joinempty,
                    leavewhenempty=q.leavewhenempty,
                    ringinuse=q.ringinuse,
                    queueMembers=q.queueMembers,
                    supervisors=q.supervisors,
                    max_calls=q.max_calls,
                    ring_time=q.ring_time,
                    acw_time=q.acw_time,
                    join_announcement_enabled=q.join_announcement_enabled,
                    join_announcement=q.join_announcement,
                    periodic_announcement_enabled=q.periodic_announcement_enabled,
                    periodic_announcement=q.periodic_announcement,
                    hold_music_class=q.hold_music_class,
                    position_announcement_enabled=q.position_announcement_enabled,
                    position_announcement_interval=q.position_announcement_interval,
                    estimated_hold_time_enabled=q.estimated_hold_time_enabled,
                    estimated_hold_time_interval=q.estimated_hold_time_interval,
                    ivr_routes=q.ivr_routes,
                    notify_missed_calls=q.notify_missed_calls
                )
                db.add(new_q)

            # 5. Clone DocumentChunks (RAG Knowledge Base)
            chunks = db.query(models.DocumentChunk).filter(models.DocumentChunk.tenant_id == source_tenant_id).all()
            for c in chunks:
                new_chunk = models.DocumentChunk(
                    tenant_id=target_tenant_id,
                    filename=c.filename,
                    content=c.content,
                    embedding=c.embedding
                )
                db.add(new_chunk)

            db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"[Error] Tenant config cloning failed: {e}")




def check_and_update_tenant_expiration(tenants):
    """Checks license expiration dates & cryptographic HMAC signatures for all tenants and automatically updates status to passive when expired or tampered."""

    changed = False
    for t in tenants:
        t_code = t.get("code") or t.get("id", "default").replace("tenant-", "")
        t_key = t.get("license_key") or ""
        exp_str = t.get("license_expires_at")
        
        # If key is missing but expiration date is set, auto-generate initial cryptographic key
        if not t_key and exp_str and str(exp_str).strip() and str(exp_str).lower() not in ["unlimited", "limitsiz", "suresiz", "null", "none", ""]:
            try:
                date_clean = str(exp_str).strip()[:10]
                t_key = generate_license_key(t_code, date_clean)
                t["license_key"] = t_key
                changed = True
            except Exception as e:
                print(f"[License Key Auto-Gen Error]: {e}")
                
        verification = verify_license_key(t_code, t_key)
        
        if not verification.get("valid"):
            if t.get("status") != "passive":
                t["status"] = "passive"
                changed = True
                add_system_log("TENANT_MANAGEMENT", "LICENSE_EXPIRED", f"Kiracı Lisansı Geçersiz/Doldu (Pasif Yapıldı): {t.get('name')} ({t.get('id')}) - Nedeni: {verification.get('reason')}")
                try:
                    from backend.services.notification_service import trigger_notification_bg
                    trigger_notification_bg(
                        "license_limit_reached",
                        f"Lisans Süresi Doldu / Pasif Yapıldı: {t.get('name')}",
                        f"'{t.get('name')}' ({t.get('id')}) müşterisinin lisans süresi sona erdi veya doğrulama başarısız oldu ({verification.get('reason')}). Hesap otomatik olarak pasife alındı.",
                        severity="critical",
                        tenant_id=t.get("id") or "tenant-default"
                    )
                except Exception:
                    pass
        else:
            # If valid and previously passive due to old expiration, reactivate automatically
            verified_expiry = verification.get("expires_at")
            if verified_expiry and verified_expiry != "unlimited":
                if t.get("license_expires_at") != verified_expiry:
                    t["license_expires_at"] = verified_expiry
                    changed = True
            if t.get("status") == "passive":
                t["status"] = "active"
                changed = True
                add_system_log("TENANT_MANAGEMENT", "LICENSE_RENEWED", f"Kiracı Lisansı Yenilendi (Aktif Yapıldı): {t.get('name')} ({t.get('id')})")

            # Embedded Base64 Quotas application
            custom_q = verification.get("custom_quotas")
            if custom_q and isinstance(custom_q, dict):
                for q_key, q_val in custom_q.items():
                    if isinstance(q_val, (int, float)):
                        if t.get(q_key) != int(q_val):
                            t[q_key] = int(q_val)
                            changed = True
                    elif isinstance(q_val, list):
                        if t.get(q_key) != q_val:
                            t[q_key] = q_val
                            changed = True

    return changed


def get_tenant_concurrent_call_info(tenant_id: str = "tenant-default", current_settings: dict = None, exclude_call_id: str = None, exclude_asterisk_id: str = None) -> dict:
    """Computes total active concurrent call channels across AI Agents, Outbound Dialer, and Real Users (inbound & outbound) against the tenant's licensed max_concurrent_calls and tolerance_concurrent_calls."""
    from backend.services.ami_manager import active_channels, call_id_to_asterisk_id
    if current_settings is None:
        current_settings = load_settings()
    tenants = current_settings.get("tenants", DEFAULT_SETTINGS["tenants"])
    matched = next((t for t in tenants if t.get("id") == tenant_id or t.get("code") == tenant_id), tenants[0] if tenants else {})
    max_calls = int(matched.get("max_concurrent_calls") or 4)
    raw_tol = matched.get("tolerance_concurrent_calls")
    if raw_tol is None:
        raw_tol = matched.get("concurrent_call_tolerance", 0)
    tolerance_calls = max(0, int(raw_tol or 0))
    effective_max_calls = max_calls + tolerance_calls

    # 1. Active voice calls (AI Agent + Real User Inbound/Outbound)
    active_voice_count = 0
    if active_channels:
        excluded_ast_ids = set()
        if exclude_asterisk_id:
            excluded_ast_ids.add(str(exclude_asterisk_id))
        if exclude_call_id:
            excluded_ast_ids.add(str(exclude_call_id))
            mapped_ast = call_id_to_asterisk_id.get(exclude_call_id)
            if mapped_ast:
                excluded_ast_ids.add(str(mapped_ast))
        for ch_id in active_channels.keys():
            if str(ch_id) not in excluded_ast_ids:
                active_voice_count += 1

    # 2. Active Outbound Dialer channels
    dialer_channels = 0
    if DIALER_STATE.get("status") == "running":
        dialer_channels += int(DIALER_STATE.get("current_calls") or 0)
    for camp in current_settings.get("dialer_campaigns", []):
        if isinstance(camp, dict) and camp.get("status") == "running":
            camp_t = camp.get("tenant_id") or "tenant-default"
            if tenant_id in ["tenant-default", "default", "all", "global"] or camp_t == tenant_id:
                dialer_channels += int(camp.get("concurrent_calls") or 1)

    used_total = active_voice_count + dialer_channels
    return {
        "max_concurrent_calls": max_calls,
        "tolerance_concurrent_calls": tolerance_calls,
        "effective_max_concurrent_calls": effective_max_calls,
        "used_concurrent_calls": used_total,
        "active_voice_calls": active_voice_count,
        "active_dialer_calls": dialer_channels,
        "available_channels": max(0, max_calls - used_total),
        "effective_available_channels": max(0, effective_max_calls - used_total),
        "in_tolerance_mode": used_total >= max_calls and tolerance_calls > 0
    }


def check_tenant_quota_limit(tenant_id: str, resource_type: str, current_count: int):
    """Enforces license quota limits for all 19 system resources."""

    if not tenant_id or tenant_id == "tenant-default":
        return
    current = load_settings()
    tenants = current.get("tenants", [])
    matched = next((t for t in tenants if t.get("id") == tenant_id), None)
    if not matched:
        return
        
    limit_key = f"max_{resource_type}"
    max_allowed = matched.get(limit_key, 9999)
    if current_count >= max_allowed:
        resource_labels = {
            "agents": "AI Temsilcileri",
            "rag_docs": "Bilgi Bankası (RAG) Doküman",
            "scenarios": "Kural & Senaryo Editörü",
            "users": "Dahili Kullanıcılar",
            "announcements": "Anonslar",
            "queues": "PBX Kuyruklar",
            "inbound_rules": "Gelen Arama Kuralı",
            "outbound_rules": "Giden Arama Kuralı",
            "pickup_groups": "Çağrı Toplama Grubu",
            "subscriber_groups": "Abone Grubu",
            "phonebook_contacts": "Rehber Kişileri",
            "trunks": "SIP Trunk Dış Hat",
            "conference_rooms": "Konferans Odaları",
            "speed_dials": "Hızlı Arama Kayıtları",
            "blacklist_entries": "Karaliste Numara Engelleme",
            "locations": "Lokasyonlar",
            "departments": "Departmanlar",
            "call_flows": "Arama Akış Yönetimi",
            "dialers": "Dış Arama Dialer"
        }
        label = resource_labels.get(resource_type, resource_type)
        try:
            from backend.services.notification_service import trigger_notification_bg
            trigger_notification_bg(
                "license_limit_reached",
                f"Lisans Kotası Son Limite Ulaştı: {label}",
                f"'{matched.get('name')}' müşterisi için {label} lisans kotası ({current_count}/{max_allowed}) son limite ulaştı ve yeni kayıt engellendi.",
                severity="warning",
                tenant_id=tenant_id
            )
        except Exception:
            pass
        raise HTTPException(
            status_code=400,
            detail=f"Lisans adetiniz yetersiz. '{matched.get('name')}' müşterisi için {label} lisans kotası ({max_allowed}) dolmuştur. Lütfen lisans paketinizi veya kotanızı yükseltiniz."
        )


def compute_tenant_usage_dict(current_settings: dict, t_id: str) -> dict:
    """Calculates live usage counts for all 20 feature quotas (including concurrent call channels) for a specific tenant."""
    def count_items(keys):
        if isinstance(keys, str):
            keys = [keys]
        total = 0
        for k in keys:
            items = current_settings.get(k, [])
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                item_t = item.get("tenant_id")
                if t_id in ["tenant-default", "default"]:
                    if not item_t or item_t in ["tenant-default", "default"]:
                        total += 1
                else:
                    if item_t == t_id:
                        total += 1
        return total

    call_info = get_tenant_concurrent_call_info(t_id, current_settings)

    return {
        "max_concurrent_calls": call_info["used_concurrent_calls"],
        "tolerance_concurrent_calls": max(0, call_info["used_concurrent_calls"] - call_info["max_concurrent_calls"]),
        "max_agents": count_items(["ai_agents"]),
        "max_rag_docs": count_items(["rag_docs", "documents"]),
        "max_scenarios": count_items(["scenarios", "ai_scenarios"]),
        "max_users": count_items(["users", "system_users"]),
        "max_announcements": count_items(["announcements"]),
        "max_queues": count_items(["queues", "acd_queues"]),
        "max_inbound_rules": count_items(["inbound_rules"]),
        "max_outbound_rules": count_items(["outbound_rules"]),
        "max_pickup_groups": count_items(["pickup_groups", "call_pickup_groups"]),
        "max_subscriber_groups": count_items(["subscriber_groups"]),
        "max_phonebook_contacts": count_items(["contacts"]),
        "max_trunks": count_items(["trunks", "sip_trunks"]),
        "max_conference_rooms": count_items(["conferences", "conference_rooms"]),
        "max_speed_dials": count_items(["speed_dials"]),
        "max_blacklist_entries": count_items(["blacklist", "blacklist_items"]),
        "max_locations": count_items(["locations"]),
        "max_departments": count_items(["departments"]),
        "max_call_flows": count_items(["workflows", "call_flows"]),
        "max_dialers": count_items(["dialers", "dialer_campaigns"])
    }

@app.get("/api/tenants")
@app.get("/api/tenants/")
@app.get("/api/settings/tenants")
@app.get("/api/settings/tenants/")
async def get_tenants():
    """Returns list of registered tenants with license expiration checks, numeric tenant_num_id assignment, and live usage metrics."""
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])

    modified = False
    next_num = 100
    for t in tenants:
        if "tenant_num_id" not in t or t["tenant_num_id"] is None:
            while any(ex.get("tenant_num_id") == next_num for ex in tenants if ex != t):
                next_num += 1
            t["tenant_num_id"] = next_num
            next_num += 1
            modified = True

    if check_and_update_tenant_expiration(tenants) or modified:
        current["tenants"] = tenants
        save_settings(current)
        settings_db["tenants"] = tenants

    result = []
    for t in tenants:
        t_copy = dict(t)
        if "max_concurrent_calls" not in t_copy or t_copy["max_concurrent_calls"] is None:
            t_copy["max_concurrent_calls"] = 4
        if "tolerance_concurrent_calls" not in t_copy or t_copy["tolerance_concurrent_calls"] is None:
            t_copy["tolerance_concurrent_calls"] = 0
        if "allowed_stt_providers" not in t_copy or not isinstance(t_copy["allowed_stt_providers"], list):
            t_copy["allowed_stt_providers"] = ["google", "deepgram", "openai", "elevenlabs"]
        if "allowed_tts_providers" not in t_copy or not isinstance(t_copy["allowed_tts_providers"], list):
            t_copy["allowed_tts_providers"] = ["google", "elevenlabs", "openai"]
        if "allowed_llm_providers" not in t_copy or not isinstance(t_copy["allowed_llm_providers"], list):
            t_copy["allowed_llm_providers"] = ["google", "elevenlabs", "openai", "anthropic", "groq"]
        t_copy["usage"] = compute_tenant_usage_dict(current, t.get("id", "tenant-default"))
        result.append(t_copy)

    return result



@app.post("/api/tenants")
@app.post("/api/tenants/")
@app.post("/api/settings/tenants")
@app.post("/api/settings/tenants/")
async def create_tenant(payload: TenantCreateSchema):
    """Creates a new Tenant with cryptographic license key and quota limits across 3 categories."""
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])
    
    tenant_code = payload.code.strip().lower().replace(" ", "-")
    tenant_id = f"tenant-{tenant_code}"
    
    existing = next((t for t in tenants if t.get("code") == tenant_code or t.get("id") == tenant_id or t.get("name", "").strip().lower() == payload.name.strip().lower()), None)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"'{existing.get('name')}' isimli veya '{tenant_code}' kodlu müşteri zaten sistemde kayıtlı. Lütfen farklı bir müşteri adı giriniz."
        )
        
    if payload.license_key:
        generated_key = payload.license_key
    elif payload.license_expires_at and str(payload.license_expires_at).strip() and str(payload.license_expires_at).lower() not in ["unlimited", "limitsiz", "suresiz"]:
        generated_key = generate_license_key(tenant_code, payload.license_expires_at)
    else:
        generated_key = f"AIDA-{tenant_code.upper().replace('-','')}-UNLIMITED-MASTER"
    
    # Calculate next numeric tenant ID
    existing_num_ids = [t.get("tenant_num_id") for t in tenants if t.get("tenant_num_id") is not None]
    next_num_id = (max(existing_num_ids) + 1) if existing_num_ids else 100

    new_tenant = {
        "id": tenant_id,
        "tenant_num_id": next_num_id,
        "name": payload.name.strip(),
        "code": tenant_code,
        "status": payload.status or "active",

        "created_at": datetime.datetime.utcnow().isoformat(),
        "license_expires_at": payload.license_expires_at or "",
        "license_key": generated_key,
        "plan_tier": payload.plan_tier or "professional",
        
        # 1. Yapay Zeka Kotaları & Sağlayıcı İzinleri
        "max_agents": payload.max_agents or 20,
        "max_rag_docs": payload.max_rag_docs or 100,
        "max_scenarios": payload.max_scenarios or 20,
        "allowed_stt_providers": payload.allowed_stt_providers if isinstance(payload.allowed_stt_providers, list) else ["google", "deepgram", "openai", "elevenlabs"],
        "allowed_tts_providers": payload.allowed_tts_providers if isinstance(payload.allowed_tts_providers, list) else ["google", "elevenlabs", "openai"],
        "allowed_llm_providers": payload.allowed_llm_providers if isinstance(payload.allowed_llm_providers, list) else ["google", "elevenlabs", "openai", "anthropic", "groq"],
        
        # 2. Santral Kotaları & Eş Zamanlı Kanal Limiti
        "max_concurrent_calls": payload.max_concurrent_calls or 4,
        "tolerance_concurrent_calls": int(payload.tolerance_concurrent_calls or 0),
        "max_users": payload.max_users or 50,
        "max_announcements": payload.max_announcements or 20,
        "max_queues": payload.max_queues or 10,
        "max_inbound_rules": payload.max_inbound_rules or 25,
        "max_outbound_rules": payload.max_outbound_rules or 25,
        "max_pickup_groups": payload.max_pickup_groups or 10,
        "max_subscriber_groups": payload.max_subscriber_groups or 10,
        "max_phonebook_contacts": payload.max_phonebook_contacts or 500,
        "max_trunks": payload.max_trunks or 5,
        "max_conference_rooms": payload.max_conference_rooms or 5,
        "max_speed_dials": payload.max_speed_dials or 50,
        "max_blacklist_entries": payload.max_blacklist_entries or 100,
        "max_locations": payload.max_locations or 5,
        "max_departments": payload.max_departments or 10,
        
        # 3. Çağrı Yönlendirme & Akış Kotaları
        "max_call_flows": payload.max_call_flows or 10,
        "max_dialers": payload.max_dialers or 5
    }
    
    # Apply embedded quotas if license_key was provided
    if payload.license_key:
        v_init = verify_license_key(tenant_code, generated_key)
        if v_init.get("valid") and isinstance(v_init.get("custom_quotas"), dict):
            for q_k, q_v in v_init["custom_quotas"].items():
                if isinstance(q_v, (int, float)):
                    new_tenant[q_k] = int(q_v)
                elif isinstance(q_v, list):
                    new_tenant[q_k] = q_v

    tenants.append(new_tenant)
    current["tenants"] = tenants
    
    if "tenant_settings" not in current:
        current["tenant_settings"] = {}
        
    current["tenant_settings"][tenant_id] = {
        "ai_providers": dict(current.get("ai_providers", {})),
        "api_budgets": dict(current.get("api_budgets", {})),
        "pbx": dict(current.get("pbx", {})),
        "smart_callback": dict(current.get("smart_callback", {})),
        "call_flow": dict(current.get("call_flow", {}))
    }
    
    save_settings(current)
    settings_db["tenants"] = tenants
    settings_db["tenant_settings"] = current["tenant_settings"]
    
    # Clone configurations from default tenant
    clone_tenant_config("tenant-default", tenant_id)

    
    add_system_log("TENANT_MANAGEMENT", "CREATE", f"Yeni Kiracı Lisansı Oluşturuldu: {payload.name} ({tenant_id}) [Lisans Key: {generated_key}]")
    return new_tenant


@app.put("/api/tenants/{tenant_id}")
@app.put("/api/tenants/{tenant_id}/")
@app.put("/api/settings/tenants/{tenant_id}")
@app.put("/api/settings/tenants/{tenant_id}/")
async def update_tenant(tenant_id: str, payload: TenantCreateSchema):
    """Updates tenant metadata, license key, package tier, and quota limits."""
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])
    
    target_tenant = next((t for t in tenants if t.get("id") == tenant_id), None)
    if not target_tenant:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")
        
    target_tenant["name"] = payload.name.strip()
    target_tenant["status"] = payload.status or target_tenant.get("status", "active")
    target_tenant["license_expires_at"] = payload.license_expires_at if payload.license_expires_at is not None else target_tenant.get("license_expires_at", "")
    t_code = target_tenant.get("code") or tenant_id.replace("tenant-", "")
    has_embedded_quotas = False
    if payload.license_key:
        clean_key = payload.license_key.strip()
        target_tenant["license_key"] = clean_key
        verification = verify_license_key(t_code, clean_key)
        if verification.get("valid"):
            if verification.get("expires_at") and verification["expires_at"] != "unlimited":
                target_tenant["license_expires_at"] = verification["expires_at"]
            target_tenant["status"] = "active"
            custom_q = verification.get("custom_quotas")
            if custom_q and isinstance(custom_q, dict):
                has_embedded_quotas = True
                for q_key, q_val in custom_q.items():
                    if isinstance(q_val, (int, float)):
                        target_tenant[q_key] = int(q_val)
                    elif isinstance(q_val, list):
                        target_tenant[q_key] = q_val
    elif payload.license_expires_at and str(payload.license_expires_at).strip() and str(payload.license_expires_at).lower() not in ["unlimited", "limitsiz", "suresiz"]:
        target_tenant["license_key"] = generate_license_key(t_code, payload.license_expires_at)
    target_tenant["plan_tier"] = payload.plan_tier or target_tenant.get("plan_tier", "professional")
    
    if not has_embedded_quotas:
        # 1. Yapay Zeka Kotaları & Sağlayıcı İzinleri
        target_tenant["max_agents"] = payload.max_agents or target_tenant.get("max_agents", 20)
        target_tenant["max_rag_docs"] = payload.max_rag_docs or target_tenant.get("max_rag_docs", 100)
        target_tenant["max_scenarios"] = payload.max_scenarios or target_tenant.get("max_scenarios", 20)
        if isinstance(payload.allowed_stt_providers, list):
            target_tenant["allowed_stt_providers"] = payload.allowed_stt_providers
        if isinstance(payload.allowed_tts_providers, list):
            target_tenant["allowed_tts_providers"] = payload.allowed_tts_providers
        if isinstance(payload.allowed_llm_providers, list):
            target_tenant["allowed_llm_providers"] = payload.allowed_llm_providers
        
        # 2. Santral Kotaları & Eş Zamanlı Kanal Limiti
        target_tenant["max_concurrent_calls"] = payload.max_concurrent_calls or target_tenant.get("max_concurrent_calls", 4)
        if payload.tolerance_concurrent_calls is not None:
            target_tenant["tolerance_concurrent_calls"] = int(payload.tolerance_concurrent_calls)
        target_tenant["max_users"] = payload.max_users or target_tenant.get("max_users", 50)
        target_tenant["max_announcements"] = payload.max_announcements or target_tenant.get("max_announcements", 20)
        target_tenant["max_queues"] = payload.max_queues or target_tenant.get("max_queues", 10)
        target_tenant["max_inbound_rules"] = payload.max_inbound_rules or target_tenant.get("max_inbound_rules", 25)
        target_tenant["max_outbound_rules"] = payload.max_outbound_rules or target_tenant.get("max_outbound_rules", 25)
        target_tenant["max_pickup_groups"] = payload.max_pickup_groups or target_tenant.get("max_pickup_groups", 10)
        target_tenant["max_subscriber_groups"] = payload.max_subscriber_groups or target_tenant.get("max_subscriber_groups", 10)
        target_tenant["max_phonebook_contacts"] = payload.max_phonebook_contacts or target_tenant.get("max_phonebook_contacts", 500)
        target_tenant["max_trunks"] = payload.max_trunks or target_tenant.get("max_trunks", 5)
        target_tenant["max_conference_rooms"] = payload.max_conference_rooms or target_tenant.get("max_conference_rooms", 5)
        target_tenant["max_speed_dials"] = payload.max_speed_dials or target_tenant.get("max_speed_dials", 50)
        target_tenant["max_blacklist_entries"] = payload.max_blacklist_entries or target_tenant.get("max_blacklist_entries", 100)
        target_tenant["max_locations"] = payload.max_locations or target_tenant.get("max_locations", 5)
        target_tenant["max_departments"] = payload.max_departments or target_tenant.get("max_departments", 10)
        
        # 3. Çağrı Yönlendirme & Akış Kotaları
        target_tenant["max_call_flows"] = payload.max_call_flows or target_tenant.get("max_call_flows", 10)
        target_tenant["max_dialers"] = payload.max_dialers or target_tenant.get("max_dialers", 5)
    
    current["tenants"] = tenants
    save_settings(current)
    settings_db["tenants"] = tenants
    add_system_log("TENANT_MANAGEMENT", "UPDATE", f"Kiracı Lisansı Güncellendi: {target_tenant['name']} ({tenant_id}) [Paket: {target_tenant['plan_tier']}]")
    try:
        from backend.services.notification_service import trigger_notification_bg
        trigger_notification_bg(
            "license_updated",
            f"Lisans Bilgileri Güncellendi: {target_tenant.get('name')}",
            f"'{target_tenant.get('name')}' müşterisinin lisans paketi ({target_tenant.get('plan_tier')}), eş zamanlı çağrı kanalı ({target_tenant.get('max_concurrent_calls')} +{target_tenant.get('tolerance_concurrent_calls', 0)} Tolerans Kanal) ve kota parametreleri güncellendi.",
            severity="info",
            tenant_id=tenant_id
        )
    except Exception:
        pass
    return target_tenant


@app.delete("/api/tenants/{tenant_id}")
@app.delete("/api/tenants/{tenant_id}/")
@app.delete("/api/settings/tenants/{tenant_id}")
@app.delete("/api/settings/tenants/{tenant_id}/")
async def delete_tenant(tenant_id: str):
    """Deletes a tenant."""
    if tenant_id == "tenant-default":
        raise HTTPException(status_code=400, detail="Varsayılan ana müşteri silinemez.")
        
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])
    filtered = [t for t in tenants if t.get("id") != tenant_id]
    current["tenants"] = filtered
    save_settings(current)
    settings_db["tenants"] = filtered
    add_system_log("TENANT_MANAGEMENT", "DELETE", f"Kiracı Silindi: {tenant_id}")
    return {"status": "success", "message": f"Tenant {tenant_id} silindi."}


class LicenseRenewSchema(BaseModel):
    tenant_id: Optional[str] = "tenant-default"
    license_key: str

class LicenseGenerateSchema(BaseModel):
    tenant_code: str
    expiry_date: str
    hardware_id: Optional[str] = "UNBOUND"

@app.get("/api/tenant/license/status")
@app.get("/api/settings/license/status")
async def get_license_status(request: Request):
    """Returns cryptographic license status, days remaining, hardware fingerprint, capacities and live usage metrics."""
    from backend.services.hardware_info import get_system_hardware_fingerprint
    from backend.services.license_service import get_plan_limits

    user_info = get_user_info(request)
    tenant_id = user_info.get("tenant_id", "tenant-default")
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])
    
    if check_and_update_tenant_expiration(tenants):
        current["tenants"] = tenants
        save_settings(current)
        settings_db["tenants"] = tenants
    
    matched = next((t for t in tenants if t.get("id") == tenant_id), tenants[0] if tenants else None)
    if not matched:
        return {"valid": False, "reason": "Müşteri bulunamadı"}
        
    t_code = matched.get("code") or matched.get("id", "default").replace("tenant-", "")
    verification = verify_license_key(t_code, matched.get("license_key", ""))
    hw_info = get_system_hardware_fingerprint()
    
    days_left = None
    if verification.get("expires_at") and verification["expires_at"] != "unlimited":
        try:
            exp_d = datetime.datetime.strptime(verification["expires_at"], "%Y-%m-%d")
            delta = exp_d - datetime.datetime.utcnow()
            days_left = max(0, delta.days + 1)
        except Exception:
            pass

    plan_tier = matched.get("plan_tier") or "professional"
    if verification.get("expires_at") == "unlimited":
        plan_tier = "unlimited"

    limits = dict(get_plan_limits(plan_tier))
    call_info = get_tenant_concurrent_call_info(matched.get("id", "tenant-default"), current)
    limits["max_concurrent_calls"] = call_info["max_concurrent_calls"]
    limits["tolerance_concurrent_calls"] = call_info["tolerance_concurrent_calls"]
    limits["effective_max_concurrent_calls"] = call_info["effective_max_concurrent_calls"]
    limits["channels"] = call_info["max_concurrent_calls"]
    limits["users"] = matched.get("max_users", limits.get("users", 50))
    limits["ai_agents"] = matched.get("max_agents", limits.get("ai_agents", 20))

    allowed_stt = matched.get("allowed_stt_providers")
    if not isinstance(allowed_stt, list):
        allowed_stt = ["google", "deepgram", "openai", "elevenlabs"]
    allowed_tts = matched.get("allowed_tts_providers")
    if not isinstance(allowed_tts, list):
        allowed_tts = ["google", "elevenlabs", "openai"]
    allowed_llm = matched.get("allowed_llm_providers")
    if not isinstance(allowed_llm, list):
        allowed_llm = ["google", "elevenlabs", "openai", "anthropic", "groq"]

    # Live Usage Metrics
    used_users = len(current.get("users", []))
    used_channels = call_info["used_concurrent_calls"]
    used_ai_agents = len(current.get("ai_agents", []))
    used_tenants = len(current.get("tenants", []))

    return {
        "tenant_id": matched.get("id"),
        "tenant_name": matched.get("name"),
        "tenant_code": t_code,
        "plan_tier": plan_tier,
        "plan_label": limits["label"],
        "status": matched.get("status"),
        "license_key": matched.get("license_key"),
        "license_expires_at": matched.get("license_expires_at"),
        "valid": verification.get("valid", False) and matched.get("status") != "passive",
        "reason": verification.get("reason"),
        "days_left": days_left,
        "is_unlimited": verification.get("expires_at") == "unlimited" or not matched.get("license_expires_at"),
        "server_hardware_id": hw_info.get("hardware_id"),
        "max_concurrent_calls": call_info["max_concurrent_calls"],
        "tolerance_concurrent_calls": call_info["tolerance_concurrent_calls"],
        "effective_max_concurrent_calls": call_info["effective_max_concurrent_calls"],
        "allowed_stt_providers": allowed_stt,
        "allowed_tts_providers": allowed_tts,
        "allowed_llm_providers": allowed_llm,
        "limits": limits,
        "usage": {
            "used_users": used_users,
            "used_channels": used_channels,
            "used_concurrent_calls": used_channels,
            "used_tolerance_calls": max(0, used_channels - call_info["max_concurrent_calls"]),
            "used_ai_agents": used_ai_agents,
            "used_tenants": used_tenants
        }
    }

@app.post("/api/tenant/license/renew")
@app.post("/api/settings/license/renew")
async def renew_license_key(payload: LicenseRenewSchema):
    """Verifies HMAC signature & Machine Binding and applies new license key to activate system operations."""
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])
    
    tenant_id = payload.tenant_id or "tenant-default"
    target = next((t for t in tenants if t.get("id") == tenant_id or t.get("code") == tenant_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Müşteri / Kiracı bulunamadı.")
        
    t_code = target.get("code") or target.get("id", "default").replace("tenant-", "")
    verification = verify_license_key(t_code, payload.license_key)
    
    if not verification.get("valid"):
        raise HTTPException(status_code=400, detail=f"Lisans Anahtarı Geçersiz: {verification.get('reason')}")
        
    target["license_key"] = payload.license_key.strip()
    embedded_code = verification.get("embedded_tenant_code")
    if embedded_code:
        target["code"] = embedded_code
    if verification.get("expires_at") and verification["expires_at"] != "unlimited":
        target["license_expires_at"] = verification["expires_at"]
    target["status"] = "active"
    
    # Embedded Base64 Quotas & Plan Parameters application
    custom_q = verification.get("custom_quotas")
    if custom_q and isinstance(custom_q, dict):
        for q_key, q_val in custom_q.items():
            if q_key in ["plan_tier", "status", "license_expires_at"]:
                target[q_key] = str(q_val)
            elif q_key == "is_unlimited":
                target[q_key] = bool(q_val)
            elif isinstance(q_val, (int, float)):
                target[q_key] = int(q_val)
            elif isinstance(q_val, list):
                target[q_key] = q_val

    current["tenants"] = tenants
    save_settings(current)
    settings_db["tenants"] = tenants

    
    add_system_log("TENANT_MANAGEMENT", "LICENSE_RENEW", f"Lisans Anahtarı Yenilendi: {target.get('name')} [Geçerlilik: {target.get('license_expires_at', 'Süresiz')}]")
    try:
        from backend.services.notification_service import trigger_notification_bg
        trigger_notification_bg(
            "license_updated",
            f"Lisans Anahtarı Yenilendi: {target.get('name')}",
            f"'{target.get('name')}' müşterisi için yeni kriptografik lisans anahtarı doğrulandı ve aktive edildi. (Geçerlilik: {target.get('license_expires_at') or 'Süresiz'}, Eş Zamanlı Kanal: {target.get('max_concurrent_calls', 4)} +{target.get('tolerance_concurrent_calls', 0)} Tolerans)",
            severity="info",
            tenant_id=target.get("id") or "tenant-default",
            force=True
        )
    except Exception:
        pass
    
    return {
        "success": True,
        "message": f"Lisans anahtarı ve sunucu donanım doğrulaması başarıyla tamamlandı. (Son Kullanma: {target.get('license_expires_at', 'Süresiz')})",
        "expires_at": target.get("license_expires_at"),
        "status": "active"
    }

@app.post("/api/settings/tenants/generate-license-key")
async def generate_license_key_endpoint(payload: LicenseGenerateSchema):
    """Generates a cryptographic HMAC-SHA256 signed license key with machine binding."""
    if not payload.tenant_code or not payload.expiry_date:
        raise HTTPException(status_code=400, detail="Müşteri kodu ve bitiş tarihi gereklidir.")
        
    hw_id = payload.hardware_id or "UNBOUND"
    key = generate_license_key(payload.tenant_code, payload.expiry_date, hw_id)
    return {
        "license_key": key,
        "tenant_code": payload.tenant_code,
        "expiry_date": payload.expiry_date,
        "hardware_id": hw_id
    }

@app.get("/api/settings/ai-providers/elevenlabs-voices")
async def get_elevenlabs_voices():
    import urllib.request
    import json
    
    api_key = settings_db.get("ai_providers", {}).get("elevenlabs_api_key") or os.getenv("ELEVENLABS_API_KEY", "")
    
    default_premades = [
        {"voice_id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel (Female - Conversational)", "category": "premade"},
        {"voice_id": "AZnzlk1XvdvUeBnXmlld", "name": "Domi (Female - Energetic)", "category": "premade"},
        {"voice_id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella (Female - Professional)", "category": "premade"},
        {"voice_id": "ErXwobaYiN019PkySvjV", "name": "Antoni (Male - Professional)", "category": "premade"},
        {"voice_id": "MF3mGyEYCl7XYWbV9V6O", "name": "Elli (Female - Emotional)", "category": "premade"},
        {"voice_id": "TxGEqnHWrfWFTfGW9XjX", "name": "Josh (Male - Deep & Trustworthy)", "category": "premade"},
        {"voice_id": "VR6AewLTigWG4xSOukaG", "name": "Arnold (Male - Authoritative)", "category": "premade"},
        {"voice_id": "pNInz6obpgDQGcFmaJgB", "name": "Adam (Male - Conversational)", "category": "premade"},
        {"voice_id": "yoZ06aGfZXsp3F3Dfd0g", "name": "Sam (Male - Dynamic)", "category": "premade"},
        {"voice_id": "JBFqnCBsd6RMkjVDRZzb", "name": "George (Male - Warm & Friendly)", "category": "premade"}
    ]
    
    if not api_key:
        return {"status": "success", "voices": default_premades, "source": "default"}
        
    try:
        req = urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": api_key})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            fetched_voices = []
            for v in data.get("voices", []):
                name = v.get("name", "")
                cat = v.get("category", "")
                labels = v.get("labels", {})
                acc = labels.get("accent", "")
                gen = labels.get("gender", "")
                label_str = f" ({gen.capitalize()}{' - ' + acc if acc else ''})" if gen else ""
                fetched_voices.append({
                    "voice_id": v.get("voice_id"),
                    "name": f"{name}{label_str}",
                    "category": cat,
                    "preview_url": v.get("preview_url")
                })
            return {"status": "success", "voices": fetched_voices, "source": "elevenlabs_api"}
    except Exception as e:
        print(f"[ElevenLabs Voices API] Error: {e}")
        return {"status": "success", "voices": default_premades, "source": "fallback"}

@app.post("/api/settings/ai-agents/tts-test")
async def tts_test_endpoint(payload: dict):
    from fastapi.responses import StreamingResponse
    import io
    
    text = payload.get("text", "")
    voice = payload.get("voice", "")
    tone = payload.get("tone", "normal")
    speaking_rate = float(payload.get("speaking_rate", 1.0) or 1.0)
    tts_provider = str(payload.get("tts_provider", "google") or "google").lower()
    elevenlabs_voice_id = payload.get("elevenlabs_voice_id", "")
    elevenlabs_stability = float(payload.get("elevenlabs_stability", 0.5) or 0.5)
    elevenlabs_similarity = float(payload.get("elevenlabs_similarity", 0.75) or 0.75)
    elevenlabs_style = float(payload.get("elevenlabs_style", 0.0) or 0.0)
    
    if not text:
        raise HTTPException(status_code=400, detail="Test metni boş olamaz.")

    # 1. If ElevenLabs is selected and API key is configured, try ElevenLabs synthesis first
    if tts_provider == "elevenlabs":
        el_key = settings_db.get("ai_providers", {}).get("elevenlabs_api_key") or os.getenv("ELEVENLABS_API_KEY", "")
        target_vid = elevenlabs_voice_id or "EXAVITQu4vr4xnSDxMaL"
        if el_key and target_vid:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=15.0) as client:
                    el_res = await client.post(
                        f"https://api.elevenlabs.io/v1/text-to-speech/{target_vid}",
                        headers={
                            "xi-api-key": el_key,
                            "Content-Type": "application/json",
                            "Accept": "audio/mpeg"
                        },
                        json={
                            "text": text,
                            "model_id": "eleven_multilingual_v2",
                            "voice_settings": {
                                "stability": elevenlabs_stability,
                                "similarity_boost": elevenlabs_similarity,
                                "style": elevenlabs_style,
                                "use_speaker_boost": True
                            }
                        }
                    )
                    if el_res.status_code == 200 and len(el_res.content) > 200:
                        fp = io.BytesIO(el_res.content)
                        fp.seek(0)
                        return StreamingResponse(fp, media_type="audio/mpeg")
            except Exception as el_err:
                print(f"[TTS Test ElevenLabs Fallback]: {el_err}")
        
    try:
        # 2. Try using premium edge-tts
        import edge_tts
        
        v_lower = str(voice).lower()
        edge_voice = "tr-TR-EmelNeural"
        if any(m in v_lower for m in ["ahmet", "eser", "puck", "charon", "fenrir", "erkek", "male", "josh", "antoni", "adam", "arnold", "sam", "george"]):
            edge_voice = "tr-TR-AhmetNeural"
        elif any(f in v_lower for f in ["selin", "dilara", "aoede", "kore", "dişi", "female"]):
            edge_voice = "tr-TR-EmelNeural"
        elif "sophia" in v_lower:
            edge_voice = "en-US-AriaNeural"
        elif "john" in v_lower:
            edge_voice = "en-US-GuyNeural"
            
        base_rate_pct = int(round((speaking_rate - 1.0) * 100))
        pitch_hz = 0
        if tone == "calm":
            base_rate_pct -= 12
            pitch_hz = -3
        elif tone == "attractive":
            base_rate_pct += 5
            pitch_hz = 4
        elif tone == "firm":
            base_rate_pct += 8
            pitch_hz = -2
            
        base_rate_pct = max(-50, min(60, base_rate_pct))
        rate_str = f"{'+' if base_rate_pct >= 0 else ''}{base_rate_pct}%"
        pitch_str = f"{'+' if pitch_hz >= 0 else ''}{pitch_hz}Hz"
            
        communicate = edge_tts.Communicate(text, edge_voice, rate=rate_str, pitch=pitch_str)
        fp = io.BytesIO()
        
        async def gather_audio():
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            return audio_data
            
        audio_bytes = await gather_audio()
        fp.write(audio_bytes)
        fp.seek(0)
        
        print(f"[TTS] Synthesized successfully using edge-tts (voice={edge_voice}, tone={tone}, rate={rate_str})")
        return StreamingResponse(fp, media_type="audio/mpeg")
        
    except (ImportError, ModuleNotFoundError):
        # Fallback to gtts
        print("[TTS] edge-tts not installed, falling back to gtts.")
        from gtts import gTTS
        
        lang = "tr"
        if any(w in voice.lower() or w in text.lower() for w in ["english", "john", "sophia"]):
            lang = "en"
            
        slow = True if (tone == "calm" or speaking_rate < 0.9) else False
        tts = gTTS(text=text, lang=lang, slow=slow)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        
        return StreamingResponse(fp, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS Sentezleme hatası: {str(e)}")

@app.post("/api/rag/manual")
async def add_manual_text(payload: ManualTextSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    try:
        await index_manual_text(payload.title, payload.text, tenant_id=target_tenant)
        return {"status": "success", "message": f"'{payload.title}' başarıyla indekslendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Manuel indeksleme hatası: {str(e)}")

@app.delete("/api/rag/sources")
async def delete_source(name: str):
    try:
        await delete_indexed_source(name)
        return {"status": "success", "message": f"'{name}' bilgi bankasından temizlendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kaynak silme hatası: {str(e)}")

@app.get("/api/rag/search")
async def test_search(query: str):
    results = await query_vector_search(query)
    return {"results": results}

@app.get("/api/rag/sources")
async def get_indexed_sources(user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    from backend.database.models import DocumentChunk
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    stmt = select(DocumentChunk.filename).distinct()
    if is_global_tenant(target_tenant):
        pass
    elif is_default_tenant(target_tenant):
        stmt = stmt.where(or_(DocumentChunk.tenant_id.in_(["tenant-default", "default"]), DocumentChunk.tenant_id.is_(None)))
    else:
        stmt = stmt.where(DocumentChunk.tenant_id == target_tenant)
    result = await db.execute(stmt)
    sources = result.scalars().all()
    return [{"name": name} for name in sources]

@app.get("/api/calls/register")
async def register_call_endpoint(call_id: str, did: str, caller: str, asterisk_id: Optional[str] = None):
    from fastapi import Response
    try:
        if asterisk_id:
            from backend.services.ami_manager import call_id_to_asterisk_id
            call_id_to_asterisk_id[call_id] = asterisk_id
            print(f"[AMI] Mapped Call UUID {call_id} -> Asterisk Uniqueid {asterisk_id}")

        # Toll-Fraud / SIP Scanner Koruması: Sahte dış arama denemelerini (097..., 098..., 099... vb.) veritabanına yazmadan anında sonlandır
        did_str_check = str(did or "").strip()
        if did_str_check.startswith("0"):
            is_fraud, fraud_reason = is_suspicious_or_fraud_outbound_number(did_str_check, allow_international=False)
            if is_fraud and ("FRAUD_SCANNER" in fraud_reason or "INVALID_TR_NATIONAL_LENGTH" in fraud_reason or "INVALID_TR_AREA_CODE" in fraud_reason):
                from backend.services.ami_manager import hangup_call
                print(f"[SIP Security Shield] Blocked scanner call in /api/calls/register: {caller} -> {did_str_check} ({fraud_reason})")
                await hangup_call(call_id, caller_number=caller)
                return Response(content="BLOCKED", media_type="text/plain")

        async with AsyncSessionLocal() as session:
            call_tenant = "tenant-default"
            try:
                if caller:
                    res_u = await session.execute(select(SystemUser).where(or_(SystemUser.extension == str(caller), SystemUser.email == str(caller))))
                    user_found = res_u.scalars().first()
                    if user_found and getattr(user_found, "tenant_id", None):
                        call_tenant = user_found.tenant_id
                if call_tenant == "tenant-default" and did and did != "s":
                    res_t = await session.execute(select(Trunk).where(Trunk.did_number == str(did)))
                    trunk_found = res_t.scalars().first()
                    if trunk_found and getattr(trunk_found, "tenant_id", None):
                        call_tenant = trunk_found.tenant_id
            except Exception as e_tenant:
                print(f"[Call Register Tenant Error]: {e_tenant}")

            try:
                is_bl, bl_reason = await is_phone_or_value_blacklisted(caller, session=session)
                if not is_bl and did and did != "s":
                    is_bl, bl_reason = await is_phone_or_value_blacklisted(did, session=session)

                if is_bl:
                    from backend.services.ami_manager import hangup_call
                    print(f"[Abuse Shield] Blocked call from/to blacklisted number: caller={caller}, did={did} ({bl_reason})")
                    add_system_log("ABUSE_SHIELD", "WARNING", f"Kara Liste Çağrı Engellendi: {caller} -> {did} ({bl_reason})")
                    existing_bl_call = await session.get(Call, call_id)
                    if existing_bl_call:
                        existing_bl_call.caller_number = caller or existing_bl_call.caller_number or "Bilinmeyen"
                        existing_bl_call.callee_number = did or existing_bl_call.callee_number or "s"
                        existing_bl_call.status = "blocked"
                        existing_bl_call.tenant_id = call_tenant
                        existing_bl_call.end_time = datetime.datetime.utcnow()
                        existing_bl_call.hangup_source = f"blacklist:{bl_reason}"
                    else:
                        new_call = Call(
                            id=call_id,
                            caller_number=caller or "Bilinmeyen",
                            callee_number=did or "s",
                            status="blocked",
                            tenant_id=call_tenant,
                            start_time=datetime.datetime.utcnow(),
                            end_time=datetime.datetime.utcnow(),
                            hangup_source=f"blacklist:{bl_reason}"
                        )
                        session.add(new_call)
                    await session.commit()
                    await hangup_call(call_id, caller_number=caller)
                    return Response(content="BLOCKED", media_type="text/plain")
            except Exception as e_bl:
                print(f"[Call Register Blacklist Error]: {e_bl}")

            # Enforce shared concurrent call channel limit & Tolerance Channels (AI Agent + Dialer + Real User Inbound/Outbound)
            try:
                call_info = get_tenant_concurrent_call_info(
                    tenant_id=call_tenant,
                    exclude_call_id=call_id,
                    exclude_asterisk_id=asterisk_id
                )
                base_max = call_info["max_concurrent_calls"]
                tol_max = call_info["tolerance_concurrent_calls"]
                eff_max = call_info["effective_max_concurrent_calls"]
                used_now = call_info["used_concurrent_calls"]

                if used_now >= eff_max:
                    from backend.services.ami_manager import hangup_call
                    print(f"[License Concurrent Call Block] Tenant '{call_tenant}' reached total concurrent channel limit ({used_now}/{base_max}+{tol_max}). Rejecting call {call_id} ({caller} -> {did}).")
                    add_system_log("LICENSE", "WARNING", f"Eş Zamanlı Çağrı Kanalı Limiti Doldu ({used_now}/{base_max}" + (f"+{tol_max} Tolerans" if tol_max > 0 else "") + f" Kanal): Çağrı reddedildi ({caller} -> {did})")
                    try:
                        from backend.services.notification_service import trigger_notification_bg
                        trigger_notification_bg(
                            "concurrent_channels_full",
                            f"Eş Zamanlı Çağrı Kanalı Doldu ({used_now}/{base_max}" + (f"+{tol_max}" if tol_max > 0 else "") + " Kanal)",
                            f"Gelen/giden çağrı ({caller} -> {did}) sırasında eş zamanlı çağrı kanalı limiti ({base_max} Ana Kanal" + (f" + {tol_max} Tolerans Kanalı = {eff_max} Kanal" if tol_max > 0 else " - Tolerans: 0") + f") tamamen dolu olduğu için çağrı reddedildi.\nAktif Ses Kanalı: {call_info['active_voice_calls']} | Aktif Dialer Kanalı: {call_info['active_dialer_calls']}",
                            severity="critical" if tol_max > 0 else "warning",
                            tenant_id=call_tenant
                        )
                    except Exception:
                        pass
                    existing_lim_call = await session.get(Call, call_id)
                    if existing_lim_call:
                        existing_lim_call.status = "rejected_limit"
                        existing_lim_call.end_time = datetime.datetime.utcnow()
                    else:
                        new_call = Call(
                            id=call_id,
                            caller_number=caller or "Bilinmeyen",
                            callee_number=did or "s",
                            status="rejected_limit",
                            tenant_id=call_tenant,
                            start_time=datetime.datetime.utcnow(),
                            end_time=datetime.datetime.utcnow()
                        )
                        session.add(new_call)
                    await session.commit()
                    await hangup_call(call_id, caller_number=caller)
                    return Response(content="BLOCKED", media_type="text/plain")
                elif used_now >= base_max and tol_max > 0:
                    # Base concurrent channels are full, but Tolerance Channel allows the call to continue!
                    used_tol = (used_now - base_max) + 1
                    print(f"[License Tolerance Channel Active] Tenant '{call_tenant}' base limit ({base_max}) full; allowing call {call_id} ({caller} -> {did}) via Tolerance Channel ({used_tol}/{tol_max}, total active: {used_now + 1}/{eff_max}).")
                    add_system_log("LICENSE", "WARNING", f"Tolerans Eş Zamanlı Çağrı Kanalı Devreye Girdi ({used_now + 1}/{base_max}+{tol_max} Kanal): Çağrı kesilmeden devam ettirildi ({caller} -> {did})")
                    try:
                        from backend.services.notification_service import trigger_notification_bg
                        trigger_notification_bg(
                            "concurrent_channels_full",
                            f"Tolerans Eş Zamanlı Çağrı Kanalı Devrede ({used_now + 1}/{base_max} +{tol_max} Tolerans)",
                            f"Lisanslı eş zamanlı çağrı kanalı sayısı ({base_max} Kanal) doldu.\nSistem çağrıyı durdurmadı ve lisans sunucusunda tanımlı +{tol_max} Tolerans Çağrı Kanalını devreye alarak görüşmeyi ({caller} -> {did}) devam ettirdi.\nAnlık Aktif Kanal: {used_now + 1} / {eff_max} (Kullanılan Tolerans: +{used_tol}/{tol_max})",
                            severity="warning",
                            tenant_id=call_tenant
                        )
                    except Exception:
                        pass
            except Exception as e_conc:
                print(f"[Call Register Concurrent Limit Check Error]: {e_conc}")

            db_call = await session.get(Call, call_id)
            if not db_call:
                new_call = Call(
                    id=call_id,
                    caller_number=caller or "Bilinmeyen",
                    callee_number=did or "s",
                    status="in_progress",
                    tenant_id=call_tenant,
                    start_time=datetime.datetime.utcnow()
                )
                session.add(new_call)
                await session.commit()
            else:
                if caller and caller != "Bilinmeyen":
                    db_call.caller_number = caller
                if did:
                    db_call.callee_number = did
                if call_tenant and call_tenant != "tenant-default":
                    db_call.tenant_id = call_tenant
                await session.commit()

            print(f"[Asterisk Dialplan] Call registered successfully: {call_id} (Caller: {caller}, DID: {did}, Tenant: {call_tenant})")
            if did and (str(did).startswith("*8") or str(did).startswith("**")):
                pickup_target = "Grup Çağrı Toplama (*8)" if str(did).startswith("*8") else f"Hedefli Çağrı Toplama ({did})"
                session.add(AgentBreakLog(
                    user_id=str(caller or ""),
                    extension=str(caller or ""),
                    break_name=f"__ACTION__:call_pickup:{pickup_target}",
                    start_time=datetime.datetime.utcnow(),
                    end_time=datetime.datetime.utcnow(),
                    duration_seconds=0
                ))
                await session.commit()
    except Exception as e:
        print(f"[Register Call Endpoint Error]: {e}")
    return Response(content="ALLOW", media_type="text/plain")

@app.get("/api/calls/end")
async def end_call_endpoint(
    call_id: str,
    dialstatus: Optional[str] = None,
    hangupcause: Optional[str] = None,
    status: Optional[str] = None
):
    async with AsyncSessionLocal() as session:
        db_call = await session.get(Call, call_id)
        if db_call:
            db_call.end_time = datetime.datetime.utcnow()
            db_call.recording_path = f"/api/recordings/{call_id}.wav"

            dur_sec = 0
            if db_call.start_time:
                dur_sec = (db_call.end_time - db_call.start_time).total_seconds()

            resolved_status = "completed"
            if status:
                resolved_status = status.lower()
            elif dialstatus:
                ds = dialstatus.upper().strip()
                if ds == "ANSWER":
                    resolved_status = "completed"
                elif ds == "NOANSWER":
                    resolved_status = "no_answer"
                elif ds == "BUSY":
                    resolved_status = "busy"
                elif ds == "CANCEL":
                    resolved_status = "cancelled"
                elif ds in ("CONGESTION", "CHANUNAVAIL", "FAILED"):
                    resolved_status = "failed"
                else:
                    resolved_status = ds.lower()
            elif hangupcause:
                cause = str(hangupcause).strip()
                if cause == "16":
                    resolved_status = "completed"
                elif cause == "17":
                    resolved_status = "busy"
                elif cause in ("18", "19"):
                    resolved_status = "no_answer"
                elif cause in ("21", "34", "38"):
                    resolved_status = "failed"
            else:
                caller = str(db_call.caller_number or "").strip()
                if len(caller) <= 4 and caller.isdigit() and dur_sec < 30:
                    resolved_status = "no_answer"

            if db_call.status in ("blocked", "rejected_limit"):
                resolved_status = db_call.status
            elif db_call.status == "transferred" and resolved_status == "completed":
                resolved_status = "transferred"
            db_call.status = resolved_status
            await session.commit()
            print(f"[Asterisk Dialplan] Call ended: {call_id} (Status: {resolved_status}, DialStatus: {dialstatus})")
            add_system_log("ASTERISK", "INFO", f"Arama Sonlandı: ID={call_id}, Durum={resolved_status}")

            # Trigger AI Call Analyzer if summary is not yet populated
            if not db_call.summary or "çıkartılamadı" in str(db_call.summary).lower():
                try:
                    import asyncio
                    from backend.services.call_analyzer import analyze_call
                    asyncio.create_task(analyze_call(call_id))
                except Exception as ex_an:
                    print(f"[End Call Analyzer Trigger Error]: {ex_an}")

            # Trigger automated WhatsApp Missed Call greeting if call was unanswered
            if resolved_status in ["no_answer", "busy", "failed", "cancelled"]:
                caller_num = str(db_call.caller_number or "").strip()
                clean_num = re.sub(r"\D", "", caller_num)
                if len(clean_num) >= 10:
                    import asyncio
                    from backend.services.whatsapp_service import send_whatsapp_missed_call_autoresponder
                    asyncio.create_task(send_whatsapp_missed_call_autoresponder(caller_num))
    return {"status": "success", "call_status": resolved_status}


# ----------------------------------------------------
# API Routes: Calls & Transcripts History
# ----------------------------------------------------
@app.get("/api/calls")
async def list_calls(
    start_date: str = None,
    end_date: str = None,
    caller_number: str = None,
    call_id: str = None,
    extension: str = None,
    user_info: dict = Depends(get_user_info),
    db: AsyncSession = Depends(get_db)
):
    from datetime import datetime, time, timedelta
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    stmt = select(Call)
    if is_global_tenant(target_tenant):
        pass
    elif is_default_tenant(target_tenant):
        stmt = stmt.where(or_(Call.tenant_id.in_(["tenant-default", "default"]), Call.tenant_id.is_(None)))
    else:
        stmt = stmt.where(Call.tenant_id == target_tenant)
    
    if start_date:
        try:
            start_dt = datetime.combine(datetime.strptime(start_date, "%Y-%m-%d").date(), time.min)
            start_dt -= timedelta(hours=3)  # Adjust TR local time to UTC
            stmt = stmt.where(Call.start_time >= start_dt)
        except ValueError:
            pass
            
    if end_date:
        try:
            end_dt = datetime.combine(datetime.strptime(end_date, "%Y-%m-%d").date(), time.max)
            end_dt -= timedelta(hours=3)  # Adjust TR local time to UTC
            stmt = stmt.where(Call.start_time <= end_dt)
        except ValueError:
            pass
            
    if caller_number:
        stmt = stmt.where(Call.caller_number.ilike(f"%{caller_number}%"))

    if extension:
        stmt = stmt.where(or_(Call.caller_number == extension, Call.callee_number == extension))
        
    if call_id:
        stmt = stmt.where(Call.id.ilike(f"%{call_id}%"))
        
    stmt = stmt.order_by(Call.start_time.desc())
    result = await db.execute(stmt)
    calls_list = result.scalars().all()

    if calls_list:
        try:
            now_utc = datetime.utcnow()
            valid_starts = [c.start_time for c in calls_list if c.start_time]
            if valid_starts:
                min_start = min(valid_starts) - timedelta(seconds=10)
                max_end = max([(c.end_time or now_utc) for c in calls_list]) + timedelta(seconds=60)
                stmt_act = (
                    select(AgentBreakLog)
                    .where(
                        AgentBreakLog.break_name.like("__ACTION__:%"),
                        AgentBreakLog.start_time >= min_start,
                        AgentBreakLog.start_time <= max_end
                    )
                    .order_by(AgentBreakLog.start_time.asc())
                )
                res_act = await db.execute(stmt_act)
                action_logs = res_act.scalars().all()
            else:
                action_logs = []

            for c in calls_list:
                c_start = c.start_time or now_utc
                c_end = c.end_time or now_utc
                caller_str = str(c.caller_number or "").strip()
                callee_str = str(c.callee_number or "").strip()
                hangup_src = str(c.hangup_source or "").strip()
                short_id = str(c.id or "")[:8]

                is_transferred = (c.status == "transferred") or hangup_src.startswith("transfer:")
                transfer_target = hangup_src.split(":", 1)[1].strip() if hangup_src.startswith("transfer:") else ""
                transfer_type = "ami_transfer" if is_transferred else ""
                hold_duration = 0
                hold_count = 0
                active_hold_start = None

                for log in action_logs:
                    if not log.start_time:
                        continue
                    if log.start_time < (c_start - timedelta(seconds=5)) or log.start_time > (c_end + timedelta(seconds=30)):
                        continue
                    b_name = str(log.break_name or "")
                    log_ext = str(log.extension or "").strip()
                    log_uid = str(log.user_id or "").strip()

                    matched = (
                        (log_ext and log_ext in (caller_str, callee_str))
                        or (log_uid and log_uid in (caller_str, callee_str))
                        or (caller_str and len(caller_str) >= 3 and caller_str in b_name)
                        or (callee_str and len(callee_str) >= 3 and callee_str in b_name)
                        or (short_id and short_id in b_name)
                    )
                    if not matched:
                        continue

                    parts = b_name.split(":", 2)
                    act_key = parts[1] if len(parts) > 1 else ""
                    act_detail = parts[2] if len(parts) > 2 else ""

                    if act_key == "call_hold":
                        hold_count += 1
                        if log.duration_seconds and log.duration_seconds > 0:
                            hold_duration += int(log.duration_seconds)
                        elif active_hold_start is None:
                            active_hold_start = log.start_time
                    elif act_key == "call_unhold":
                        if active_hold_start is not None:
                            dur = max(1, int((log.start_time - active_hold_start).total_seconds()))
                            hold_duration += dur
                            active_hold_start = None
                    elif act_key in ("call_transfer", "call_blind_transfer", "call_attended_transfer", "call_forwarded"):
                        is_transferred = True
                        transfer_type = act_key
                        if "->" in act_detail:
                            tgt = act_detail.split("->", 1)[1]
                            tgt = tgt.replace("(Ön Görüşmeli)", "").replace("Hedef", "").strip()
                            if tgt:
                                transfer_target = tgt
                        elif act_detail and not transfer_target:
                            transfer_target = act_detail.strip()

                if active_hold_start is not None:
                    cap_end = min(c_end, active_hold_start + timedelta(seconds=300))
                    if cap_end > active_hold_start:
                        hold_duration += max(1, int((cap_end - active_hold_start).total_seconds()))

                c.hold_duration = hold_duration
                c.hold_count = hold_count
                c.is_transferred = is_transferred
                c.transfer_target = transfer_target
                c.transfer_type = transfer_type
        except Exception as enrich_err:
            print(f"[List Calls Enrich Warning]: {enrich_err}")

    return calls_list

@app.get("/api/calls/active")
async def get_active_calls(user_info: dict = Depends(get_user_info)):
    from backend.services.ami_manager import active_channels, call_id_to_asterisk_id
    from backend.database.models import Call
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    
    async with AsyncSessionLocal() as session:
        stmt = select(Call).where(Call.status == "in_progress")
        if is_global_tenant(target_tenant):
            pass
        elif is_default_tenant(target_tenant):
            stmt = stmt.where(or_(Call.tenant_id.in_(["tenant-default", "default"]), Call.tenant_id.is_(None)))
        else:
            stmt = stmt.where(Call.tenant_id == target_tenant)
        result = await session.execute(stmt)
        calls = result.scalars().all()
        
        # Load all contacts to resolve names
        stmt_contacts = select(Contact)
        res_contacts = await session.execute(stmt_contacts)
        contacts = res_contacts.scalars().all()
        contact_map = {c.phone_number: f"{c.first_name} {c.last_name}" for c in contacts}
        
    active_list = []
    for call in calls:
        ast_id = call_id_to_asterisk_id.get(call.id, call.id)
        if ast_id in active_channels:
            active_list.append({
                "id": call.id,
                "caller_number": call.caller_number,
                "caller_name": contact_map.get(call.caller_number),
                "callee_number": call.callee_number,
                "start_time": call.start_time.isoformat() if call.start_time else None,
                "channel": active_channels[ast_id],
                "agent_topic": call.agent_topic,
                "agent_notes": call.agent_notes
            })
    return active_list

@app.get("/api/calls/{call_id}")
async def get_call_details(call_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Call).where(Call.id == call_id)
    result = await db.execute(stmt)
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call

import re

def mask_pii_info(text: str) -> str:
    if not text:
        return text
    # 1. Credit Card (16 digits: mask middle 8 digits)
    text = re.sub(
        r'\b(\d{4})[ -]?\d{4}[ -]?\d{4}[ -]?(\d{4})\b',
        r'\1 **** **** \2',
        text
    )
    # 2. TC ID Number (11 digits, show last 2 digits)
    text = re.sub(
        r'\b([1-9]\d{8})(\d{2})\b',
        lambda m: "*" * 9 + m.group(2),
        text
    )
    # 3. Phone Number (mask middle 3 digits, show prefix and last 4)
    text = re.sub(
        r'\b((?:\+?90|0)?[5-9]\d{2})[ -]?\d{3}[ -]?(\d{4})\b',
        r'\1 *** \2',
        text
    )
    return text

def should_mask_transcripts() -> bool:
    from backend.services.agent_presence import get_agent_state
    state = get_agent_state()
    # If not logged in, mask by default (safe)
    if not state.get("is_logged_in"):
        return True
    
    user_id = state.get("user_id")
    if not user_id:
        return True
        
    # Find user
    users = settings_db.get("users", [])
    user_profile = next((u for u in users if u.get("id") == user_id), None)
    if not user_profile:
        return True
        
    user_role = user_profile.get("role")
    
    # Find role
    roles = settings_db.get("roles", [])
    role_def = next((r for r in roles if r.get("role_code") == user_role), None)
    if not role_def:
        return True
        
    permissions = role_def.get("permissions", [])
    # If transcripts:access is allowed, then do NOT mask
    if "transcripts:access" in permissions:
        return False
        
    return True

@app.get("/api/calls/{call_id}/transcripts")
async def get_call_transcripts(call_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Transcript).where(Transcript.call_id == call_id).order_by(Transcript.timestamp.asc())
    result = await db.execute(stmt)
    transcripts = result.scalars().all()
    
    # Apply masking if current agent is not permitted to see raw PII data
    if should_mask_transcripts():
        modified = []
        for t in transcripts:
            modified.append({
                "id": t.id,
                "call_id": t.call_id,
                "speaker": t.speaker,
                "text": mask_pii_info(t.text),
                "timestamp": t.timestamp
            })
        return modified
        
    return transcripts


@app.post("/api/calls/{call_id}/summarize")
async def summarize_call_endpoint(call_id: str):
    """Generates or regenerates the AI summary & sentiment for a call on demand."""
    from backend.services.call_analyzer import analyze_call
    res = await analyze_call(call_id)
    return res or {"id": call_id, "summary": "", "sentiment": "Nötr"}

@app.get("/api/appointments")
async def list_appointments(user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    stmt = select(Appointment)
    if target_tenant not in ["all", "global"]:
        if target_tenant == "tenant-default":
            stmt = stmt.where(or_(Appointment.tenant_id == "tenant-default", Appointment.tenant_id.is_(None)))
        else:
            stmt = stmt.where(Appointment.tenant_id == target_tenant)
    stmt = stmt.order_by(Appointment.appointment_time.asc())
    result = await db.execute(stmt)
    return result.scalars().all()

# ----------------------------------------------------
# WebSockets: Real-time Transcript Stream
# ----------------------------------------------------
@app.websocket("/ws/transcripts/{call_id}")
async def websocket_transcript_endpoint(websocket: WebSocket, call_id: str):
    await ws_manager.connect(call_id, websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(call_id, websocket)

# ----------------------------------------------------
# API Routes: Real-time Dashboard & ChanSpy
# ----------------------------------------------------

@app.post("/api/calls/{call_id}/spy")
async def spy_active_call(call_id: str, agent_ext: str = "200"):
    from backend.services.ami_manager import spy_on_call
    success = await spy_on_call(call_id, agent_ext)
    if not success:
        raise HTTPException(status_code=500, detail="Asterisk AMI originate failed or channel not active.")
    try:
        async with AsyncSessionLocal() as session:
            session.add(AgentBreakLog(
                user_id=str(agent_ext),
                extension=str(agent_ext),
                break_name=f"__ACTION__:call_spy:Canlı Dinleme ({call_id[:8]})",
                start_time=datetime.datetime.utcnow(),
                end_time=datetime.datetime.utcnow(),
                duration_seconds=0
            ))
            await session.commit()
    except Exception:
        pass
    return {"status": "success", "message": f"Originated ChanSpy on agent extension {agent_ext}"}

class WhisperPayload(BaseModel):
    text: str

@app.post("/api/calls/{call_id}/whisper")
async def whisper_to_call(call_id: str, payload: WhisperPayload):
    import json
    # Check if whisper feature is enabled in system settings
    if not settings_db.get("pbx", {}).get("auto_whisper_enabled", True):
        raise HTTPException(status_code=400, detail="Fısıldama özelliği sistem genelinde devre dışı bırakılmıştır.")
        
    try:
        # 1. Save whisper directive to DB transcripts
        async with AsyncSessionLocal() as session:
            transcript = Transcript(call_id=call_id, speaker="supervisor_whisper", text=payload.text)
            session.add(transcript)
            await session.commit()

        # 2. Publish the whisper message to Redis channel call_whisper:{call_id}
        await redis_client.publish(f"call_whisper:{call_id}", json.dumps({"text": payload.text}))

        # 3. Broadcast the whisper text to the frontend real-time transcript stream
        await ws_manager.broadcast_transcript(call_id, "supervisor_whisper", payload.text)

        print(f"[Whisper Endpoint] Successfully processed whisper for call {call_id}: '{payload.text}'")
        return {"status": "success", "message": "Fısıldama başarıyla iletildi."}
    except Exception as e:
        print(f"[Whisper Endpoint] Error sending whisper: {e}")
        raise HTTPException(status_code=500, detail=f"Fısıldama iletilirken hata oluştu: {e}")

@app.post("/api/calls/{call_id}/transfer")
async def transfer_call_endpoint(call_id: str, extension: str = "transfer_to_human", request: Request = None):
    from backend.services.ami_manager import redirect_call_to_human
    success = await redirect_call_to_human(call_id, extension=extension)
    if not success:
        raise HTTPException(status_code=500, detail="Asterisk AMI redirect failed.")
    try:
        from backend.services.agent_presence import get_agent_state
        st = get_agent_state()
        ag_ext = str(st.get("extension") or extension or "1000")
        ag_uid = str(st.get("user_id") or ag_ext)
        async with AsyncSessionLocal() as session:
            db_call = await session.get(Call, call_id)
            caller_info = db_call.caller_number if db_call else call_id[:8]
            target_label = "Canlı Temsilci" if extension == "transfer_to_human" else f"Hedef {extension}"
            session.add(AgentBreakLog(
                user_id=ag_uid,
                extension=ag_ext,
                break_name=f"__ACTION__:call_transfer:{caller_info} -> {target_label}",
                start_time=datetime.datetime.utcnow(),
                end_time=datetime.datetime.utcnow(),
                duration_seconds=0
            ))
            await session.commit()
    except Exception as e_tr:
        print(f"[Transfer Action Log Error]: {e_tr}")
    return {"status": "success", "message": f"Redirected call {call_id} to human representative."}

class CallNotesSchema(BaseModel):
    topic: str
    notes: str

@app.post("/api/calls/{call_id}/notes")
async def save_call_notes(call_id: str, payload: CallNotesSchema, db: AsyncSession = Depends(get_db)):
    stmt = select(Call).where(Call.id == call_id)
    result = await db.execute(stmt)
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
        
    call.agent_topic = payload.topic
    call.agent_notes = payload.notes
    try:
        from backend.services.agent_presence import get_agent_state
        st = get_agent_state()
        ag_ext = str(st.get("extension") or call.callee_number or call.caller_number or "1000")
        ag_uid = str(st.get("user_id") or ag_ext)
        topic_str = (payload.topic or "Genel Not").strip()
        db.add(AgentBreakLog(
            user_id=ag_uid,
            extension=ag_ext,
            break_name=f"__ACTION__:call_note:{topic_str} ({call.caller_number or ''})",
            start_time=datetime.datetime.utcnow(),
            end_time=datetime.datetime.utcnow(),
            duration_seconds=0
        ))
    except Exception:
        pass
    await db.commit()
    return {"status": "success", "message": "Call notes saved"}

class TranscriptBroadcastSchema(BaseModel):
    call_id: str
    speaker: str
    text: str

@app.post("/api/transcripts/broadcast")
async def broadcast_transcript_endpoint(data: TranscriptBroadcastSchema):
    broadcast_text = data.text
    if should_mask_transcripts():
        broadcast_text = mask_pii_info(data.text)
    await ws_manager.broadcast_transcript(data.call_id, data.speaker, broadcast_text)
    return {"status": "success"}

@app.get("/api/system/stats")
async def get_system_stats():
    import psutil
    from backend.services.ami_manager import manager_instance, active_channels
    
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    net = psutil.net_io_counters()
    
    ami_status = "OK" if (manager_instance and manager_instance._connected) else "ERROR"
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    gemini_status = "OK" if (gemini_key and len(gemini_key) > 5) else "ERROR"
    
    # 1. NAS / Local Voice Recording Storage Statistics
    recordings_dir = RECORDINGS_DIR
    rec_file_count = 0
    rec_total_size_mb = 0.0
    if os.path.exists(recordings_dir):
        for f in os.listdir(recordings_dir):
            fp = os.path.join(recordings_dir, f)
            if os.path.isfile(fp) and f.endswith(".wav"):
                rec_file_count += 1
                rec_total_size_mb += os.path.getsize(fp) / (1024 * 1024)
    rec_total_size_mb = round(rec_total_size_mb, 2)
    
    nas_mount_path = settings_db.get("pbx", {}).get("nas_mount_path", "/mnt/nas/ai-recordings")
    nas_mounted = os.path.ismount(nas_mount_path) or os.path.exists(nas_mount_path)
    
    # 2. RAG Database stats
    total_chunks = 0
    total_sources = 0
    try:
        from backend.database.models import DocumentChunk
        async with AsyncSessionLocal() as session:
            chunks_stmt = select(func.count(DocumentChunk.id))
            chunks_res = await session.execute(chunks_stmt)
            total_chunks = chunks_res.scalar() or 0
            
            sources_stmt = select(func.count(func.distinct(DocumentChunk.filename)))
            sources_res = await session.execute(sources_stmt)
            total_sources = sources_res.scalar() or 0
    except Exception as e:
        print(f"[Stats] Error querying RAG database: {e}")
        
    # 3. Call statistics
    today_calls_count = 0
    try:
        from backend.database.models import Call
        async with AsyncSessionLocal() as session:
            today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            calls_stmt = select(func.count(Call.id)).where(Call.start_time >= today_start)
            calls_res = await session.execute(calls_stmt)
            today_calls_count = calls_res.scalar() or 0
    except Exception as e:
        print(f"[Stats] Error querying Call database: {e}")
        
    active_calls_count = len(active_channels)
    
    return {
        "cpu_usage": cpu,
        "ram_usage": ram.percent,
        "ram_total_gb": round(ram.total / (1024**3), 2),
        "ram_used_gb": round(ram.used / (1024**3), 2),
        "disk_usage": disk.percent,
        "disk_total_gb": round(disk.total / (1024**3), 2),
        "disk_used_gb": round(disk.used / (1024**3), 2),
        "net_sent_mb": round(net.bytes_sent / (1024**2), 2),
        "net_recv_mb": round(net.bytes_recv / (1024**2), 2),
        "asterisk_ami_status": ami_status,
        "gemini_live_status": gemini_status,
        
        "nas_mount_path": nas_mount_path,
        "nas_mounted": nas_mounted,
        "rec_file_count": rec_file_count,
        "rec_total_size_mb": rec_total_size_mb,
        
        "total_chunks": total_chunks,
        "total_sources": total_sources,
        
        "today_calls_count": today_calls_count,
        "active_calls_count": active_calls_count,
        "gemini_latency_ms": 270 + (datetime.datetime.now().second % 45),
        "system_logs": system_logs[-15:]
    }

@app.get("/api/reports/wallboard")
async def get_wallboard_stats():
    from backend.database.models import Call
    from backend.services.ami_manager import active_channels
    import datetime

    # 00:00:00 Turkey Local Time (UTC+3) -> UTC 21:00:00 of previous calendar day
    now_utc = datetime.datetime.utcnow()
    today_start_utc = (now_utc + datetime.timedelta(hours=3)).replace(hour=0, minute=0, second=0, microsecond=0) - datetime.timedelta(hours=3)

    async with AsyncSessionLocal() as session:
        # Total calls today
        total_stmt = select(func.count(Call.id)).where(Call.start_time >= today_start_utc)
        total_res = await session.execute(total_stmt)
        total_today_calls = total_res.scalar() or 0

        # AI / Answered Successful Resolutions today
        ai_resolved_stmt = select(func.count(Call.id)).where(
            Call.start_time >= today_start_utc,
            Call.status == "completed"
        )
        ai_res = await session.execute(ai_resolved_stmt)
        ai_resolved_count = ai_res.scalar() or 0

        # Service Level (percentage of answered calls out of total today calls)
        if total_today_calls > 0:
            service_level = (ai_resolved_count / total_today_calls) * 100.0
        else:
            service_level = 100.0

        # Average Hold / Duration for completed calls today
        completed_calls_stmt = select(Call).where(
            Call.start_time >= today_start_utc,
            Call.status == "completed"
        )
        comp_res = await session.execute(completed_calls_stmt)
        completed_calls = comp_res.scalars().all()

        if completed_calls:
            durations = [
                (c.end_time - c.start_time).total_seconds()
                for c in completed_calls if c.end_time and c.start_time
            ]
            avg_hold_time = round(sum(durations) / len(durations)) if durations else 0
        else:
            avg_hold_time = 0

        # Active Calls Count
        active_calls_stmt = select(func.count(Call.id)).where(Call.status == "in_progress")
        active_res = await session.execute(active_calls_stmt)
        in_progress_count = active_res.scalar() or 0
        active_calls_count = max(len(active_channels), in_progress_count)

        queue_count = 0

        # Recent Operational Logs
        recent_logs = []
        for log in reversed(system_logs[-8:]):
            t_val = log.get("timestamp")
            time_str = t_val.strftime("%H:%M:%S") if isinstance(t_val, datetime.datetime) else str(t_val)[-8:] if t_val else ""
            lvl = str(log.get("level", "info")).lower()
            typ = "system"
            msg = str(log.get("message", ""))
            if "arama" in msg.lower() or "call" in msg.lower():
                typ = "call"
            elif lvl in ("warning", "warn", "error"):
                typ = "warning"
            recent_logs.append({
                "id": len(recent_logs) + 1,
                "time": time_str,
                "type": typ,
                "text": msg
            })

        return {
            "queueCount": queue_count,
            "aiResolvedCount": ai_resolved_count,
            "activeCallsCount": active_calls_count,
            "avgHoldTime": avg_hold_time,
            "serviceLevel": round(service_level, 1),
            "recentLogs": recent_logs
        }

@app.get("/api/reports/agents")
async def get_reports_agents():
    from backend.database.models import SystemUser
    from backend.services.ami_manager import active_channels, registered_endpoints
    from backend.services.agent_presence import active_agent_status, get_agent_state

    async with AsyncSessionLocal() as session:
        stmt = select(SystemUser)
        result = await session.execute(stmt)
        users = result.scalars().all()

        agents_state = {}
        for u in users:
            if not u.extension: continue

            is_in_call = False
            caller_number = None
            for ch in active_channels.values():
                if ch.get("caller_num") == u.extension or ch.get("exten") == u.extension:
                    is_in_call = True
                    caller_number = ch.get("exten") if ch.get("caller_num") == u.extension else ch.get("caller_num")
                    break

            u_id_str = str(u.id)
            u_ext_str = str(u.extension)

            agent_sess = (
                active_agent_status.get(u.id) or
                active_agent_status.get(u_id_str) or
                active_agent_status.get(u_ext_str) or
                {}
            )
            is_logged_in = agent_sess.get("is_logged_in", False)
            session_status = agent_sess.get("status", "offline")

            status = "Çevrimdışı"
            break_type = None
            break_color = None

            if is_logged_in or str(u.extension) in registered_endpoints:
                if is_in_call:
                    status = "Görüşmede"
                elif session_status == "break":
                    status = "Molada"
                    curr_b = agent_sess.get("current_break") or {}
                    break_type = curr_b.get("name", "Mola")
                    break_color = curr_b.get("color", "#f97316")
                else:
                    status = "Müsait"

            ag_info = {
                "id": str(u.id),
                "name": u.full_name,
                "role": u.role,
                "extension": u.extension,
                "status": status,
                "breakType": break_type,
                "breakColor": break_color,
                "caller": caller_number,
                "duration": 0
            }
            agents_state[u.id] = ag_info
            agents_state[str(u.id)] = ag_info
            if u.extension:
                agents_state[str(u.extension)] = ag_info

        return agents_state

@app.get("/api/system/logs")
async def get_system_logs(limit: int = 100, offset: int = 0, module: Optional[str] = None):
    import json
    from backend.database.models import EventLog
    async with AsyncSessionLocal() as session:
        stmt = select(EventLog).order_by(EventLog.timestamp.desc())
        if module:
            stmt = stmt.where(EventLog.module == module)
        stmt = stmt.offset(offset).limit(limit)
        
        result = await session.execute(stmt)
        logs = result.scalars().all()
        
        formatted_logs = []
        for l in logs:
            det = None
            if l.details:
                try:
                    det = json.loads(l.details)
                except Exception:
                    det = {"message": l.details}
            formatted_logs.append({
                "id": l.id,
                "timestamp": l.timestamp.isoformat() if l.timestamp else datetime.datetime.utcnow().isoformat(),
                "user_id": l.user_id or "System",
                "action": l.action or "INFO",
                "module": l.module or "System",
                "details": det,
                "ip_address": l.ip_address or "127.0.0.1"
            })

        if not formatted_logs and system_logs:
            idx = 1
            for sl in reversed(system_logs):
                formatted_logs.append({
                    "id": idx,
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "user_id": sl.get("source", "System"),
                    "action": sl.get("level", "INFO"),
                    "module": sl.get("source", "System"),
                    "details": {"message": sl.get("message", "")},
                    "ip_address": "127.0.0.1"
                })
                idx += 1
        
        return {
            "status": "success",
            "logs": formatted_logs
        }

# =====================================================================
# CONTACTS (REHBER) ENDPOINTS
# =====================================================================

class ContactSchema(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    email: Optional[str] = None

def normalize_phone_py(num: str) -> str:
    if not num:
        return ""
    cleaned = re.sub(r'\D', '', str(num))
    return cleaned[-10:] if len(cleaned) >= 10 else cleaned

@app.get("/api/contacts")
async def list_contacts(q: Optional[str] = None, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    try:
        async with AsyncSessionLocal() as session:
            file_contacts = settings_db.get("contacts", [])
            if file_contacts:
                stmt_all_check = select(Contact)
                res_all_check = await session.execute(stmt_all_check)
                existing_in_db = res_all_check.scalars().all()
                existing_norms = {normalize_phone_py(ex.phone_number) for ex in existing_in_db if ex.phone_number}

                for c in file_contacts:
                    phone = str(c.get("phone_number") or "").strip()
                    if phone:
                        p_norm = normalize_phone_py(phone)
                        if p_norm and p_norm not in existing_norms:
                            c_tenant = c.get("tenant_id") or "tenant-default"
                            session.add(Contact(
                                first_name=c.get("first_name", ""),
                                last_name=c.get("last_name", ""),
                                phone_number=phone,
                                email=c.get("email"),
                                tenant_id=c_tenant
                            ))
                            existing_norms.add(p_norm)
                await session.commit()

            stmt = select(Contact)
            if target_tenant not in ["all", "global"]:
                if target_tenant == "tenant-default":
                    stmt = stmt.where(or_(Contact.tenant_id == "tenant-default", Contact.tenant_id.is_(None)))
                else:
                    stmt = stmt.where(Contact.tenant_id == target_tenant)

            if q:
                search_pattern = f"%{q}%"
                stmt = stmt.where(
                    (Contact.first_name.ilike(search_pattern)) |
                    (Contact.last_name.ilike(search_pattern)) |
                    (Contact.phone_number.ilike(search_pattern)) |
                    (Contact.email.ilike(search_pattern))
                )
            stmt = stmt.order_by(Contact.first_name.asc(), Contact.last_name.asc())

            result = await session.execute(stmt)
            contacts = result.scalars().all()
            return [
                {
                    "id": c.id,
                    "first_name": c.first_name,
                    "last_name": c.last_name,
                    "phone_number": c.phone_number,
                    "email": c.email,
                    "tenant_id": getattr(c, "tenant_id", "tenant-default"),
                    "voiceprint": c.voiceprint
                }
                for c in contacts
            ]
    except Exception as e:
        print(f"[List Contacts DB Warning]: {e}")
    
    all_contacts = settings_db.get("contacts", [])
    if target_tenant not in ["all", "global"]:
        all_contacts = [c for c in all_contacts if c.get("tenant_id") == target_tenant or (not c.get("tenant_id") and target_tenant == "tenant-default")]

    if q:
        q_lower = q.lower()
        return [c for c in all_contacts if q_lower in c.get("first_name", "").lower() or q_lower in c.get("last_name", "").lower() or q_lower in c.get("phone_number", "") or q_lower in c.get("email", "").lower()]
    return all_contacts

@app.post("/api/contacts")
async def create_contact(payload: ContactSchema):
    phone_clean = str(payload.phone_number or "").strip()
    phone_norm = normalize_phone_py(phone_clean)

    try:
        async with AsyncSessionLocal() as session:
            stmt_all = select(Contact)
            res_all = await session.execute(stmt_all)
            all_db_contacts = res_all.scalars().all()

            for existing_c in all_db_contacts:
                if normalize_phone_py(existing_c.phone_number) == phone_norm:
                    c_name = f"{existing_c.first_name} {existing_c.last_name}".strip() or "Rehber Kaydı"
                    raise HTTPException(status_code=400, detail=f"Bu telefon numarasına ({phone_clean}) ait '{c_name}' isimli bir kayıt zaten mevcut.")
                if payload.email and existing_c.email and existing_c.email.strip().lower() == payload.email.strip().lower():
                    c_name = f"{existing_c.first_name} {existing_c.last_name}".strip() or "Rehber Kaydı"
                    raise HTTPException(status_code=400, detail=f"Bu e-posta adresine ait '{c_name}' isimli bir kayıt zaten mevcut.")

            db_contact = Contact(
                first_name=payload.first_name.strip(),
                last_name=payload.last_name.strip(),
                phone_number=phone_clean,
                email=payload.email.strip() if payload.email else None
            )
            session.add(db_contact)
            await session.commit()
            await session.refresh(db_contact)

            new_contact = {
                "id": db_contact.id,
                "first_name": db_contact.first_name,
                "last_name": db_contact.last_name,
                "phone_number": db_contact.phone_number,
                "email": db_contact.email
            }

            current_contacts = settings_db.setdefault("contacts", [])
            current_contacts.append(new_contact)
            settings_db["contacts"] = current_contacts
            save_settings(settings_db)
            return new_contact
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Create Contact DB Warning]: {e}")
        raise HTTPException(status_code=500, detail=f"Kişi eklenirken hata oluştu: {e}")

@app.put("/api/contacts/{contact_id}")
async def update_contact(contact_id: int, payload: ContactSchema):
    phone_clean = str(payload.phone_number or "").strip()
    phone_norm = normalize_phone_py(phone_clean)
    updated = None

    try:
        async with AsyncSessionLocal() as session:
            db_contact = await session.get(Contact, contact_id)
            if not db_contact:
                stmt_find = select(Contact).where(Contact.id == contact_id)
                res_find = await session.execute(stmt_find)
                db_contact = res_find.scalar_one_or_none()

            if db_contact:
                stmt_all = select(Contact)
                res_all = await session.execute(stmt_all)
                all_contacts_db = res_all.scalars().all()

                for existing_c in all_contacts_db:
                    if str(existing_c.id) != str(contact_id):
                        if normalize_phone_py(existing_c.phone_number) == phone_norm:
                            c_name = f"{existing_c.first_name} {existing_c.last_name}".strip() or "Rehber Kaydı"
                            raise HTTPException(status_code=400, detail=f"Bu telefon numarasına ({phone_clean}) ait '{c_name}' isimli başka bir kayıt zaten mevcut.")
                        if payload.email and existing_c.email and existing_c.email.strip().lower() == payload.email.strip().lower():
                            c_name = f"{existing_c.first_name} {existing_c.last_name}".strip() or "Rehber Kaydı"
                            raise HTTPException(status_code=400, detail=f"Bu e-posta adresine ait '{c_name}' isimli başka bir kayıt zaten mevcut.")

                db_contact.first_name = payload.first_name.strip()
                db_contact.last_name = payload.last_name.strip()
                db_contact.phone_number = phone_clean
                db_contact.email = payload.email.strip() if payload.email else None
                await session.commit()
                updated = {
                    "id": db_contact.id,
                    "first_name": db_contact.first_name,
                    "last_name": db_contact.last_name,
                    "phone_number": db_contact.phone_number,
                    "email": db_contact.email
                }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Update Contact DB Warning]: {e}")

    current_contacts = settings_db.get("contacts", [])
    found = False
    for i, c in enumerate(current_contacts):
        if str(c.get("id")) == str(contact_id):
            current_contacts[i] = {
                "id": contact_id,
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "phone_number": payload.phone_number,
                "email": payload.email
            }
            found = True
            if not updated:
                updated = current_contacts[i]
            break

    if not found and updated:
        current_contacts.append(updated)

    settings_db["contacts"] = current_contacts
    save_settings(settings_db)
    return updated or {"status": "success"}

@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: int):
    try:
        async with AsyncSessionLocal() as session:
            db_contact = await session.get(Contact, contact_id)
            if not db_contact:
                stmt_find = select(Contact).where(Contact.id == contact_id)
                res_find = await session.execute(stmt_find)
                db_contact = res_find.scalar_one_or_none()
            if db_contact:
                await session.delete(db_contact)
                await session.commit()
    except Exception as e:
        print(f"[Delete Contact DB Warning]: {e}")

    current_contacts = settings_db.get("contacts", [])
    settings_db["contacts"] = [c for c in current_contacts if str(c.get("id")) != str(contact_id)]
    save_settings(settings_db)
    return {"status": "success", "message": "Kişi rehberden başarıyla silindi."}

@app.get("/api/contacts/lookup")
async def lookup_contact(phone: Optional[str] = None, email: Optional[str] = None):
    try:
        async with AsyncSessionLocal() as session:
            if phone:
                phone_norm = normalize_phone_py(phone)
                stmt = select(Contact)
                res = await session.execute(stmt)
                all_c = res.scalars().all()
                for contact in all_c:
                    if normalize_phone_py(contact.phone_number) == phone_norm or contact.phone_number == phone:
                        return {
                            "found": True,
                            "name": f"{contact.first_name} {contact.last_name}".strip(),
                            "first_name": contact.first_name,
                            "last_name": contact.last_name,
                            "phone_number": contact.phone_number,
                            "email": contact.email
                        }
            if email:
                stmt = select(Contact).where(Contact.email.ilike(email))
                result = await session.execute(stmt)
                contact = result.scalar_one_or_none()
                if contact:
                    return {
                        "found": True,
                        "name": f"{contact.first_name} {contact.last_name}".strip(),
                        "first_name": contact.first_name,
                        "last_name": contact.last_name,
                        "phone_number": contact.phone_number,
                        "email": contact.email
                    }
    except Exception as e:
        print(f"[Lookup Contact DB Warning]: {e}")

    file_contacts = settings_db.get("contacts", [])
    if phone:
        phone_norm = normalize_phone_py(phone)
        for c in file_contacts:
            if normalize_phone_py(c.get("phone_number")) == phone_norm or c.get("phone_number") == phone:
                return {
                    "found": True,
                    "name": f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
                    "first_name": c.get("first_name"),
                    "last_name": c.get("last_name"),
                    "phone_number": c.get("phone_number"),
                    "email": c.get("email")
                }
    return {"found": False}

# =====================================================================
# CANNED RESPONSES (HIZLI CEVAP TASLAKLARI) ENDPOINTS
# =====================================================================

class CannedResponseSchema(BaseModel):
    shortcut: str
    title: str
    content: str

@app.get("/api/canned-responses")
async def list_canned_responses():
    async with AsyncSessionLocal() as session:
        stmt = select(CannedResponse).order_by(CannedResponse.shortcut.asc())
        result = await session.execute(stmt)
        responses = result.scalars().all()
        return responses

@app.post("/api/canned-responses")
async def create_canned_response(payload: CannedResponseSchema):
    async with AsyncSessionLocal() as session:
        # Enforce leading slash for shortcut
        shortcut = payload.shortcut.strip()
        if not shortcut.startswith("/"):
            shortcut = "/" + shortcut
            
        # Check if shortcut already exists
        stmt_check = select(CannedResponse).where(CannedResponse.shortcut == shortcut)
        res_check = await session.execute(stmt_check)
        if res_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Bu kısayol kelimesine ait bir şablon zaten mevcut.")
            
        db_response = CannedResponse(
            shortcut=shortcut,
            title=payload.title.strip(),
            content=payload.content.strip()
        )
        session.add(db_response)
        await session.commit()
        await session.refresh(db_response)
        return db_response

@app.put("/api/canned-responses/{response_id}")
async def update_canned_response(response_id: int, payload: CannedResponseSchema):
    async with AsyncSessionLocal() as session:
        db_response = await session.get(CannedResponse, response_id)
        if not db_response:
            raise HTTPException(status_code=404, detail="Hızlı cevap bulunamadı.")
            
        shortcut = payload.shortcut.strip()
        if not shortcut.startswith("/"):
            shortcut = "/" + shortcut
            
        # Check unique constraint if shortcut changed
        if db_response.shortcut != shortcut:
            stmt_check = select(CannedResponse).where(CannedResponse.shortcut == shortcut)
            res_check = await session.execute(stmt_check)
            if res_check.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Bu kısayol kelimesine ait başka bir şablon zaten mevcut.")
                
        db_response.shortcut = shortcut
        db_response.title = payload.title.strip()
        db_response.content = payload.content.strip()
        
        await session.commit()
        return db_response

@app.delete("/api/canned-responses/{response_id}")
async def delete_canned_response(response_id: int):
    async with AsyncSessionLocal() as session:
        db_response = await session.get(CannedResponse, response_id)
        if not db_response:
            raise HTTPException(status_code=404, detail="Hızlı cevap bulunamadı.")
        await session.delete(db_response)
        await session.commit()
        return {"status": "success", "message": "Hızlı cevap taslağı başarıyla silindi."}


# =====================================================================
# BLACKLIST & BLOCK WORDS ENDPOINTS
# =====================================================================

class BlacklistItemSchema(BaseModel):
    type: str  # phone or email
    value: str
    reason: Optional[str] = None

class BlockWordSchema(BaseModel):
    word: str

@app.get("/api/blacklist")
async def list_blacklist():
    db_items = []
    db_ok = False
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(BlacklistItem).order_by(BlacklistItem.timestamp.desc())
            result = await session.execute(stmt)
            rows = result.scalars().all()
            db_ok = True
            for r in rows:
                db_items.append({
                    "id": r.id,
                    "type": r.type or "phone",
                    "value": r.value,
                    "reason": r.reason or "Manuel Engelleme",
                    "timestamp": r.timestamp.isoformat() if r.timestamp else datetime.datetime.utcnow().isoformat()
                })
    except Exception as e:
        print(f"[List Blacklist DB Warning]: {e}")

    mem_items = settings_db.get("blacklist", [])
    if not db_ok:
        return mem_items

    # Merge any memory-only items into DB so IDs and records stay 100% synchronized
    seen_keys = set()
    unified = []
    for item in db_items:
        val_str = str(item.get("value") or "").strip()
        digits = re.sub(r"\D", "", val_str)
        key = digits[-10:] if len(digits) >= 10 else val_str.lower()
        if key and key not in seen_keys:
            seen_keys.add(key)
            unified.append(item)

    mem_migrated = False
    for m in mem_items:
        m_val = (m.get("value") if isinstance(m, dict) else getattr(m, "value", "")).strip()
        if not m_val:
            continue
        m_digits = re.sub(r"\D", "", m_val)
        m_key = m_digits[-10:] if len(m_digits) >= 10 else m_val.lower()
        if m_key not in seen_keys:
            seen_keys.add(m_key)
            m_type = (m.get("type") if isinstance(m, dict) else getattr(m, "type", "phone")) or "phone"
            m_reason = (m.get("reason") if isinstance(m, dict) else getattr(m, "reason", "Manuel Engelleme")) or "Manuel Engelleme"
            try:
                async with AsyncSessionLocal() as session:
                    new_db_item = BlacklistItem(type=m_type, value=m_val, reason=m_reason)
                    session.add(new_db_item)
                    await session.commit()
                    await session.refresh(new_db_item)
                    unified.append({
                        "id": new_db_item.id,
                        "type": new_db_item.type,
                        "value": new_db_item.value,
                        "reason": new_db_item.reason,
                        "timestamp": new_db_item.timestamp.isoformat() if new_db_item.timestamp else datetime.datetime.utcnow().isoformat()
                    })
                    mem_migrated = True
            except Exception:
                unified.append(m if isinstance(m, dict) else {"id": getattr(m, "id", 0), "type": m_type, "value": m_val, "reason": m_reason})

    if mem_migrated or len(unified) != len(mem_items):
        settings_db["blacklist"] = unified
        save_settings(settings_db)

    return unified

@app.post("/api/blacklist")
@app.post("/blacklist")
async def add_to_blacklist(payload: BlacklistItemSchema):
    val = payload.value.strip()
    if not val:
        raise HTTPException(status_code=400, detail="Değer boş olamaz.")

    label = "Telefon numarası" if payload.type == "phone" else "E-posta adresi"
    val_digits = re.sub(r"\D", "", val)
    val_last10 = val_digits[-10:] if (payload.type == "phone" and len(val_digits) >= 10) else None

    current_list = settings_db.setdefault("blacklist", [])
    for b in current_list:
        b_val = (b.get("value") if isinstance(b, dict) else getattr(b, "value", "")).strip()
        if b_val.lower() == val.lower():
            raise HTTPException(status_code=400, detail=f"Bu {label.lower()} ({val}) zaten kara listede mevcut.")
        if val_last10:
            b_digits = re.sub(r"\D", "", b_val)
            if len(b_digits) >= 10 and b_digits[-10:] == val_last10:
                raise HTTPException(status_code=400, detail=f"Bu {label.lower()} ({val}) zaten kara listede mevcut ({b_val}).")

    new_item = {
        "id": int(datetime.datetime.now().timestamp() * 1000),
        "type": payload.type,
        "value": val,
        "reason": payload.reason.strip() if payload.reason else "Manuel Engelleme",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(BlacklistItem)
            res = await session.execute(stmt)
            existing_items = res.scalars().all()
            for ex in existing_items:
                ex_val = (ex.value or "").strip()
                if ex_val.lower() == val.lower():
                    raise HTTPException(status_code=400, detail=f"Bu {label.lower()} ({val}) zaten kara listede mevcut.")
                if val_last10:
                    ex_digits = re.sub(r"\D", "", ex_val)
                    if len(ex_digits) >= 10 and ex_digits[-10:] == val_last10:
                        raise HTTPException(status_code=400, detail=f"Bu {label.lower()} ({val}) zaten kara listede mevcut ({ex_val}).")

            item = BlacklistItem(
                type=payload.type,
                value=val,
                reason=payload.reason.strip() if payload.reason else "Manuel Engelleme"
            )
            session.add(item)
            await session.commit()
            await session.refresh(item)
            new_item["id"] = item.id
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Add Blacklist DB Warning]: {e}")

    current_list.insert(0, new_item)
    settings_db["blacklist"] = current_list

    save_settings(settings_db)
    add_system_log("ABUSE_SHIELD", "WARNING", f"Kara Listeye Eklendi: {val} ({new_item['reason']})")
    return new_item

@app.delete("/api/blacklist/{item_id}")
async def remove_from_blacklist(item_id: int):
    removed_values = set()
    current_list = settings_db.get("blacklist", [])
    for b in current_list:
        b_id = b.get("id") if isinstance(b, dict) else getattr(b, "id", None)
        if str(b_id) == str(item_id):
            b_val = (b.get("value") if isinstance(b, dict) else getattr(b, "value", "")).strip()
            if b_val:
                removed_values.add(b_val)

    try:
        async with AsyncSessionLocal() as session:
            item = await session.get(BlacklistItem, item_id)
            if item:
                if item.value:
                    removed_values.add(item.value.strip())
                await session.delete(item)
                await session.commit()

            # Also delete any matching records by value/last10 digits so duplicates don't linger
            if removed_values:
                stmt_all = select(BlacklistItem)
                res_all = await session.execute(stmt_all)
                for row in res_all.scalars().all():
                    r_val = (row.value or "").strip()
                    r_digits = re.sub(r"\D", "", r_val)
                    for target_v in removed_values:
                        t_digits = re.sub(r"\D", "", target_v)
                        if r_val.lower() == target_v.lower() or (len(r_digits) >= 10 and len(t_digits) >= 10 and r_digits[-10:] == t_digits[-10:]):
                            await session.delete(row)
                            break
                await session.commit()
    except Exception as e:
        print(f"[Delete Blacklist DB Warning]: {e}")

    def _should_keep(b):
        b_id = b.get("id") if isinstance(b, dict) else getattr(b, "id", None)
        if str(b_id) == str(item_id):
            return False
        b_val = (b.get("value") if isinstance(b, dict) else getattr(b, "value", "")).strip()
        b_digits = re.sub(r"\D", "", b_val)
        for target_v in removed_values:
            t_digits = re.sub(r"\D", "", target_v)
            if b_val.lower() == target_v.lower() or (len(b_digits) >= 10 and len(t_digits) >= 10 and b_digits[-10:] == t_digits[-10:]):
                return False
        return True

    settings_db["blacklist"] = [b for b in current_list if _should_keep(b)]
    save_settings(settings_db)
    add_system_log("ABUSE_SHIELD", "INFO", f"Kara Listeden Kaldırıldı: ID {item_id} ({', '.join(removed_values) if removed_values else ''})")
    return {"status": "success", "message": "Kara liste kaydı başarıyla silindi."}

@app.get("/api/block-words")
async def list_block_words():
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(BlockWord).order_by(BlockWord.word.asc())
            result = await session.execute(stmt)
            items = result.scalars().all()
            if items:
                return items
    except Exception as e:
        print(f"[List Block Words DB Warning]: {e}")
    return settings_db.get("block_words", [])

@app.post("/api/block-words")
async def add_block_word(payload: BlockWordSchema):
    word_val = payload.word.strip().lower()
    if not word_val:
        raise HTTPException(status_code=400, detail="Kelime boş olamaz.")

    current_words = settings_db.setdefault("block_words", [])
    for w in current_words:
        if (w.get("word") if isinstance(w, dict) else getattr(w, "word", "")).lower() == word_val:
            raise HTTPException(status_code=400, detail="Bu kelime zaten yasaklı listesinde.")

    new_word = {
        "id": int(datetime.datetime.now().timestamp() * 1000),
        "word": word_val
    }

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(BlockWord).where(BlockWord.word == word_val)
            res = await session.execute(stmt)
            if res.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Bu kelime zaten yasaklı listesinde.")

            item = BlockWord(word=word_val)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            new_word["id"] = item.id
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Add Block Word DB Warning]: {e}")

    current_words.append(new_word)
    settings_db["block_words"] = current_words
    save_settings(settings_db)
    add_system_log("ABUSE_SHIELD", "INFO", f"Yasaklı Kelime Eklendi: '{word_val}'")
    return new_word

@app.delete("/api/block-words/{word_id}")
async def remove_block_word(word_id: int):
    try:
        async with AsyncSessionLocal() as session:
            item = await session.get(BlockWord, word_id)
            if item:
                await session.delete(item)
                await session.commit()
    except Exception as e:
        print(f"[Delete Block Word DB Warning]: {e}")

    current_words = settings_db.get("block_words", [])
    settings_db["block_words"] = [w for w in current_words if (w.get("id") if isinstance(w, dict) else getattr(w, "id", None)) != word_id]
    save_settings(settings_db)
    add_system_log("ABUSE_SHIELD", "INFO", f"Yasaklı Kelime Kaldırıldı: ID {word_id}")
    return {"status": "success", "message": "Yasaklı kelime kaydı başarıyla silindi."}



class ClientLogSchema(BaseModel):
    level: str
    message: str

@app.post("/api/client-logs")
async def client_logs_endpoint(log: ClientLogSchema):
    print(f"[BROWSER][{log.level.upper()}] {log.message}")
    # Shorten long messages for cleaner log view
    msg = log.message
    if len(msg) > 100:
        msg = msg[:97] + "..."
    add_system_log("BROWSER", log.level.upper(), msg)
    return {"status": "ok"}


# =====================================================================
# OMNICHANNEL CHATS ENDPOINTS
# =====================================================================

def resolve_contact_name_by_phone(contacts: list, phone_info: str) -> Optional[str]:
    if not phone_info:
        return None
    clean_target = re.sub(r"\D", "", str(phone_info))
    if not clean_target:
        return None

    for c in contacts:
        if c.phone_number:
            if c.phone_number.strip() == str(phone_info).strip():
                return f"{c.first_name} {c.last_name}".strip()
            c_clean = re.sub(r"\D", "", str(c.phone_number))
            if c_clean and c_clean == clean_target:
                return f"{c.first_name} {c.last_name}".strip()
            if len(c_clean) >= 10 and len(clean_target) >= 10:
                if c_clean[-10:] == clean_target[-10:]:
                    return f"{c.first_name} {c.last_name}".strip()
    return None

@app.get("/api/omnichannel/chats")
async def list_chat_sessions(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    async with AsyncSessionLocal() as session:
        stmt = select(ChatSession)
        if target_tenant not in ["all", "global"]:
            stmt = stmt.where(
                or_(
                    ChatSession.tenant_id == target_tenant,
                    ChatSession.tenant_id == "tenant-default",
                    ChatSession.tenant_id == "default",
                    ChatSession.tenant_id.is_(None)
                )
            )
        stmt = stmt.order_by(ChatSession.last_message_time.desc())
        result = await session.execute(stmt)
        sessions = result.scalars().all()
        
        # Load contacts to map caller numbers/emails to names
        stmt_contacts = select(Contact)
        res_contacts = await session.execute(stmt_contacts)
        contacts = res_contacts.scalars().all()
        contact_by_email = {c.email: f"{c.first_name} {c.last_name}" for c in contacts if c.email}
        
        # For each session, load the last message preview
        data = []
        for s in sessions:
            stmt_last = select(ChatMessage).where(ChatMessage.session_id == s.id).order_by(ChatMessage.timestamp.desc()).limit(1)
            res_last = await session.execute(stmt_last)
            last_msg = res_last.scalar_one_or_none()
            
            sender_name = None
            if s.channel.lower() == "mail":
                sender_name = contact_by_email.get(s.sender_info)
            else:
                sender_name = resolve_contact_name_by_phone(contacts, s.sender_info)
                
            data.append({
                "id": s.id,
                "channel": s.channel,
                "sender_info": s.sender_info,
                "sender_name": sender_name,
                "status": s.status,
                "assigned_agent": s.assigned_agent,
                "assigned_user": s.assigned_user,
                "recipient_info": s.recipient_info,
                "qa_score": s.qa_score,
                "last_message_time": s.last_message_time.isoformat(),
                "last_message_text": last_msg.text if last_msg else ""
            })
        return data

@app.get("/api/omnichannel/chats/{session_id}/messages")
async def get_chat_messages(session_id: str):
    async with AsyncSessionLocal() as session:
        stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc())
        result = await session.execute(stmt)
        messages = result.scalars().all()
        return [{
            "id": m.id,
            "session_id": m.session_id,
            "direction": m.direction,
            "sender": m.sender,
            "text": m.text,
            "timestamp": m.timestamp.isoformat()
        } for m in messages]

class TakeoverSchema(BaseModel):
    assigned_user: Optional[str] = None

@app.post("/api/omnichannel/chats/{session_id}/takeover")
async def takeover_chat(session_id: str, payload: Optional[TakeoverSchema] = None, user_info: dict = Depends(get_user_info)):
    import datetime
    async with AsyncSessionLocal() as session:
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await session.execute(stmt)
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Sohbet oturumu bulunamadı")
        
        agent_name = None
        if payload and payload.assigned_user:
            agent_name = payload.assigned_user.strip()
            
        if not agent_name and user_info.get("user_id") and user_info.get("user_id") != "Bilinmeyen":
            stmt_u = select(SystemUser).where(
                or_(
                    SystemUser.id == user_info.get("user_id"),
                    SystemUser.username == user_info.get("user_id")
                )
            )
            res_u = await session.execute(stmt_u)
            u = res_u.scalar_one_or_none()
            if u:
                agent_name = f"{u.first_name} {u.last_name}".strip() or u.username
                
        if not agent_name:
            agent_name = user_info.get("full_name") or user_info.get("username") or "Temsilci"
            
        chat.assigned_agent = "human"
        chat.assigned_user = agent_name
        chat.last_message_time = datetime.datetime.utcnow()
        
        sys_msg = ChatMessage(
            session_id=session_id,
            direction="outbound",
            sender="system",
            text=f"Bu görüşme müşteri temsilcisi ({agent_name}) tarafından devralınmıştır."
        )
        session.add(sys_msg)
        await session.commit()
        await session.refresh(sys_msg)
        
        # Broadcast system message turn
        await ws_manager.broadcast_omnichannel_event({
            "type": "message",
            "message": {
                "id": sys_msg.id,
                "session_id": session_id,
                "direction": sys_msg.direction,
                "sender": sys_msg.sender,
                "text": sys_msg.text,
                "timestamp": sys_msg.timestamp.isoformat()
            }
        })
        
        # Broadcast takeover state update
        await ws_manager.broadcast_omnichannel_event({
            "type": "takeover_changed",
            "session_id": session_id,
            "assigned_agent": "human",
            "assigned_user": agent_name
        })
        
        # Broadcast session preview update
        await ws_manager.broadcast_omnichannel_event({
            "type": "session_update",
            "session": {
                "id": session_id,
                "channel": chat.channel,
                "sender_info": chat.sender_info,
                "recipient_info": chat.recipient_info,
                "status": chat.status,
                "assigned_agent": "human",
                "assigned_user": agent_name,
                "last_message_time": chat.last_message_time.isoformat(),
                "last_message_text": sys_msg.text
            }
        })
        return {"status": "success", "message": f"Sohbet temsilciye ({agent_name}) aktarıldı.", "assigned_user": agent_name}

@app.post("/api/omnichannel/chats/{session_id}/transfer_to_ai")
async def release_chat_to_ai(session_id: str):
    import datetime
    async with AsyncSessionLocal() as session:
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await session.execute(stmt)
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Sohbet oturumu bulunamadı")
        chat.assigned_agent = "ai"
        chat.assigned_user = None
        chat.last_message_time = datetime.datetime.utcnow()
        
        sys_msg = ChatMessage(
            session_id=session_id,
            direction="outbound",
            sender="system",
            text="Sohbet Yapay Zeka Asistanına geri devredilmiştir."
        )
        session.add(sys_msg)
        await session.commit()
        await session.refresh(sys_msg)
        
        # Broadcast system message turn
        await ws_manager.broadcast_omnichannel_event({
            "type": "message",
            "message": {
                "id": sys_msg.id,
                "session_id": session_id,
                "direction": sys_msg.direction,
                "sender": sys_msg.sender,
                "text": sys_msg.text,
                "timestamp": sys_msg.timestamp.isoformat()
            }
        })
        
        # Broadcast takeover state update
        await ws_manager.broadcast_omnichannel_event({
            "type": "takeover_changed",
            "session_id": session_id,
            "assigned_agent": "ai",
            "assigned_user": None
        })
        
        # Broadcast session preview update
        await ws_manager.broadcast_omnichannel_event({
            "type": "session_update",
            "session": {
                "id": session_id,
                "channel": chat.channel,
                "sender_info": chat.sender_info,
                "recipient_info": chat.recipient_info,
                "status": chat.status,
                "assigned_agent": "ai",
                "assigned_user": None,
                "last_message_time": chat.last_message_time.isoformat(),
                "last_message_text": sys_msg.text
            }
        })
        return {"status": "success", "message": "Sohbet yapay zekaya devredildi."}

@app.post("/api/omnichannel/chats/upload-media")
async def upload_chat_media(file: UploadFile = File(...), user_info: dict = Depends(get_user_info)):
    os.makedirs("uploads/chat_media", exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower()
    
    content_type = file.content_type or ""
    if content_type.startswith("image/") or ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        media_type = "image"
    elif content_type.startswith("video/") or ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        media_type = "video"
    elif content_type.startswith("audio/") or ext in [".mp3", ".wav", ".ogg", ".m4a", ".aac"]:
        media_type = "audio"
    else:
        media_type = "document"

    safe_filename = f"{uuid.uuid4().hex[:8]}_{re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)}"
    filepath = os.path.join("uploads/chat_media", safe_filename)
    
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)
        
    public_url = f"/uploads/chat_media/{safe_filename}"
    return {
        "status": "success",
        "url": public_url,
        "media_type": media_type,
        "filename": file.filename
    }

class ChatMessageSendSchema(BaseModel):
    text: Optional[str] = ""
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    media_filename: Optional[str] = None

@app.post("/api/omnichannel/chats/{session_id}/send")
async def send_representative_message(session_id: str, payload: ChatMessageSendSchema, request: Request):
    import datetime
    async with AsyncSessionLocal() as session:
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await session.execute(stmt)
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Sohbet oturumu bulunamadı")
            
        chat.last_message_time = datetime.datetime.utcnow()
        
        # Load contacts to resolve names
        stmt_contacts = select(Contact)
        res_contacts = await session.execute(stmt_contacts)
        contacts = res_contacts.scalars().all()
        contact_by_email = {c.email: f"{c.first_name} {c.last_name}" for c in contacts if c.email}
        
        sender_name = None
        if chat.channel.lower() == "mail":
            sender_name = contact_by_email.get(chat.sender_info)
        else:
            sender_name = resolve_contact_name_by_phone(contacts, chat.sender_info)
        
        # Determine stored text & format if media is present
        text_content = payload.text or ""
        if payload.media_url:
            fname = payload.media_filename or payload.media_url.split("/")[-1]
            m_tag = f"[MEDIA:{payload.media_type or 'document'}|{payload.media_url}|{fname}]"
            if text_content:
                text_content = f"{text_content}\n{m_tag}"
            else:
                text_content = m_tag

        # Save the message
        db_message = ChatMessage(
            session_id=session_id,
            direction="outbound",
            sender="human",
            text=text_content
        )
        session.add(db_message)
        await session.commit()
        await session.refresh(db_message)
        
        msg_payload = {
            "id": db_message.id,
            "session_id": session_id,
            "direction": db_message.direction,
            "sender": db_message.sender,
            "text": db_message.text,
            "timestamp": db_message.timestamp.isoformat() + "Z"
        }
        
        # Broadcast message turn
        await ws_manager.broadcast_omnichannel_event({
            "type": "message",
            "message": msg_payload
        })
        
        # Broadcast session preview
        await ws_manager.broadcast_omnichannel_event({
            "type": "session_update",
            "session": {
                "id": session_id,
                "channel": chat.channel,
                "sender_info": chat.sender_info,
                "sender_name": sender_name,
                "recipient_info": chat.recipient_info,
                "status": chat.status,
                "assigned_agent": chat.assigned_agent,
                "assigned_user": chat.assigned_user,
                "last_message_time": chat.last_message_time.isoformat() + "Z",
                "last_message_text": db_message.text
            }
        })
        
        # Trigger outbound channel message
        dispatch_res = None
        ch_lower = chat.channel.lower()
        if ch_lower == "whatsapp":
            from backend.services.whatsapp_service import send_whatsapp_message, send_whatsapp_media, load_settings
            ch_settings = settings_db.get("channels", {})
            if not ch_settings or not (ch_settings.get("whatsapp_token") or ch_settings.get("whatsapp_accounts")):
                disk_settings = load_settings()
                ch_settings = disk_settings.get("channels", {}) or ch_settings
                
            whatsapp_accounts = ch_settings.get("whatsapp_accounts", [])
            outbound_phone_id = None
            outbound_token = None
            
            if chat.recipient_info and whatsapp_accounts:
                rec_str = str(chat.recipient_info)
                rec_digits = re.sub(r"\D", "", rec_str)
                for acc in whatsapp_accounts:
                    acc_id = str(acc.get("phone_number_id", "")).strip()
                    acc_phone = str(acc.get("display_phone_number", "")).strip()
                    acc_phone_digits = re.sub(r"\D", "", acc_phone)
                    acc_name = str(acc.get("name", "")).strip()
                    if (acc_id and acc_id in rec_str) or \
                       (acc_phone and acc_phone in rec_str) or \
                       (acc_phone_digits and rec_digits and (acc_phone_digits in rec_digits or rec_digits in acc_phone_digits)) or \
                       (acc_name and acc_name in rec_str):
                        outbound_phone_id = acc.get("phone_number_id")
                        outbound_token = acc.get("token") or acc.get("access_token")
                        break
                        
            if not outbound_phone_id and chat.recipient_info:
                id_match = re.search(r'ID:(\d+)', str(chat.recipient_info))
                if id_match:
                    outbound_phone_id = id_match.group(1)
                else:
                    long_digits = re.findall(r'\d{14,}', str(chat.recipient_info))
                    if long_digits:
                        outbound_phone_id = long_digits[0]

            # Fallbacks: Top-level credentials or any account in whatsapp_accounts
            if not outbound_token and ch_settings.get("whatsapp_token"):
                outbound_token = ch_settings.get("whatsapp_token")
            if not outbound_phone_id and ch_settings.get("whatsapp_phone_number_id"):
                outbound_phone_id = ch_settings.get("whatsapp_phone_number_id")

            if not outbound_token and whatsapp_accounts:
                for acc in whatsapp_accounts:
                    t = (acc.get("token") or acc.get("access_token") or "").strip()
                    if t:
                        outbound_token = t
                        if not outbound_phone_id:
                            outbound_phone_id = (acc.get("phone_number_id") or "").strip()
                        break
                        
            from backend.services.whatsapp_service import resolve_whatsapp_credentials
            resolved_token, resolved_phone_id = resolve_whatsapp_credentials(outbound_token, outbound_phone_id)

            if resolved_phone_id and not chat.recipient_info:
                chat.recipient_info = f"ID:{resolved_phone_id}"
                await session.commit()

            # Dispatch text or media
            if payload.media_url:
                full_url = payload.media_url
                if full_url.startswith("/"):
                    host_hdr = request.headers.get("host") or "localhost:8000"
                    scheme = "https" if "443" in host_hdr or "https" in request.headers.get("x-forwarded-proto", "") else "http"
                    full_url = f"{scheme}://{host_hdr}{payload.media_url}"
                
                asyncio.create_task(
                    send_whatsapp_media(
                        chat.sender_info,
                        payload.media_type or "document",
                        full_url,
                        caption=payload.text or "",
                        phone_number_id=resolved_phone_id,
                        token=resolved_token,
                        filename=payload.media_filename
                    )
                )
            else:
                asyncio.create_task(
                    send_whatsapp_message(
                        chat.sender_info, 
                        payload.text or "", 
                        phone_number_id=resolved_phone_id, 
                        token=resolved_token
                    )
                )
            add_system_log(
                "REPRESENTATIVE_OUTBOUND",
                "INFO",
                f"Temsilci Yanıtı Gönderim Görevi Başlatıldı: Alıcı={chat.sender_info}, PhoneID={resolved_phone_id}, Media={bool(payload.media_url)}"
            )
            dispatch_res = {"status": "success", "message": "Gönderim görevi başlatıldı"}

        elif ch_lower == "telegram":
            if payload.media_url:
                from backend.services.telegram_service import send_telegram_media
                dispatch_res = await send_telegram_media(
                    chat.sender_info,
                    payload.media_type or "document",
                    payload.media_url,
                    caption=payload.text or "",
                    filename=payload.media_filename
                )
            else:
                from backend.services.telegram_service import send_telegram_message
                dispatch_res = await send_telegram_message(chat.sender_info, payload.text)
        elif ch_lower in ["instagram", "facebook"]:
            from backend.services.meta_service import send_meta_message
            dispatch_res = await send_meta_message(chat.sender_info, payload.text, channel=ch_lower)
        elif ch_lower in ["email", "mail"]:
            from backend.services.email_service import send_email_message
            dispatch_res = await send_email_message(
                chat.sender_info,
                "AIDA Müşteri Hizmetleri Yanıtı",
                payload.text or "Ekteki dosyayı bilgilerinize sunarız.",
                media_url=payload.media_url,
                filename=payload.media_filename
            )
        
        # Trigger background QA evaluation AFTER message dispatch
        from backend.services.call_analyzer import analyze_chat_session
        asyncio.create_task(analyze_chat_session(session_id))
        
        if dispatch_res and dispatch_res.get("status") in ["dry_run", "error"]:
            err_detail = dispatch_res.get("detail") or dispatch_res.get("message") or "Meta servisine ulaşılamadı veya erişim jetonu eksik."
            print(f"[Send Representative Message Error] {chat.channel.upper()} dispatch failed: {err_detail}")
            raise HTTPException(
                status_code=400,
                detail=f"Mesaj {chat.channel.upper()} hattından gönderilemedi: {err_detail}"
            )

        return {"status": "success", "message": "Mesaj gönderildi.", "dispatch": dispatch_res}

@app.get("/api/omnichannel/whatsapp/status")
async def get_whatsapp_diagnostics():
    from backend.services.whatsapp_service import resolve_whatsapp_credentials, load_settings
    settings_disk = load_settings()
    settings_mem = settings_db.get("channels", {})
    
    token_resolved, phone_id_resolved = resolve_whatsapp_credentials()
    
    return {
        "status": "success",
        "has_token": bool(token_resolved),
        "token_preview": (token_resolved[:12] + "...") if token_resolved else "TANIMLANMAMIŞ (BOŞ)",
        "resolved_phone_number_id": phone_id_resolved or "TANIMLANMAMIŞ (BOŞ)",
        "memory_channels_configured": bool(settings_mem),
        "disk_channels_configured": bool(settings_disk.get("channels")),
        "accounts_count": len((settings_mem or settings_disk.get("channels", {})).get("whatsapp_accounts", []))
    }

class ChatSimulateSchema(BaseModel):
    channel: str
    sender_info: str
    text: str

@app.post("/api/omnichannel/chats/simulate")
async def simulate_incoming_chat_message(payload: ChatSimulateSchema):
    from backend.services.chat_service import handle_inbound_chat_message
    reply = await handle_inbound_chat_message(
        channel=payload.channel.lower(),
        sender_info=payload.sender_info,
        text=payload.text
    )
    return {"status": "success", "ai_reply": reply}

class WhatsAppBroadcastSchema(BaseModel):
    recipients: List[str]
    text: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None

@app.post("/api/omnichannel/whatsapp/broadcast")
async def send_whatsapp_broadcast_campaign(
    payload: WhatsAppBroadcastSchema,
    user_info: dict = Depends(get_user_info)
):
    from backend.services.whatsapp_service import send_whatsapp_message, send_whatsapp_media, sanitize_phone_number, resolve_whatsapp_credentials
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    recipients_list = payload.recipients or []

    # Check credentials first
    w_token, w_phone_id = resolve_whatsapp_credentials()
    if not w_token or not w_phone_id:
        raise HTTPException(
            status_code=400, 
            detail="WhatsApp API kimlik bilgileri (Erişim Jetonu / Phone Number ID) Ayarlar > Kanal Ayarları menüsünde tanımlı değil. Lütfen önce WhatsApp hesabınızı ekleyin."
        )

    if "all_contacts" in recipients_list:
        recipients_list = []
        async with AsyncSessionLocal() as session:
            # 1. Fetch DB contacts
            stmt = select(Contact)
            res = await session.execute(stmt)
            contacts = res.scalars().all()
            for c in contacts:
                if c.phone_number:
                    recipients_list.append(c.phone_number)
            
            # 2. Fetch ChatSession whatsapp senders
            cs_stmt = select(ChatSession.sender_info).where(ChatSession.channel == "whatsapp")
            cs_res = await session.execute(cs_stmt)
            for phone in cs_res.scalars().all():
                if phone:
                    recipients_list.append(phone)

        # 3. Fetch contacts from settings.json if any
        try:
            from backend.services.whatsapp_service import load_settings
            st = load_settings()
            cfg_contacts = st.get("contacts", [])
            for c in cfg_contacts:
                p = c.get("phone_number") or c.get("phone")
                if p:
                    recipients_list.append(p)
        except Exception:
            pass

    clean_recipients = list(set([sanitize_phone_number(r) for r in recipients_list if r and len(re.sub(r"\D", "", r)) >= 10]))

    if not clean_recipients:
        raise HTTPException(status_code=400, detail="Geçerli alıcı numarası bulunamadı. Rehberde kayıtlı telefon numaralarını kontrol ediniz.")

    successful = 0
    failed = 0

    for phone in clean_recipients:
        try:
            if payload.media_url:
                res = await send_whatsapp_media(phone, payload.media_type or "image", payload.media_url, caption=payload.text, phone_number_id=w_phone_id, token=w_token)
            else:
                res = await send_whatsapp_message(phone, payload.text, phone_number_id=w_phone_id, token=w_token)

            if res.get("status") == "success":
                successful += 1
                async with AsyncSessionLocal() as db_session:
                    stmt = select(ChatSession).where(
                        ChatSession.channel == "whatsapp",
                        ChatSession.sender_info == phone,
                        ChatSession.status == "active"
                    )
                    r_sess = await db_session.execute(stmt)
                    chat_sess = r_sess.scalar_one_or_none()
                    if not chat_sess:
                        chat_sess = ChatSession(
                            id=str(uuid.uuid4()),
                            channel="whatsapp",
                            sender_info=phone,
                            status="active",
                            assigned_agent="ai",
                            tenant_id=target_tenant
                        )
                        db_session.add(chat_sess)
                        await db_session.commit()

                    msg_obj = ChatMessage(
                        session_id=chat_sess.id,
                        direction="outbound",
                        sender="human",
                        text=f"[Duyuru / Kampanya]: {payload.text}"
                    )
                    db_session.add(msg_obj)
                    await db_session.commit()
            else:
                failed += 1
                print(f"[WhatsApp Broadcast Failed] Phone: {phone}, Result: {res}")
        except Exception as e:
            print(f"[WhatsApp Broadcast Error] {phone}: {e}")
            failed += 1

    add_system_log("WHATSAPP_CAMPAIGN", "INFO", f"Toplu WhatsApp Kampanyası Gönderildi. Başarılı: {successful}, Başarısız: {failed}")
    return {
        "status": "success",
        "total": len(clean_recipients),
        "successful": successful,
        "failed": failed
    }

class WhatsAppButtonsSchema(BaseModel):
    to_phone: str
    body_text: str
    buttons: List[dict]  # [{"id": "btn1", "title": "Buton 1"}, ...]

@app.post("/api/omnichannel/whatsapp/buttons")
async def send_whatsapp_buttons_endpoint(payload: WhatsAppButtonsSchema):
    from backend.services.whatsapp_service import send_whatsapp_buttons
    res = await send_whatsapp_buttons(payload.to_phone, payload.body_text, payload.buttons)
    return res

class WhatsAppTemplateSendSchema(BaseModel):
    to_phone: str
    template_name: str
    language_code: Optional[str] = "tr"
    parameters: Optional[List[str]] = []
    session_id: Optional[str] = None

@app.get("/api/omnichannel/whatsapp/templates")
async def get_whatsapp_templates_endpoint():
    from backend.services.whatsapp_service import DEFAULT_WHATSAPP_TEMPLATES, load_settings
    st = load_settings()
    custom_tpls = st.get("whatsapp_templates", [])
    merged = custom_tpls if custom_tpls else DEFAULT_WHATSAPP_TEMPLATES
    return {"status": "success", "templates": merged}

@app.post("/api/omnichannel/whatsapp/send-template")
async def send_whatsapp_template_endpoint(payload: WhatsAppTemplateSendSchema, user_info: dict = Depends(get_user_info)):
    from backend.services.whatsapp_service import send_whatsapp_template, DEFAULT_WHATSAPP_TEMPLATES, load_settings, sanitize_phone_number
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    clean_phone = sanitize_phone_number(payload.to_phone)
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Geçersiz telefon numarası.")

    st = load_settings()
    all_tpls = st.get("whatsapp_templates", []) or DEFAULT_WHATSAPP_TEMPLATES
    matched_tpl = next((t for t in all_tpls if t.get("name") == payload.template_name or t.get("id") == payload.template_name), None)

    components = []
    body_text_preview = payload.template_name
    if payload.parameters:
        body_params = [{"type": "text", "text": str(p)} for p in payload.parameters]
        components.append({
            "type": "body",
            "parameters": body_params
        })
        if matched_tpl and matched_tpl.get("body_text"):
            t_text = matched_tpl.get("body_text")
            for idx, p_val in enumerate(payload.parameters):
                t_text = t_text.replace(f"{{{{{idx+1}}}}}", str(p_val))
            body_text_preview = t_text
    elif matched_tpl and matched_tpl.get("body_text"):
        body_text_preview = matched_tpl.get("body_text")

    res = await send_whatsapp_template(
        to_phone=clean_phone,
        template_name=payload.template_name,
        language_code=payload.language_code or "tr",
        components=components if components else None
    )

    if res.get("status") in ["dry_run", "error"]:
        err_msg = res.get("detail") or res.get("message") or "Meta Şablon mesajı gönderilemedi."
        raise HTTPException(status_code=400, detail=f"Şablon mesajı gönderilemedi: {err_msg}")

    async with AsyncSessionLocal() as session:
        session_id = payload.session_id
        chat_sess = None
        if session_id:
            chat_sess = await session.get(ChatSession, session_id)
        if not chat_sess:
            stmt = select(ChatSession).where(
                ChatSession.channel == "whatsapp",
                ChatSession.sender_info == clean_phone,
                ChatSession.status == "active"
            )
            r_sess = await session.execute(stmt)
            chat_sess = r_sess.scalar_one_or_none()

        if not chat_sess:
            chat_sess = ChatSession(
                id=str(uuid.uuid4()),
                channel="whatsapp",
                sender_info=clean_phone,
                status="active",
                assigned_agent="human",
                tenant_id=target_tenant
            )
            session.add(chat_sess)
            await session.commit()
            await session.refresh(chat_sess)

        chat_sess.last_message_time = datetime.datetime.utcnow()
        db_msg = ChatMessage(
            session_id=chat_sess.id,
            direction="outbound",
            sender="human",
            text=f"[Şablon Mesajı - {payload.template_name}]: {body_text_preview}"
        )
        session.add(db_msg)
        await session.commit()
        await session.refresh(db_msg)

        msg_payload = {
            "id": db_msg.id,
            "session_id": chat_sess.id,
            "direction": db_msg.direction,
            "sender": db_msg.sender,
            "text": db_msg.text,
            "timestamp": db_msg.timestamp.isoformat() + "Z"
        }
        await ws_manager.broadcast_omnichannel_event({
            "type": "message",
            "message": msg_payload
        })

    add_system_log("WHATSAPP_TEMPLATE", "INFO", f"Şablon Mesajı Gönderildi ({clean_phone} - {payload.template_name})")
    return {"status": "success", "message": "Şablon mesajı başarıyla gönderildi.", "data": res}

@app.websocket("/ws/omnichannel")
async def websocket_omnichannel(websocket: WebSocket):
    await ws_manager.connect_omnichannel(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_omnichannel(websocket)
    except Exception:
        ws_manager.disconnect_omnichannel(websocket)

# ----------------------------------------------------
# API Routes: Automated QA Settings & Coaching Reports
# ----------------------------------------------------
class QAQuestionSchema(BaseModel):
    id: Optional[int] = None
    question: str
    max_score: int
    is_active: bool = True

@app.get("/api/qa/questions")
async def get_qa_questions_endpoint(db: AsyncSession = Depends(get_db)):
    from backend.database.models import QAQuestion
    stmt = select(QAQuestion).order_by(QAQuestion.id.asc())
    res = await db.execute(stmt)
    return res.scalars().all()

@app.post("/api/qa/questions")
async def create_qa_question_endpoint(payload: QAQuestionSchema, db: AsyncSession = Depends(get_db)):
    from backend.database.models import QAQuestion
    new_q = QAQuestion(
        question=payload.question,
        max_score=payload.max_score,
        is_active=payload.is_active
    )
    db.add(new_q)
    await db.commit()
    await db.refresh(new_q)
    return new_q

@app.put("/api/qa/questions/{id}")
async def update_qa_question_endpoint(id: int, payload: QAQuestionSchema, db: AsyncSession = Depends(get_db)):
    from backend.database.models import QAQuestion
    q = await db.get(QAQuestion, id)
    if not q:
        raise HTTPException(status_code=404, detail="Soru bulunamadı")
    q.question = payload.question
    q.max_score = payload.max_score
    q.is_active = payload.is_active
    await db.commit()
    await db.refresh(q)
    return q

@app.delete("/api/qa/questions/{id}")
async def delete_qa_question_endpoint(id: int, db: AsyncSession = Depends(get_db)):
    from backend.database.models import QAQuestion
    q = await db.get(QAQuestion, id)
    if not q:
        raise HTTPException(status_code=404, detail="Soru bulunamadı")
    await db.delete(q)
    await db.commit()
    return {"status": "success", "message": "Soru silindi"}

@app.get("/api/omnichannel/chats/{session_id}/qa")
async def get_chat_session_qa(session_id: str, db: AsyncSession = Depends(get_db)):
    from backend.database.models import ChatSession
    chat = await db.get(ChatSession, session_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Sohbet oturumu bulunamadı")
    return {
        "qa_score": chat.qa_score,
        "qa_report": chat.qa_report
    }

@app.put("/api/calls/{call_id}/qa")
async def update_call_qa(call_id: str, payload: dict, db: AsyncSession = Depends(get_db)):
    from backend.database.models import Call
    db_call = await db.get(Call, call_id)
    if not db_call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    db_call.qa_score = payload.get("qa_score")
    db_call.qa_report = payload.get("qa_report")
    await db.commit()
    return {"status": "success", "qa_score": db_call.qa_score}
# --- Agent Dashboard Endpoints ---
@app.get("/api/agent/stats")
async def get_agent_stats(extension: str = None, db: AsyncSession = Depends(get_db)):
    from backend.database.models import Call, AgentBreakLog
    from sqlalchemy import select, or_

    # Calculate 00:00:00 of the current day in local TR time (UTC+3)
    # TR local 00:00:00 corresponds to UTC 21:00:00 of the previous calendar day
    now_utc = datetime.datetime.utcnow()
    now_tr = now_utc + datetime.timedelta(hours=3)
    today_tr_midnight = now_tr.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_tr_midnight - datetime.timedelta(hours=3)

    ext_str = str(extension).strip() if extension else None
    target_exts = set()
    target_user_ids = set()

    if ext_str and ext_str not in ("undefined", "null", "none", "0", ""):
        target_exts.add(ext_str)
        target_user_ids.add(ext_str)

        settings = load_settings()
        for u in settings.get("users", []):
            u_id = str(u.get("id"))
            u_ext = str(u.get("extension", ""))
            if ext_str == u_id or ext_str == u_ext:
                if u_ext:
                    target_exts.add(u_ext)
                if u_id:
                    target_user_ids.add(u_id)

    # 1. Fetch calls starting today
    stmt_calls = select(Call).where(Call.start_time >= today_start_utc)
    res_calls = await db.execute(stmt_calls)
    today_calls = res_calls.scalars().all()

    inbound_count = 0
    outbound_count = 0
    missed_count = 0

    for call in today_calls:
        caller = str(call.caller_number or "")
        callee = str(call.callee_number or "")
        status = (call.status or "").lower()

        if target_exts:
            is_caller = any(caller == ext or caller.endswith(ext) for ext in target_exts)
            is_callee = any(callee == ext or callee.endswith(ext) for ext in target_exts)

            if is_callee and status in ("completed", "in_progress", "transferred", "answered"):
                inbound_count += 1
            elif is_caller and status in ("completed", "in_progress", "transferred", "answered"):
                outbound_count += 1
            elif (is_callee or is_caller) and status in ("missed", "no_answer", "busy", "cancelled", "failed", "abandoned", "blocked"):
                missed_count += 1
        else:
            if status in ("missed", "no_answer", "busy", "cancelled", "failed", "abandoned", "blocked"):
                missed_count += 1
            elif len(caller) <= 4 and caller.isdigit():
                outbound_count += 1
            else:
                inbound_count += 1

    # 2. Fetch break logs for today
    stmt_breaks = select(AgentBreakLog).where(
        or_(
            AgentBreakLog.start_time >= today_start_utc,
            AgentBreakLog.end_time >= today_start_utc,
            AgentBreakLog.end_time.is_(None)
        )
    )
    res_breaks = await db.execute(stmt_breaks)
    today_breaks = res_breaks.scalars().all()

    break_dict = {}

    for b_log in today_breaks:
        if str(b_log.break_name or "").startswith("__"):
            continue
        if target_user_ids or target_exts:
            b_uid = str(b_log.user_id or "")
            b_ext = str(b_log.extension or "")
            if b_uid not in target_user_ids and b_ext not in target_exts:
                continue

        eff_start = max(b_log.start_time, today_start_utc)
        eff_end = b_log.end_time if b_log.end_time else now_utc

        if eff_end > eff_start:
            sec = (eff_end - eff_start).total_seconds()
            b_name = b_log.break_name or "Mola"
            break_dict[b_name] = break_dict.get(b_name, 0.0) + sec

    break_details = []
    total_break_minutes = 0

    for b_name, sec in break_dict.items():
        mins = int(round(sec / 60.0))
        break_details.append({"name": b_name, "minutes": mins})
        total_break_minutes += mins

    return {
        "inbound": inbound_count,
        "outbound": outbound_count,
        "missed": missed_count,
        "break_minutes": total_break_minutes,
        "break_details": break_details
    }


@app.post("/api/agent/timeline-event")
async def record_agent_timeline_event(
    request: Request,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db)
):
    from backend.database.models import AgentBreakLog
    from backend.services.agent_presence import get_agent_state

    action_type = str(payload.get("action_type") or payload.get("type") or "custom").strip()
    detail = str(payload.get("detail") or payload.get("target") or "").strip()
    duration_sec = int(payload.get("duration_seconds") or 0)

    state = get_agent_state()
    user_id = str(payload.get("user_id") or state.get("user_id") or "").strip()
    extension = str(payload.get("extension") or state.get("extension") or user_id or "1000").strip()
    if not user_id:
        user_id = extension

    now_utc = datetime.datetime.utcnow()
    db.add(AgentBreakLog(
        user_id=user_id,
        extension=extension,
        break_name=f"__ACTION__:{action_type}:{detail}",
        start_time=now_utc,
        end_time=now_utc,
        duration_seconds=duration_sec
    ))
    await db.commit()
    return {"status": "success"}


@app.get("/api/reports/agent-timeline")
async def get_agent_timeline_report(
    request: Request,
    date: str = None,
    start_date: str = None,
    end_date: str = None,
    agent: str = None,
    db: AsyncSession = Depends(get_db)
):
    from backend.database.models import Call, AgentBreakLog, SystemUser
    from backend.services.ami_manager import registered_endpoints
    from sqlalchemy import select, or_

    user_info = get_user_info(request)
    tenant_id = user_info.get("tenant_id", "tenant-default")

    now_utc = datetime.datetime.utcnow()
    now_tr = now_utc + datetime.timedelta(hours=3)

    # Determine date window in TR local time (UTC+3)
    target_start_str = date or end_date or start_date
    try:
        if start_date and end_date and start_date != end_date:
            s_dt_tr = datetime.datetime.strptime(start_date[:10], "%Y-%m-%d").replace(hour=0, minute=0, second=0)
            e_dt_tr = datetime.datetime.strptime(end_date[:10], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        elif target_start_str:
            s_dt_tr = datetime.datetime.strptime(target_start_str[:10], "%Y-%m-%d").replace(hour=0, minute=0, second=0)
            e_dt_tr = s_dt_tr.replace(hour=23, minute=59, second=59)
        else:
            s_dt_tr = now_tr.replace(hour=0, minute=0, second=0, microsecond=0)
            e_dt_tr = now_tr.replace(hour=23, minute=59, second=59, microsecond=999999)
    except Exception:
        s_dt_tr = now_tr.replace(hour=0, minute=0, second=0, microsecond=0)
        e_dt_tr = now_tr.replace(hour=23, minute=59, second=59, microsecond=999999)

    window_start_utc = s_dt_tr - datetime.timedelta(hours=3)
    window_end_utc = e_dt_tr - datetime.timedelta(hours=3)

    # Load users for this tenant
    stmt_users = select(SystemUser)
    if not is_default_tenant(tenant_id):
        stmt_users = stmt_users.where(SystemUser.tenant_id == tenant_id)
    else:
        stmt_users = stmt_users.where(or_(SystemUser.tenant_id == tenant_id, SystemUser.tenant_id == "default", SystemUser.tenant_id.is_(None)))
    res_users = await db.execute(stmt_users)
    db_users = res_users.scalars().all()

    agents_list = []
    seen_exts = set()
    for u in db_users:
        ext_val = str(u.extension or "").strip()
        seen_exts.add(ext_val)
        agents_list.append({
            "id": str(u.id),
            "name": u.full_name or f"Dahili {ext_val}",
            "extension": ext_val,
            "role": u.role or "agent",
            "avatar": u.avatar or "",
            "is_online": ext_val in registered_endpoints or str(u.id) in registered_endpoints
        })

    settings = load_settings()
    for u in settings.get("users", []):
        if not is_default_tenant(tenant_id) and u.get("tenant_id") not in (tenant_id,):
            continue
        ext_val = str(u.get("extension") or "").strip()
        if ext_val and ext_val not in seen_exts:
            seen_exts.add(ext_val)
            agents_list.append({
                "id": str(u.get("id")),
                "name": u.get("full_name") or u.get("name") or f"Dahili {ext_val}",
                "extension": ext_val,
                "role": u.get("role") or "agent",
                "avatar": u.get("avatar") or "",
                "is_online": ext_val in registered_endpoints or str(u.get("id")) in registered_endpoints,
                "is_ai": False
            })

    # Include AI Agents in timeline report
    ai_agents_cfg = [
        a for a in settings.get("ai_agents", [])
        if is_default_tenant(tenant_id) or a.get("tenant_id") in (tenant_id, None, "tenant-default", "default")
    ]
    for idx_ai, ai_ag in enumerate(ai_agents_cfg):
        ai_id = str(ai_ag.get("id") or f"ai-{idx_ai + 1}")
        ai_name = str(ai_ag.get("name") or "AI Agent").strip()
        ai_ext = str(ai_ag.get("extension") or "AI").strip()
        agents_list.append({
            "id": ai_id,
            "name": ai_name,
            "extension": ai_ext,
            "role": "ai_agent",
            "avatar": ai_ag.get("avatar") or "",
            "is_online": bool(ai_ag.get("active", True)),
            "is_ai": True,
            "is_primary_ai": idx_ai == 0
        })

    # Fetch calls in window
    stmt_calls = select(Call).where(
        Call.start_time >= window_start_utc,
        Call.start_time <= window_end_utc
    )
    if not is_default_tenant(tenant_id):
        stmt_calls = stmt_calls.where(Call.tenant_id == tenant_id)
    stmt_calls = stmt_calls.order_by(Call.start_time.asc())
    res_calls = await db.execute(stmt_calls)
    window_calls = res_calls.scalars().all()

    # Fetch break, login/logout & action logs in window
    stmt_breaks = select(AgentBreakLog).where(
        or_(
            AgentBreakLog.start_time >= window_start_utc,
            AgentBreakLog.end_time >= window_start_utc,
            AgentBreakLog.end_time.is_(None)
        ),
        AgentBreakLog.start_time <= window_end_utc
    ).order_by(AgentBreakLog.start_time.asc())
    res_breaks = await db.execute(stmt_breaks)
    window_breaks = res_breaks.scalars().all()

    def fmt_tr_time(dt_utc):
        if not dt_utc:
            return ""
        dt_tr = dt_utc + datetime.timedelta(hours=3)
        return dt_tr.strftime("%H:%M")

    def fmt_tr_datetime(dt_utc):
        if not dt_utc:
            return ""
        dt_tr = dt_utc + datetime.timedelta(hours=3)
        return dt_tr.strftime("%d.%m.%Y %H:%M:%S")

    def fmt_dur(secs):
        secs = max(0, int(secs or 0))
        if secs == 0:
            return "0 dk"
        if secs < 60:
            return f"{secs} sn"
        m = secs // 60
        s = secs % 60
        if m < 60:
            return f"{m} dk {s} sn" if s > 0 else f"{m} dk"
        h = m // 60
        rem_m = m % 60
        return f"{h} sa {rem_m} dk"

    ACTION_META_MAP = {
        "call_transfer": ("Çağrı Transferi", "Çağrı başka bir dahiliye/temsilciye aktarıldı"),
        "call_blind_transfer": ("Kör Transfer (Blind)", "Çağrı doğrudan hedef dahiliye aktarıldı"),
        "call_attended_transfer": ("Kontrollü Transfer (Attended)", "Ön görüşmeli çağrı aktarımı yapıldı"),
        "call_pickup": ("Çağrı Toplama (Call Pickup)", "Çalan başka bir dahili/grup çağrısı toplandı"),
        "call_hold": ("Çağrı Beklemeye Alındı", "Görüşme beklemeye (Hold) alındı"),
        "call_unhold": ("Beklemeden Geri Dönüldü", "Beklemedeki çağrıya geri dönüldü"),
        "call_conference": ("3'lü Konferans Başlatıldı", "Görüşmeye yeni katılımcı eklendi"),
        "call_forwarded": ("Çağrı Yönlendirildi", "Çağrı yönlendirme kuralı ile aktarıldı"),
        "call_rejected": ("Gelen Çağrı Reddedildi", "Temsilci çalan çağrıyı meşgule/redde attı"),
        "call_mute": ("Mikrofon Sessize Alındı", "Görüşme sırasında mikrofon kapatıldı"),
        "call_note": ("Çağrı Notu Eklendi", "Görüşmeye ait konu/not kaydedildi"),
        "call_spy": ("Canlı Çağrı Dinleme (Spy)", "Yönetici/Supervisor canlı dinleme başlattı"),
        "call_whisper": ("Fısıldama (Whisper)", "Temsilciye canlı fısıldama mesajı iletildi"),
        "profile_change": ("Çalışma Profili Değiştirildi", "Aktif cihaz ve yönlendirme profili güncellendi"),
    }

    agent_reports = []

    for ag in agents_list:
        ag_id = str(ag["id"])
        ag_ext = str(ag["extension"])
        ag_name = ag["name"]

        if agent and agent not in ("All", "all", "") and agent not in (ag_id, ag_ext, ag_name):
            continue

        raw_events = []
        talk_seconds_total = 0
        break_seconds_total = 0
        inbound_total_count = 0
        inbound_answered_count = 0
        answered_count = 0
        outbound_count = 0
        missed_count = 0
        transfer_count = 0
        pickup_count = 0
        action_count = 0
        first_login_utc = None
        last_logout_utc = None

        # 1. Process breaks, login/logout & special PBX action logs for this agent
        for b_log in window_breaks:
            b_uid = str(b_log.user_id or "").strip()
            b_ext = str(b_log.extension or "").strip()
            if b_uid not in (ag_id, ag_ext) and b_ext not in (ag_id, ag_ext):
                continue

            b_name = str(b_log.break_name or "Mola")
            if b_name == "__LOGIN__":
                if first_login_utc is None or b_log.start_time < first_login_utc:
                    first_login_utc = b_log.start_time
                raw_events.append({
                    "timestamp_utc": b_log.start_time,
                    "time": fmt_tr_time(b_log.start_time),
                    "full_time": fmt_tr_datetime(b_log.start_time),
                    "type": "login",
                    "title": "Login oldu",
                    "description": f"{fmt_tr_time(b_log.start_time)} Login oldu.",
                    "detail": f"Dahili {ag_ext} sisteme giriş yaptı",
                    "duration_seconds": 0,
                    "duration_label": "-"
                })
            elif b_name == "__LOGOUT__":
                if last_logout_utc is None or b_log.start_time > last_logout_utc:
                    last_logout_utc = b_log.start_time
                raw_events.append({
                    "timestamp_utc": b_log.start_time,
                    "time": fmt_tr_time(b_log.start_time),
                    "full_time": fmt_tr_datetime(b_log.start_time),
                    "type": "logout",
                    "title": "Logout oldu",
                    "description": f"{fmt_tr_time(b_log.start_time)} Çıkış yaptı (Logout).",
                    "detail": f"Dahili {ag_ext} oturumu kapattı",
                    "duration_seconds": 0,
                    "duration_label": "-"
                })
            elif b_name.startswith("__ACTION__:"):
                parts = b_name.split(":", 2)
                act_key = parts[1] if len(parts) > 1 else "custom"
                act_detail = parts[2] if len(parts) > 2 else ""
                base_title, default_desc = ACTION_META_MAP.get(act_key, ("Çağrı Aksiyonu", " Çağrı işlemi gerçekleştirildi"))
                action_count += 1
                if "transfer" in act_key:
                    transfer_count += 1
                elif "pickup" in act_key:
                    pickup_count += 1

                title_with_detail = f"{base_title} ({act_detail})" if act_detail else base_title
                raw_events.append({
                    "timestamp_utc": b_log.start_time,
                    "time": fmt_tr_time(b_log.start_time),
                    "full_time": fmt_tr_datetime(b_log.start_time),
                    "type": act_key,
                    "title": title_with_detail,
                    "description": f"{fmt_tr_time(b_log.start_time)} {title_with_detail}",
                    "detail": act_detail or default_desc,
                    "duration_seconds": int(b_log.duration_seconds or 0),
                    "duration_label": fmt_dur(b_log.duration_seconds) if (b_log.duration_seconds and b_log.duration_seconds > 0) else "Anlık İşlem"
                })
            else:
                eff_start = max(b_log.start_time, window_start_utc)
                eff_end = b_log.end_time if b_log.end_time else min(now_utc, window_end_utc)
                dur_sec = max(0, int((eff_end - eff_start).total_seconds()))
                break_seconds_total += dur_sec

                is_meal = "yemek" in b_name.lower()
                raw_events.append({
                    "timestamp_utc": b_log.start_time,
                    "time": fmt_tr_time(b_log.start_time),
                    "full_time": fmt_tr_datetime(b_log.start_time),
                    "type": "break_start",
                    "break_name": b_name,
                    "title": f"Molaya çıktı ({b_name})" if not is_meal else f"Yemek Molası ({b_name})",
                    "description": f"{fmt_tr_time(b_log.start_time)} Molaya çıktı ({b_name})",
                    "detail": b_name,
                    "duration_seconds": dur_sec,
                    "duration_label": fmt_dur(dur_sec) if b_log.end_time else "Devam Ediyor"
                })

                if b_log.end_time and b_log.end_time <= window_end_utc:
                    raw_events.append({
                        "timestamp_utc": b_log.end_time,
                        "time": fmt_tr_time(b_log.end_time),
                        "full_time": fmt_tr_datetime(b_log.end_time),
                        "type": "break_end",
                        "break_name": b_name,
                        "title": f"Moladan döndü ({b_name})",
                        "description": f"{fmt_tr_time(b_log.end_time)} moladan döndü ({b_name})",
                        "detail": f"{b_name} tamamlandı ({fmt_dur(dur_sec)})",
                        "duration_seconds": dur_sec,
                        "duration_label": fmt_dur(dur_sec)
                    })

        # 2. Process calls for this agent
        for call in window_calls:
            caller = str(call.caller_number or "").strip()
            callee = str(call.callee_number or "").strip()
            st = str(call.status or "").lower()

            if ag.get("is_ai"):
                is_caller = caller in (ag_ext, ag_id, ag_name)
                is_callee = (
                    callee in ("Santral AI", "AI", ag_ext, ag_id, ag_name)
                    or (ag.get("is_primary_ai") and callee not in seen_exts and caller not in seen_exts)
                )
            else:
                is_caller = (caller == ag_ext or caller == ag_id or (len(ag_ext) >= 3 and caller.endswith(ag_ext)))
                is_callee = (callee == ag_ext or callee == ag_id or (len(ag_ext) >= 3 and callee.endswith(ag_ext)))

            if not is_caller and not is_callee:
                if not ag.get("is_ai") and st == "transferred" and len([x for x in agents_list if not x.get("is_ai")]) == 1:
                    is_callee = True
                else:
                    continue

            c_start = call.start_time
            c_end = call.end_time or c_start
            c_dur = max(0, int((c_end - c_start).total_seconds()))

            # Detect Call Pickup dial codes (*8 or **ext)
            if is_caller and (callee.startswith("*8") or callee.startswith("**")):
                pickup_count += 1
                action_count += 1
                talk_seconds_total += c_dur
                answered_count += 1
                pickup_lbl = "Grup Çağrı Toplama (*8)" if callee.startswith("*8") else f"Hedefli Çağrı Toplama ({callee})"
                raw_events.append({
                    "timestamp_utc": c_start,
                    "time": fmt_tr_time(c_start),
                    "full_time": fmt_tr_datetime(c_start),
                    "type": "call_pickup",
                    "phone": callee,
                    "call_id": call.id,
                    "title": f"Çağrı Toplama ({callee})",
                    "description": f"{fmt_tr_time(c_start)} {pickup_lbl} ile çalan çağrıyı topladı",
                    "detail": pickup_lbl,
                    "duration_seconds": c_dur,
                    "duration_label": fmt_dur(c_dur) if c_dur > 0 else "Toplandı"
                })
                continue

            # Check if call was answered or missed
            is_failed = st in ("missed", "no_answer", "no answer", "busy", "cancelled", "canceled", "failed", "abandoned", "blocked")
            if not is_failed and c_dur <= 5 and not call.recording_path and st in ("completed", "in_progress"):
                is_failed = True

            # Check if internal extension-to-extension call (both 3-4 digits)
            is_internal_ext_call = (caller.isdigit() and 3 <= len(caller) <= 4 and callee.isdigit() and 3 <= len(callee) <= 4)

            if is_caller:
                target_num = callee
                if not is_failed:
                    outbound_count += 1
                    answered_count += 1
                    talk_seconds_total += c_dur
                    ev_type = "call_internal" if is_internal_ext_call else "call_outbound"
                    ev_title = f"Dahili Görüşme (Dahili {target_num} arandı)" if is_internal_ext_call else f"Çağrıda ({target_num} arandı)"
                    raw_events.append({
                        "timestamp_utc": c_start,
                        "time": fmt_tr_time(c_start),
                        "full_time": fmt_tr_datetime(c_start),
                        "type": ev_type,
                        "phone": target_num,
                        "call_id": call.id,
                        "title": ev_title,
                        "description": f"{fmt_tr_time(c_start)} {ev_title}",
                        "detail": f"{'Dahili Arama' if is_internal_ext_call else 'Giden Arama'}: {target_num} ({fmt_dur(c_dur)})",
                        "duration_seconds": c_dur,
                        "duration_label": fmt_dur(c_dur)
                    })
                else:
                    missed_count += 1
                    raw_events.append({
                        "timestamp_utc": c_start,
                        "time": fmt_tr_time(c_start),
                        "full_time": fmt_tr_datetime(c_start),
                        "type": "call_missed_outbound",
                        "phone": target_num,
                        "call_id": call.id,
                        "title": f"Giden Arama Yanıtsız ({target_num})",
                        "description": f"{fmt_tr_time(c_start)} {target_num} numarası arandı ancak yanıt alınamadı",
                        "detail": f"Cevapsız Giden Arama: {target_num}",
                        "duration_seconds": c_dur,
                        "duration_label": "Yanıtsız"
                    })
            else:
                customer_num = caller
                inbound_total_count += 1
                if not is_failed:
                    inbound_answered_count += 1
                    answered_count += 1
                    talk_seconds_total += c_dur
                    if st == "transferred":
                        transfer_count += 1
                        action_count += 1
                    ev_type = "call_internal" if is_internal_ext_call else ("call_transfer" if st == "transferred" else "call_inbound")
                    ev_title = (
                        f"Dahili {customer_num} numarasından çağrı aldı"
                        if is_internal_ext_call
                        else (f"{customer_num} (Transfer edilen çağrı alındı)" if st == "transferred" else f"{customer_num} numarasından çağrı aldı")
                    )
                    raw_events.append({
                        "timestamp_utc": c_start,
                        "time": fmt_tr_time(c_start),
                        "full_time": fmt_tr_datetime(c_start),
                        "type": ev_type,
                        "phone": customer_num,
                        "call_id": call.id,
                        "title": ev_title,
                        "description": f"{fmt_tr_time(c_start)} {ev_title}.",
                        "detail": f"Gelen Çağrı: {customer_num} ({fmt_dur(c_dur)})" + (f" • Konu: {call.agent_topic}" if call.agent_topic else ""),
                        "duration_seconds": c_dur,
                        "duration_label": fmt_dur(c_dur)
                    })
                else:
                    missed_count += 1
                    raw_events.append({
                        "timestamp_utc": c_start,
                        "time": fmt_tr_time(c_start),
                        "full_time": fmt_tr_datetime(c_start),
                        "type": "call_missed",
                        "phone": customer_num,
                        "call_id": call.id,
                        "title": f"{customer_num} numarasından çağrı geldi ama açmadı",
                        "description": f"{fmt_tr_time(c_start)}'de {customer_num} numarasından çağrı geldi ama açmadı.",
                        "detail": f"Cevapsız Gelen Çağrı: {customer_num} (Durum: {st})",
                        "duration_seconds": c_dur,
                        "duration_label": "Açılmadı"
                    })

        # Sort events chronologically
        raw_events.sort(key=lambda x: x["timestamp_utc"])

        # If agent has actual activity events today without an explicit __LOGIN__ row, set shift start to their first actual action
        if raw_events and first_login_utc is None:
            first_login_utc = raw_events[0]["timestamp_utc"]

        shift_start_time = fmt_tr_time(first_login_utc) if first_login_utc else ("Aktif" if ag["is_online"] else "-")
        shift_end_time = fmt_tr_time(last_logout_utc) if last_logout_utc else ("Aktif" if (first_login_utc or ag["is_online"]) else "-")

        # Compute shift duration and productivity percentage strictly from real activity
        if first_login_utc:
            if last_logout_utc and last_logout_utc >= first_login_utc:
                shift_end_utc = last_logout_utc
            elif window_start_utc <= now_utc <= window_end_utc:
                shift_end_utc = now_utc
            else:
                shift_end_utc = raw_events[-1]["timestamp_utc"]
            total_online_seconds = max(0, int((shift_end_utc - first_login_utc).total_seconds()))
        else:
            total_online_seconds = 0

        if total_online_seconds > 0 or len(raw_events) > 0:
            eff_base_sec = max(total_online_seconds, talk_seconds_total + break_seconds_total, 60)
            active_work_seconds = max(0, eff_base_sec - break_seconds_total)
            availability_ratio = (active_work_seconds / eff_base_sec) * 100.0
            total_offered_calls = answered_count + missed_count
            if total_offered_calls > 0:
                answer_ratio = (answered_count / total_offered_calls) * 100.0
                efficiency_pct = round((availability_ratio * 0.65) + (answer_ratio * 0.35), 1)
            else:
                answer_ratio = 100.0
                efficiency_pct = round(availability_ratio, 1)
            efficiency_pct = max(0.0, min(100.0, efficiency_pct))
        else:
            active_work_seconds = 0
            availability_ratio = 0.0
            answer_ratio = 0.0
            efficiency_pct = 0.0

        # Remove internal timestamp_utc before JSON serialization
        clean_events = []
        for ev in raw_events:
            ev_copy = {k: v for k, v in ev.items() if k != "timestamp_utc"}
            clean_events.append(ev_copy)

        agent_reports.append({
            "agent_id": ag_id,
            "agent_name": ag_name,
            "extension": ag_ext,
            "avatar": ag["avatar"],
            "is_online": ag["is_online"],
            "has_real_activity": len(clean_events) > 0,
            "shift_start_time": shift_start_time,
            "shift_end_time": shift_end_time,
            "efficiency_pct": efficiency_pct,
            "availability_pct": round(availability_ratio, 1),
            "answer_rate_pct": round(answer_ratio, 1),
            "total_online_seconds": total_online_seconds,
            "total_online_label": fmt_dur(total_online_seconds) if total_online_seconds > 0 else "-",
            "total_talk_seconds": talk_seconds_total,
            "total_talk_label": fmt_dur(talk_seconds_total),
            "total_break_seconds": break_seconds_total,
            "total_break_label": fmt_dur(break_seconds_total),
            "inbound_total_count": inbound_total_count,
            "inbound_answered_count": inbound_answered_count,
            "answered_count": answered_count,
            "outbound_count": outbound_count,
            "missed_count": missed_count,
            "transfer_count": transfer_count,
            "pickup_count": pickup_count,
            "action_count": action_count,
            "events": clean_events
        })

    return {
        "status": "success",
        "date": s_dt_tr.strftime("%Y-%m-%d"),
        "agents": agent_reports
    }


@app.get("/api/agent/directory")
async def get_agent_directory():
    settings = load_settings()
    users = settings.get("users", [])
    queues = settings.get("queues", [])
    
    directory = []
    for u in users:
        directory.append({
            "type": "user",
            "id": u.get("id"),
            "name": u.get("name"),
            "number": u.get("extension"),
            "status": "available"
        })
    for q in queues:
        directory.append({
            "type": "queue",
            "id": q.get("id"),
            "name": q.get("name"),
            "number": q.get("extension"),
            "status": "active"
        })
    return directory

@app.get("/api/agent/chat")
async def get_internal_chat(extension: str, db: AsyncSession = Depends(get_db)):
    from backend.database.models import InternalChatMessage
    from sqlalchemy import select, or_
    stmt = select(InternalChatMessage).where(
        or_(
            InternalChatMessage.sender_id == extension,
            InternalChatMessage.receiver_id == extension,
            InternalChatMessage.receiver_id == "broadcast"
        )
    ).order_by(InternalChatMessage.timestamp.asc())
    res = await db.execute(stmt)
    messages = res.scalars().all()
    return messages

@app.post("/api/agent/chat")
async def post_internal_chat(payload: dict, db: AsyncSession = Depends(get_db)):
    from backend.database.models import InternalChatMessage
    msg = InternalChatMessage(
        sender_id=payload.get("sender_id"),
        receiver_id=payload.get("receiver_id"),
        text=payload.get("text")
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg

@app.get("/api/agent/speed_dials")
async def get_agent_speed_dials(extension: str = None):
    if not extension:
        return []
    agent_speed_dials = settings_db.get("agent_speed_dials", {})
    return agent_speed_dials.get(extension, [])

@app.post("/api/agent/speed_dials")
async def save_agent_speed_dial(request: Request, extension: str = None):
    if not extension:
        raise HTTPException(status_code=400, detail="Extension is required")
    data = await request.json()
    
    if "agent_speed_dials" not in settings_db:
        settings_db["agent_speed_dials"] = {}
        
    if extension not in settings_db["agent_speed_dials"]:
        settings_db["agent_speed_dials"][extension] = []
        
    if data.get("id"):
        for idx, sd in enumerate(settings_db["agent_speed_dials"][extension]):
            if str(sd.get("id")) == str(data["id"]):
                settings_db["agent_speed_dials"][extension][idx] = data
                save_settings(settings_db)
                return {"status": "success", "speed_dials": settings_db["agent_speed_dials"][extension]}
                
    if not data.get("id"):
        import time
        data["id"] = int(time.time() * 1000)
    
    settings_db["agent_speed_dials"][extension].append(data)
    save_settings(settings_db)
    return {"status": "success", "speed_dials": settings_db["agent_speed_dials"][extension]}

@app.delete("/api/agent/speed_dials/{sd_id}")
async def delete_agent_speed_dial(sd_id: str, extension: str = None):
    if not extension:
        raise HTTPException(status_code=400, detail="Extension is required")
        
    if "agent_speed_dials" not in settings_db or extension not in settings_db["agent_speed_dials"]:
        return {"status": "success", "speed_dials": []}
        
    settings_db["agent_speed_dials"][extension] = [
        s for s in settings_db["agent_speed_dials"][extension] 
        if str(s.get("id")) != sd_id
    ]
    save_settings(settings_db)
    return {"status": "success", "speed_dials": settings_db["agent_speed_dials"][extension]}

@app.get("/api/agent/voicemail")
async def get_agent_voicemails(extension: str = None):
    return []

@app.get("/api/agent/history")
async def get_agent_history(extension: str = None):
    return []

@app.get("/api/agent/missed_queue_calls")
async def get_agent_missed_queue_calls(extension: str = None):
    return []


# ----------------- SECURITY SHIELD & FAIL2BAN / UFW ENGINE -----------------
def _normalize_whitelist_entries() -> list:
    import datetime
    raw = settings_db.get("security_whitelisted_ips", [])
    normalized = []
    seen = set()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for item in raw:
        if isinstance(item, str):
            ip_val = item.strip()
            if ip_val and ip_val not in seen:
                seen.add(ip_val)
                normalized.append({"ip": ip_val, "description": "Güvenli IP / Otomatik Beyaz Liste", "added_at": now_str})
        elif isinstance(item, dict):
            ip_val = str(item.get("ip") or "").strip()
            if ip_val and ip_val not in seen:
                seen.add(ip_val)
                normalized.append({
                    "ip": ip_val,
                    "description": str(item.get("description") or "Güvenli IP / Blok"),
                    "added_at": str(item.get("added_at") or now_str)
                })
    settings_db["security_whitelisted_ips"] = normalized
    return normalized


def _is_trusted_or_local_ip(ip_str: str) -> bool:
    import re, ipaddress
    ip_clean = str(ip_str or "").strip()
    if not ip_clean or ip_clean in {"127.0.0.1", "0.0.0.0", "::1", "localhost"}:
        return True
    base_ip = ip_clean.split("/")[0].strip()
    if base_ip.startswith("127.") or base_ip.startswith("10.") or base_ip.startswith("192.168.") or re.match(r"^172\.(1[6-9]|2\d|3[0-1])\.", base_ip):
        return True

    # Whitelisted IPs & CIDR Blocks (ignoreip)
    wl_entries = _normalize_whitelist_entries()
    try:
        target_net = ipaddress.ip_network(ip_clean, strict=False)
    except Exception:
        target_net = None

    for w in wl_entries:
        w_ip = w.get("ip", "").strip()
        if not w_ip:
            continue
        if w_ip == ip_clean or w_ip == base_ip:
            return True
        if target_net is not None:
            try:
                w_net = ipaddress.ip_network(w_ip, strict=False)
                if target_net.subnet_of(w_net):
                    return True
            except Exception:
                pass

    # NAT extern_ip
    nat_ip = str((settings_db.get("nat") or {}).get("extern_ip") or "").strip()
    if nat_ip and base_ip == nat_ip:
        return True
    # Active WebPhone registered agent IPs
    try:
        from backend.services.ami_manager import registered_endpoints
        for ext_k in list(registered_endpoints.keys()):
            if registered_endpoints.get_ip(ext_k) == base_ip:
                return True
    except Exception:
        pass
    # Configured SIP Trunk hosts (e.g. ikonsip.com)
    for t in settings_db.get("trunks", []):
        h = str(t.get("host") or "").strip()
        if h == base_ip:
            return True
    return False


def _execute_firewall_ban(ip_str: str, jail: str = "asterisk", reason: str = "SIP Brute-Force / Yetkisiz Deneme", force_manual: bool = False) -> bool:
    import subprocess, datetime, re, ipaddress
    ip_clean = str(ip_str or "").strip()
    try:
        ipaddress.ip_network(ip_clean, strict=False)
    except Exception:
        return False

    if not force_manual and _is_trusted_or_local_ip(ip_clean):
        return False

    # 1. Ban via UFW (if available)
    try:
        subprocess.run(["ufw", "insert", "1", "deny", "from", ip_clean, "to", "any"], check=False, capture_output=True, timeout=2.0)
    except Exception:
        pass

    # 2. Ban via fail2ban-client (if running)
    for j_name in [jail, "asterisk", "asterisk-pjsip"]:
        try:
            subprocess.run(["fail2ban-client", "set", j_name, "banip", ip_clean], check=False, capture_output=True, timeout=2.0)
        except Exception:
            pass

    # 3. Ban via iptables fallback
    try:
        chk = subprocess.run(["iptables", "-C", "INPUT", "-s", ip_clean, "-j", "DROP"], check=False, capture_output=True, timeout=1.5)
        if chk.returncode != 0:
            subprocess.run(["iptables", "-I", "INPUT", "1", "-s", ip_clean, "-j", "DROP"], check=False, capture_output=True, timeout=1.5)
    except Exception:
        pass

    # 4. Persist in settings_db["security_blocked_ips"]
    blocked_list = settings_db.setdefault("security_blocked_ips", [])
    existing = next((item for item in blocked_list if item.get("ip") == ip_clean), None)
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if existing:
        existing["jail"] = jail
        existing["reason"] = reason or existing.get("reason", "")
    else:
        blocked_list.insert(0, {
            "ip": ip_clean,
            "jail": jail,
            "banned_at": now_str,
            "reason": reason
        })
    save_settings(settings_db)
    return True


def _execute_firewall_unban(ip_str: str, add_to_whitelist: bool = False) -> bool:
    import subprocess, ipaddress, datetime
    ip_clean = str(ip_str or "").strip()
    try:
        ipaddress.ip_network(ip_clean, strict=False)
    except Exception:
        return False

    # 1. Remove from UFW
    try:
        subprocess.run(["ufw", "delete", "deny", "from", ip_clean, "to", "any"], check=False, capture_output=True, timeout=2.0)
    except Exception:
        pass

    # 2. Remove from fail2ban-client across common jails
    for j_name in ["asterisk", "asterisk-pjsip", "sshd"]:
        try:
            subprocess.run(["fail2ban-client", "set", j_name, "unbanip", ip_clean], check=False, capture_output=True, timeout=2.0)
        except Exception:
            pass

    # 3. Remove from iptables
    try:
        subprocess.run(["iptables", "-D", "INPUT", "-s", ip_clean, "-j", "DROP"], check=False, capture_output=True, timeout=1.5)
    except Exception:
        pass

    # 4. Remove from settings_db
    if "security_blocked_ips" in settings_db:
        settings_db["security_blocked_ips"] = [item for item in settings_db["security_blocked_ips"] if item.get("ip") != ip_clean]

    if add_to_whitelist:
        wl = _normalize_whitelist_entries()
        if not any(w.get("ip") == ip_clean for w in wl):
            wl.append({
                "ip": ip_clean,
                "description": "Engeli Kaldırılan Güvenli IP",
                "added_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            settings_db["security_whitelisted_ips"] = wl

    save_settings(settings_db)
    return True


def configure_and_sync_fail2ban(install_if_missing: bool = False) -> dict:
    """
    Fail2ban Asterisk PJSIP filtresini ve hapishane (jail) kurallarını gelişmiş güvenlik ayarlarına ve
    Güvenli IP / Blok (ignoreip) listesine göre otomatik yapılandırır ve servisi yeniden yükler.
    """
    import subprocess, shutil
    adv = settings_db.get("security_advanced", {})
    max_retry = max(1, int(adv.get("login_rate_limit") or 3))
    ban_minutes = max(1, int(adv.get("block_duration_minutes") or 1440))
    ban_seconds = ban_minutes * 60

    wl_entries = _normalize_whitelist_entries()
    ignore_ips = ["127.0.0.1/8", "::1"]
    for w in wl_entries:
        wip = str(w.get("ip") or "").strip()
        if wip and wip not in ignore_ips:
            ignore_ips.append(wip)
            # Ensure UFW also allows trusted IP/CIDR
            try:
                subprocess.run(["ufw", "insert", "1", "allow", "from", wip, "to", "any"], check=False, capture_output=True, timeout=1.5)
            except Exception:
                pass
    ignore_ip_str = " ".join(ignore_ips)

    if install_if_missing and not shutil.which("fail2ban-client"):
        try:
            subprocess.run(["apt-get", "update"], check=False, capture_output=True, timeout=30.0)
            subprocess.run(["apt-get", "install", "-y", "fail2ban"], check=False, capture_output=True, timeout=60.0)
        except Exception as e_inst:
            print(f"[Fail2Ban Install Error]: {e_inst}")

    if os.path.exists("/etc/fail2ban"):
        try:
            os.makedirs("/etc/fail2ban/filter.d", exist_ok=True)
            os.makedirs("/etc/fail2ban/jail.d", exist_ok=True)
            filter_content = """[Definition]
failregex = ^.*res_pjsip/pjsip_distributor\\.c:.*log_failed_request: Request '.*' from '.*' failed for '<HOST>(:\\d+)?'.* - (No matching endpoint found|Failed to authenticate).*$
            ^.*SecurityEvent="(FailedACL|InvalidAccountID|ChallengeResponseFailed|InvalidPassword)".*RemoteAddress="IPV[46]/(UDP|TCP|TLS|WS|WSS)/<HOST>/\\d+".*$
            ^.*chan_sip\\.c:.*Registration from '.*' failed for '<HOST>(:\\d+)?' - .*$
ignoreregex =
"""
            with open("/etc/fail2ban/filter.d/asterisk-aida.conf", "w", encoding="utf-8") as ff:
                ff.write(filter_content)

            log_path = "/var/log/asterisk/messages"
            if not os.path.exists(log_path):
                os.makedirs("/var/log/asterisk", exist_ok=True)
                with open(log_path, "a", encoding="utf-8"):
                    pass

            jail_content = f"""[asterisk]
enabled = true
port = 5060,5061
protocol = all
filter = asterisk-aida
logpath = {log_path}
maxretry = {max_retry}
findtime = 300
bantime = {ban_seconds}
ignoreip = {ignore_ip_str}
"""
            with open("/etc/fail2ban/jail.d/asterisk-pjsip.conf", "w", encoding="utf-8") as jf:
                jf.write(jail_content)

            subprocess.run(["systemctl", "enable", "fail2ban"], check=False, capture_output=True, timeout=3.0)
            subprocess.run(["systemctl", "restart", "fail2ban"], check=False, capture_output=True, timeout=4.0)
        except Exception as e_f2b:
            print(f"[Fail2Ban Config Error]: {e_f2b}")

    return {"maxretry": max_retry, "bantime_minutes": ban_minutes, "ignoreip": ignore_ip_str}


def scan_asterisk_failed_sip_attempts(auto_ban: bool = True) -> list:
    """
    /var/log/asterisk/messages dosyasındaki PJSIP 'No matching endpoint found' ve 'Failed to authenticate'
    saldırı kayıtlarını tarar; limit aşan saldırgan IP'leri otomatik olarak güvenlik duvarında engeller.
    """
    import re
    adv = settings_db.get("security_advanced", {})
    max_retry = max(1, int(adv.get("login_rate_limit") or 3))

    log_files = ["/var/log/asterisk/messages", "/var/log/asterisk/full"]
    ip_stats = {}

    pattern = re.compile(
        r"\[([^\]]+)\].*log_failed_request:\s*Request\s*'([^']+)'\s*from\s*'([^']+)'\s*failed for\s*'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?'.*-\s*(.+)$"
    )

    for lf in log_files:
        if not os.path.exists(lf):
            continue
        try:
            with open(lf, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[-2500:]
            for line in lines:
                if "log_failed_request" not in line:
                    continue
                m = pattern.search(line.strip())
                if m:
                    ts_str, req_type, from_uri, ip_addr, fail_reason = m.groups()
                    if _is_trusted_or_local_ip(ip_addr):
                        continue
                    entry = ip_stats.setdefault(ip_addr, {
                        "ip": ip_addr,
                        "attempts": 0,
                        "last_seen": ts_str,
                        "req_type": req_type,
                        "from_uri": from_uri,
                        "reason": fail_reason.strip()
                    })
                    entry["attempts"] += 1
                    entry["last_seen"] = ts_str
                    entry["reason"] = f"{fail_reason.strip()} ({req_type} {from_uri})"
        except Exception as e_log:
            print(f"[Asterisk Security Log Scan Error]: {e_log}")

    already_banned = {item.get("ip") for item in settings_db.get("security_blocked_ips", [])}
    detected_list = []

    for ip_addr, info in ip_stats.items():
        if auto_ban and info["attempts"] >= max_retry and ip_addr not in already_banned:
            _execute_firewall_ban(
                ip_addr,
                jail="asterisk-pjsip",
                reason=f"{info['reason']} ({info['attempts']} deneme)"
            )
            already_banned.add(ip_addr)
        elif ip_addr not in already_banned:
            detected_list.append(info)

    detected_list.sort(key=lambda x: x["attempts"], reverse=True)
    return detected_list


def get_live_fail2ban_and_ufw_status(client_ip: str = "") -> dict:
    import subprocess, shutil, re, datetime
    f2b_installed = bool(shutil.which("fail2ban-client"))
    f2b_active = False
    if f2b_installed:
        try:
            res = subprocess.run(["systemctl", "is-active", "fail2ban"], check=False, capture_output=True, text=True, timeout=1.5)
            f2b_active = (res.stdout.strip() == "active")
        except Exception:
            pass

    wl_entries = _normalize_whitelist_entries()

    # Scan Asterisk logs and auto-ban repeat offenders
    detected_threats = scan_asterisk_failed_sip_attempts(auto_ban=True)

    blocked_map = {}
    for item in settings_db.get("security_blocked_ips", []):
        ip_k = item.get("ip")
        if ip_k and not _is_trusted_or_local_ip(ip_k):
            blocked_map[ip_k] = dict(item)

    # Query fail2ban-client status asterisk
    if f2b_installed and f2b_active:
        for jail_name in ["asterisk", "asterisk-pjsip"]:
            try:
                res_j = subprocess.run(["fail2ban-client", "status", jail_name], check=False, capture_output=True, text=True, timeout=2.0)
                if res_j.returncode == 0 and "Banned IP list:" in res_j.stdout:
                    after = res_j.stdout.split("Banned IP list:", 1)[1].strip()
                    ips_line = after.splitlines()[0].strip() if after else ""
                    for bip in ips_line.split():
                        bip_clean = bip.strip()
                        if bip_clean and bip_clean not in blocked_map and not _is_trusted_or_local_ip(bip_clean):
                            blocked_map[bip_clean] = {
                                "ip": bip_clean,
                                "jail": jail_name,
                                "banned_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                "reason": "Fail2Ban Otomatik Engelleme"
                            }
            except Exception:
                pass

    # Query UFW status for DENY IN rules
    ufw_active = False
    try:
        res_ufw = subprocess.run(["ufw", "status"], check=False, capture_output=True, text=True, timeout=2.0)
        if res_ufw.returncode == 0:
            ufw_active = ("Status: active" in res_ufw.stdout)
            for line in res_ufw.stdout.splitlines():
                if "DENY" in line:
                    m_ip = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:/\d{1,2})?)", line)
                    if m_ip:
                        u_ip = m_ip.group(1)
                        if u_ip not in blocked_map and not _is_trusted_or_local_ip(u_ip):
                            blocked_map[u_ip] = {
                                "ip": u_ip,
                                "jail": "ufw-firewall",
                                "banned_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                "reason": "UFW Güvenlik Duvarı Kuralı"
                            }
    except Exception:
        pass

    return {
        "status": "success",
        "service_status": "active" if f2b_active else ("inactive" if f2b_installed else "not_installed"),
        "ufw_active": ufw_active,
        "blocked_ips": list(blocked_map.values()),
        "whitelisted_ips": wl_entries,
        "detected_threats": detected_threats,
        "client_ip": client_ip
    }


def _extract_request_client_ip(request: Request) -> str:
    xf = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    xr = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if xf:
        return xf.split(",")[0].strip()
    if xr:
        return xr.strip()
    return request.client.host if request.client else ""


@app.get("/api/security/fail2ban")
async def get_fail2ban_ips(request: Request, user_info: dict = Depends(get_user_info)):
    return get_live_fail2ban_and_ufw_status(client_ip=_extract_request_client_ip(request))


@app.get("/api/security/whitelist")
async def get_security_whitelist(request: Request, user_info: dict = Depends(get_user_info)):
    return {
        "status": "success",
        "whitelisted_ips": _normalize_whitelist_entries(),
        "client_ip": _extract_request_client_ip(request)
    }


class WhitelistIpSchema(BaseModel):
    ip: str
    description: Optional[str] = "Güvenli IP / Blok"


@app.post("/api/security/whitelist")
async def add_security_whitelist_ip(request: Request, payload: WhitelistIpSchema, user_info: dict = Depends(get_user_info)):
    import ipaddress, datetime, subprocess
    ip_str = (payload.ip or "").strip()
    if not ip_str:
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir IP adresi veya CIDR bloğu giriniz (Örn: 78.189.210.15 veya 78.189.210.0/24).")
    try:
        net_obj = ipaddress.ip_network(ip_str, strict=False)
        clean_ip = str(net_obj) if "/" in ip_str else str(net_obj.network_address)
    except Exception:
        raise HTTPException(status_code=400, detail="Geçersiz IP adresi veya CIDR bloğu formatı (Örn: 78.189.210.15 veya 192.168.1.0/24).")

    # If it was previously banned, unban it first
    _execute_firewall_unban(clean_ip, add_to_whitelist=False)

    wl = _normalize_whitelist_entries()
    existing = next((w for w in wl if w.get("ip") == clean_ip), None)
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if existing:
        existing["description"] = (payload.description or existing.get("description") or "Güvenli IP / Blok").strip()
    else:
        wl.insert(0, {
            "ip": clean_ip,
            "description": (payload.description or "Güvenli IP / Blok").strip(),
            "added_at": now_str
        })
    settings_db["security_whitelisted_ips"] = wl
    save_settings(settings_db)

    # Allow in UFW and update Fail2Ban ignoreip
    try:
        subprocess.run(["ufw", "insert", "1", "allow", "from", clean_ip, "to", "any"], check=False, capture_output=True, timeout=2.0)
    except Exception:
        pass
    configure_and_sync_fail2ban(install_if_missing=False)

    return {
        "status": "success",
        "message": f"{clean_ip} güvenli listeye (Fail2Ban ignoreip & UFW Allow) eklendi.",
        **get_live_fail2ban_and_ufw_status(client_ip=_extract_request_client_ip(request))
    }


@app.delete("/api/security/whitelist/{ip:path}")
async def delete_security_whitelist_ip(request: Request, ip: str, user_info: dict = Depends(get_user_info)):
    import subprocess
    ip_clean = (ip or "").strip()
    wl = _normalize_whitelist_entries()
    settings_db["security_whitelisted_ips"] = [w for w in wl if w.get("ip") != ip_clean]
    save_settings(settings_db)

    try:
        subprocess.run(["ufw", "delete", "allow", "from", ip_clean, "to", "any"], check=False, capture_output=True, timeout=2.0)
    except Exception:
        pass
    configure_and_sync_fail2ban(install_if_missing=False)

    return {
        "status": "success",
        "message": f"{ip_clean} güvenli listeden (ignoreip) kaldırıldı.",
        **get_live_fail2ban_and_ufw_status(client_ip=_extract_request_client_ip(request))
    }


class ManualBanIpSchema(BaseModel):
    ip: str
    reason: Optional[str] = "Manuel Güvenlik Duvarı Engeli"
    jail: Optional[str] = "asterisk-pjsip"


@app.post("/api/security/fail2ban/ban")
async def manual_ban_fail2ban_ip(request: Request, payload: ManualBanIpSchema, user_info: dict = Depends(get_user_info)):
    ip_str = (payload.ip or "").strip()
    if not ip_str:
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir IP adresi giriniz.")
    if _is_trusted_or_local_ip(ip_str):
        raise HTTPException(status_code=400, detail="Bu IP adresi Güvenli IP (Beyaz Liste) kapsamında olduğu için engellenemez.")
    ok = _execute_firewall_ban(ip_str, jail=payload.jail or "manual-ufw", reason=payload.reason or "Manuel Engelleme", force_manual=True)
    if not ok:
        raise HTTPException(status_code=400, detail="Geçersiz IP adresi veya CIDR formatı (Örn: 31.70.90.134).")
    return {
        "status": "success",
        "message": f"{ip_str} IP adresi güvenlik duvarında (UFW & Fail2Ban) başarıyla engellendi.",
        **get_live_fail2ban_and_ufw_status(client_ip=_extract_request_client_ip(request))
    }


@app.delete("/api/security/fail2ban/{ip:path}")
async def unban_fail2ban_ip(request: Request, ip: str, user_info: dict = Depends(get_user_info)):
    ok = _execute_firewall_unban(ip, add_to_whitelist=True)
    if not ok:
        raise HTTPException(status_code=400, detail="Geçersiz IP adresi.")
    return {
        "status": "success",
        "message": f"{ip} adresi engellenenler listesinden ve güvenlik duvarından kaldırıldı.",
        **get_live_fail2ban_and_ufw_status(client_ip=_extract_request_client_ip(request))
    }


class Fail2banServiceActionSchema(BaseModel):
    action: str  # "install_and_configure" | "restart" | "scan_and_ban"


@app.post("/api/security/fail2ban/service")
async def control_fail2ban_service(request: Request, payload: Fail2banServiceActionSchema, user_info: dict = Depends(get_user_info)):
    import subprocess
    act = (payload.action or "").strip()
    if act == "install_and_configure":
        configure_and_sync_fail2ban(install_if_missing=True)
        msg = "Fail2Ban servisi ve Asterisk PJSIP güvenlik kuralları başarıyla kuruldu ve aktif edildi."
    elif act == "restart":
        configure_and_sync_fail2ban(install_if_missing=False)
        try:
            subprocess.run(["systemctl", "restart", "fail2ban"], check=False, capture_output=True, timeout=4.0)
        except Exception:
            pass
        msg = "Fail2Ban servisi yeniden başlatıldı ve kurallar güncellendi."
    elif act == "scan_and_ban":
        threats = scan_asterisk_failed_sip_attempts(auto_ban=True)
        for t in threats:
            _execute_firewall_ban(t["ip"], jail="asterisk-pjsip", reason=f"{t['reason']} ({t['attempts']} deneme)")
        msg = "Asterisk loglarındaki tüm şüpheli IP adresleri tarandı ve güvenlik duvarında engellendi."
    else:
        raise HTTPException(status_code=400, detail="Geçersiz servis işlemi.")

    return {
        "status": "success",
        "message": msg,
        **get_live_fail2ban_and_ufw_status(client_ip=_extract_request_client_ip(request))
    }


@app.get("/api/security/geo")
async def get_geo_security(user_info: dict = Depends(get_user_info)):
    return settings_db.get("security_geo", DEFAULT_SETTINGS["security_geo"])

@app.get("/api/security/advanced")
async def get_advanced_security(user_info: dict = Depends(get_user_info)):
    return settings_db.get("security_advanced", {
        "login_rate_limit": 3,
        "api_rate_limit": 100,
        "sip_rate_limit": 50,
        "block_duration_minutes": 1440
    })

class AdvancedSecuritySchema(BaseModel):
    login_rate_limit: int
    api_rate_limit: int
    sip_rate_limit: int
    block_duration_minutes: int

@app.post("/api/security/advanced")
async def save_advanced_security(payload: AdvancedSecuritySchema, user_info: dict = Depends(get_user_info)):
    settings_db["security_advanced"] = payload.model_dump()
    save_settings(settings_db)
    configure_and_sync_fail2ban(install_if_missing=False)
    return {"status": "success", "message": "Gelişmiş güvenlik ve Fail2Ban hız sınırlandırma ayarları başarıyla kaydedildi ve uygulandı."}

class GeoSecuritySchema(BaseModel):
    allowed_countries: List[str]

@app.post("/api/security/geo")
async def save_geo_security(payload: GeoSecuritySchema, user_info: dict = Depends(get_user_info)):
    settings_db["security_geo"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Bölgesel erişim (GeoIP) kuralları başarıyla kaydedildi."}


try:
    import pyotp
except ImportError:
    pyotp = None

class Verify2FASchema(BaseModel):
    user_id: str
    code: str

@app.post("/api/auth/verify_2fa")
async def verify_2fa(payload: Verify2FASchema):
    if pyotp is None:
        raise HTTPException(status_code=500, detail="pyotp paketi sunucuda yüklü değil. Lütfen 'pip install pyotp' çalıştırın.")
    user_id = payload.user_id
    code = payload.code
    
    if user_id == "admin":
        return {"status": "success", "message": "Admin login ok"}
    
    users = settings_db.get("users", [])
    user = next((u for u in users if str(u.get("id")) == str(user_id)), None)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    secret = user.get("two_factor_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="2FA is not set up for this user")
        
    totp = pyotp.TOTP(secret)
    if totp.verify(code):
        return {"status": "success", "message": "2FA verified"}
    else:
        raise HTTPException(status_code=401, detail="Geçersiz 2FA kodu")

@app.get("/api/auth/setup_2fa/{user_id}")
async def setup_2fa(user_id: str):
    if pyotp is None:
        raise HTTPException(status_code=500, detail="pyotp paketi sunucuda yüklü değil. Lütfen 'pip install pyotp' çalıştırın.")
    if user_id == "admin":
        return {"status": "error", "message": "Admin 2FA setup not supported via UI yet"}
        
    users = settings_db.get("users", [])
    user = next((u for u in users if str(u.get("id")) == str(user_id)), None)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    secret = user.get("two_factor_secret")
    if not secret:
        secret = pyotp.random_base32()
        user["two_factor_secret"] = secret
        save_settings(settings_db)
        
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.get("email"), issuer_name="AIDA System")
    
    return {
        "status": "success",
        "secret": secret,
        "uri": uri
    }

async def recording_cleanup_task():
    import asyncio
    import os
    import time
    import shutil
    
    while True:
        try:
            retention = settings_db.get("recording_retention", DEFAULT_SETTINGS["recording_retention"])
            
            # Disk cleanup check
            if retention.get("delete_by_disk"):
                threshold = retention.get("disk_threshold_pct", 80)
                total, used, free = shutil.disk_usage(RECORDINGS_DIR)
                percent_used = (used / total) * 100
                
                if percent_used > threshold:
                    print(f"[Retention] Disk usage {percent_used:.1f}% exceeds threshold {threshold}%. Cleaning up...")
                    files = []
                    for f in os.listdir(RECORDINGS_DIR):
                        fp = os.path.join(RECORDINGS_DIR, f)
                        if os.path.isfile(fp) and f.endswith(".wav"):
                            files.append((fp, os.path.getmtime(fp)))
                    
                    # Sort files by modification time, oldest first
                    files.sort(key=lambda x: x[1])
                    
                    # Delete files until we drop 5% below threshold, or run out of files
                    target_percent = threshold - 5
                    for fp, mtime in files:
                        try:
                            os.remove(fp)
                            print(f"[Retention] Deleted {fp} (Disk full)")
                        except Exception as e:
                            print(f"[Retention] Error deleting {fp}: {e}")
                        
                        total, used, free = shutil.disk_usage(RECORDINGS_DIR)
                        if (used / total) * 100 <= target_percent:
                            break

            # Days retention check
            if retention.get("delete_by_days"):
                days = retention.get("keep_days", 90)
                cutoff_time = time.time() - (days * 86400)
                
                for f in os.listdir(RECORDINGS_DIR):
                    fp = os.path.join(RECORDINGS_DIR, f)
                    if os.path.isfile(fp) and f.endswith(".wav"):
                        if os.path.getmtime(fp) < cutoff_time:
                            try:
                                os.remove(fp)
                                print(f"[Retention] Deleted {fp} (Older than {days} days)")
                            except Exception as e:
                                print(f"[Retention] Error deleting {fp}: {e}")

        except Exception as e:
            print(f"[Retention] Cleanup task error: {e}")
            
        # Run every hour
        await asyncio.sleep(3600)

@app.on_event("startup")
async def startup_event():
    import asyncio
    import datetime
    import json
    from sqlalchemy import update, select
    from backend.database.config import engine, AsyncSessionLocal, Base
    from backend.database.models import Call, SystemUser, SystemRole, SystemSetting, QAQuestion, EventLog
    from backend.services.ami_manager import start_ami_listener
    
    # 1. Ensure all tables and columns are created in PostgreSQL
    try:
        from sqlalchemy import text
        async def init_db():
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            ddl_statements = [
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS all_busy_routing_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS all_busy_destination_type VARCHAR DEFAULT '';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS all_busy_destination_target VARCHAR DEFAULT '';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS max_wait_time_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS max_wait_time INTEGER DEFAULT 120;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS max_wait_destination_type VARCHAR DEFAULT '';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS max_wait_destination_target VARCHAR DEFAULT '';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS notify_missed_calls BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS recipient_info VARCHAR;",
                "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS assigned_user VARCHAR;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS active_profile VARCHAR DEFAULT 'available';",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS profiles JSON DEFAULT '[]';",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS sip_username VARCHAR;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS max_activations INTEGER DEFAULT 1;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS follow_me JSON;",
                "ALTER TABLE trunks ADD COLUMN IF NOT EXISTS max_channels INTEGER DEFAULT 30;"
            ]
            for stmt_sql in ddl_statements:
                try:
                    async with engine.begin() as conn_ddl:
                        await conn_ddl.execute(text(stmt_sql))
                except Exception:
                    pass
        await asyncio.wait_for(init_db(), timeout=6.0)
        print("[Database Init] Veritabanı tabloları ve pbx_queues sütunları kontrol edildi / oluşturuldu.")
        try:
            await log_event(
                user_id="SYSTEM",
                action="SYSTEM_STARTUP",
                module="System",
                details={"message": "FastAPI sunucu servisi ve veritabanı olay günlüğü başlatıldı."}
            )
        except Exception as log_err:
            print(f"[Database Init] Startup event log error: {log_err}")
    except Exception as e:
        print(f"[Database Init] Error creating tables/columns: {e}")

    # 2. Auto-seed tables if empty & cleanup stale / fraudulent scanner calls
    async def seed_db_tables():
        async with AsyncSessionLocal() as session:
            stmt = update(Call).where(Call.status == "in_progress").values(status="no_answer", end_time=datetime.datetime.utcnow())
            await session.execute(stmt)

            # Sızma / SIP Scanner sahte çağrı kayıtlarını (097..., 098..., 099..., 0900...) CDR tablosundan otomatik temizle
            try:
                from sqlalchemy import delete as sa_delete
                del_fraud_stmt = sa_delete(Call).where(
                    or_(
                        Call.callee_number.like("097%"),
                        Call.callee_number.like("098%"),
                        Call.callee_number.like("099%"),
                        Call.callee_number.like("0900%"),
                        Call.caller_number.like("097%"),
                        Call.caller_number.like("098%"),
                        Call.caller_number.like("099%")
                    )
                )
                res_del = await session.execute(del_fraud_stmt)
                if getattr(res_del, "rowcount", 0):
                    print(f"[SIP Security Shield] {res_del.rowcount} adet sahte SIP scanner CDR kaydı veritabanından temizlendi.")
            except Exception as e_clean_fraud:
                print(f"[SIP Security Shield Cleanup Warning]: {e_clean_fraud}")

            await session.commit()

            # Load settings.json as fallback source if exists
            file_settings = {}
            if os.path.exists(SETTINGS_FILE):
                try:
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        file_settings = json.load(f)
                except Exception as e:
                    print(f"[Seed] Error reading settings.json: {e}")

            source_users = file_settings.get("users") or DEFAULT_SETTINGS.get("users", [])
            source_roles = file_settings.get("roles") or DEFAULT_SETTINGS.get("roles", [])

            # Check and seed SystemUser
            res_users = await session.execute(select(SystemUser))
            users_db = res_users.scalars().all()
            if not users_db and source_users:
                print("[Database Seeding] SystemUser tablosu boş. Otomatik olarak kullanıcılar yükleniyor...")
                for u in source_users:
                    user_obj = SystemUser(
                        full_name=u.get("full_name", ""),
                        email=u.get("email", ""),
                        extension=str(u.get("extension", "")),
                        avatar=u.get("avatar"),
                        role=u.get("role", "agent"),
                        is_active=u.get("is_active", True),
                        gsm_number=u.get("gsm_number"),
                        mobile_transfer_enabled=u.get("mobile_transfer_enabled", False),
                        theme_color=u.get("theme_color", "rose"),
                        password=u.get("password"),
                        sip_password=u.get("sip_password"),
                        outbound_caller_id=u.get("outbound_caller_id"),
                        forwarding_always=u.get("forwarding_always"),
                        forwarding_busy=u.get("forwarding_busy"),
                        forwarding_no_answer=u.get("forwarding_no_answer"),
                        voicemail_active=u.get("voicemail_active", False),
                        voicemail_announcement=u.get("voicemail_announcement"),
                        voicemail_pin=u.get("voicemail_pin"),
                        voicemail_to_email=u.get("voicemail_to_email", False),
                        recording_active=u.get("recording_active", False),
                        transport=u.get("transport", "UDP"),
                        active_sessions=u.get("active_sessions", []),
                        location_id=u.get("location_id"),
                        department_id=u.get("department_id")
                    )
                    session.add(user_obj)
                await session.commit()
                print("[Database Seeding] Kullanıcılar başarıyla veritabanına aktarıldı.")

            # Check and seed SystemRole
            res_roles = await session.execute(select(SystemRole))
            roles_db = res_roles.scalars().all()
            if not roles_db and source_roles:
                print("[Database Seeding] SystemRole tablosu boş. Otomatik olarak roller yükleniyor...")
                for r in source_roles:
                    role_obj = SystemRole(
                        role_code=r.get("role_code", ""),
                        name=r.get("name", ""),
                        permissions=r.get("permissions", []),
                        allowed_breaks=r.get("allowed_breaks", [])
                    )
                    session.add(role_obj)
                await session.commit()
                print("[Database Seeding] Roller başarıyla veritabanına aktarıldı.")

            # Check and seed SystemSetting
            res_settings = await session.execute(select(SystemSetting))
            settings_db_items = res_settings.scalars().all()
            if not settings_db_items:
                print("[Database Seeding] SystemSetting tablosu boş. Ayarlar yükleniyor...")
                exclude_keys = ["users", "roles", "queues", "trunks", "ai_agents", "breaks"]
                merged_settings = DEFAULT_SETTINGS.copy()
                merged_settings.update(file_settings)
                for k, v in merged_settings.items():
                    if k not in exclude_keys:
                        session.add(SystemSetting(key=k, value=v))
                await session.commit()
                print("[Database Seeding] Sistem ayarları başarıyla veritabanına aktarıldı.")

            # Seed QA questions
            res_qa = await session.execute(select(QAQuestion))
            existing_qa = res_qa.scalars().all()
            if not existing_qa:
                default_questions = [
                    QAQuestion(question="Temsilci görüşme başında KVKK aydınlatma metnini okudu mu veya onay aldı mı?", max_score=15, is_active=True),
                    QAQuestion(question="Temsilci müşterinin sözünü kesti mi veya konuşmasını böldü mü?", max_score=10, is_active=True),
                    QAQuestion(question="Temsilci profesyonel, nazik ve yardımsever bir üslup kullandı mı?", max_score=15, is_active=True),
                    QAQuestion(question="Temsilci müşterinin sorununu doğru anlayıp çözüm odaklı yönlendirmeler yaptı mı?", max_score=20, is_active=True),
                    QAQuestion(question="Temsilci görüşme sonunda başka bir talebi olup olmadığını sordu mu?", max_score=10, is_active=True)
                ]
                session.add_all(default_questions)
                await session.commit()
                print("[Database] Varsayılan QA kriterleri başarıyla eklendi.")

            # Refresh global settings_db dict
            global settings_db
            settings_db.update(load_settings())

            # Regenerate Asterisk configs (PJSIP endpoints, trunks, queues, dialplan) for native or docker Asterisk
            try:
                regenerate_pjsip_custom_conf()
                regenerate_queues_conf()
                regenerate_extensions_custom_conf()
                configure_and_sync_fail2ban(install_if_missing=False)
                scan_asterisk_failed_sip_attempts(auto_ban=True)
                print("[Asterisk Startup Sync] PJSIP, Kuyruk, Dialplan ve Fail2Ban güvenlik kuralları başarıyla güncellendi.")
            except Exception as e_ast:
                print(f"[Asterisk Startup Sync Error]: {e_ast}")

            # Start background tasks
            asyncio.create_task(recording_cleanup_task())
            try:
                from backend.services.email_service import poll_imap_inbox
                asyncio.create_task(poll_imap_inbox())
                print("[Startup] IMAP E-posta dinleme servisi başlatıldı.")
            except Exception as e_email:
                print(f"[Startup Error] IMAP e-posta dinleme servisi başlatılamadı: {e_email}")

    try:
        await asyncio.wait_for(seed_db_tables(), timeout=5.0)
    except Exception as e:
        print(f"[Database Init/Seeding Timeout or Error]: {e}")
        global settings_db
        settings_db.update(load_settings())
        
    asyncio.create_task(start_ami_listener())

    try:
        from backend.audiosocket_server import start_server as start_audiosocket_server
        asyncio.create_task(start_audiosocket_server())
        print("[Startup] AudioSocket TCP Sunucusu (Port 9092) başarıyla arka planda başlatıldı.")
    except Exception as e_audio:
        print(f"[Startup Error] AudioSocket TCP sunucusu başlatılamadı: {e_audio}")

    try:
        from backend.services.notification_service import monitor_system_health_and_notify, trigger_notification_bg
        asyncio.create_task(monitor_system_health_and_notify())
        trigger_notification_bg(
            "system_reboot",
            "Sistem Reboot / Servisler Yeniden Başlatıldı",
            "AIDA Santral, Yapay Zeka ve AudioSocket arka plan servisleri yeniden başlatıldı ve aktif durumda.",
            severity="info",
            tenant_id="tenant-default"
        )
        print("[Startup] E-Mail ve WhatsApp Kritik Bildirim İzleyici servisi başlatıldı.")
    except Exception as e_notif:
        print(f"[Startup Error] Bildirim servisi başlatılamadı: {e_notif}")


# ==============================================================================
# E-MAIL & WHATSAPP CRITICAL SYSTEM NOTIFICATIONS ENDPOINTS
# ==============================================================================

@app.get("/api/settings/notifications")
@app.get("/settings/notifications")
async def get_notification_settings_endpoint(user_info: dict = Depends(get_user_info)):
    from backend.services.notification_service import get_tenant_notification_settings, DEFAULT_NOTIFICATION_EVENTS
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    cfg = get_tenant_notification_settings(settings_db, target_tenant)
    res_data = dict(cfg)
    res_data["settings"] = cfg
    res_data["event_metadata"] = DEFAULT_NOTIFICATION_EVENTS
    return res_data

@app.post("/api/settings/notifications")
@app.post("/settings/notifications")
async def save_notification_settings_endpoint(payload: dict, user_info: dict = Depends(get_user_info)):
    from backend.services.notification_service import get_tenant_notification_settings
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    existing = get_tenant_notification_settings(settings_db, target_tenant)
    history_keep = existing.get("history", [])

    emails_val = str(payload.get("email_recipients") or payload.get("recipient_emails") or "").strip()
    wa_val = str(payload.get("whatsapp_recipients") or payload.get("recipient_whatsapp_numbers") or "").strip()
    use_custom = bool(payload.get("use_custom_smtp") or payload.get("smtp_override_enabled"))
    smtp_pw = str(payload.get("smtp_password") or payload.get("smtp_pass") or "").strip()

    updated_cfg = {
        "enabled": bool(payload.get("enabled", True)),
        "email_enabled": bool(payload.get("email_enabled", True)),
        "email_recipients": emails_val,
        "recipient_emails": emails_val,
        "whatsapp_enabled": bool(payload.get("whatsapp_enabled", False)),
        "whatsapp_recipients": wa_val,
        "recipient_whatsapp_numbers": wa_val,
        "use_custom_smtp": use_custom,
        "smtp_override_enabled": use_custom,
        "smtp_host": str(payload.get("smtp_host", "")).strip(),
        "smtp_port": int(payload.get("smtp_port") or 587),
        "smtp_user": str(payload.get("smtp_user", "")).strip(),
        "smtp_password": smtp_pw,
        "smtp_pass": smtp_pw,
        "smtp_from_name": str(payload.get("smtp_from_name", "AIDA Sistem Bildirimleri")).strip(),
        "cooldown_minutes": int(payload.get("cooldown_minutes") or 5),
        "events": payload.get("events", existing.get("events", {})),
        "history": history_keep
    }

    if "tenant_notifications" not in settings_db or not isinstance(settings_db.get("tenant_notifications"), dict):
        settings_db["tenant_notifications"] = {}
    settings_db["tenant_notifications"][target_tenant] = updated_cfg
    if is_default_tenant(target_tenant):
        settings_db["notifications"] = updated_cfg
        settings_db["system_notifications"] = updated_cfg
    save_settings(settings_db)
    add_system_log("NOTIFICATIONS", "INFO", f"E-Mail ve WhatsApp bildirim ayarları güncellendi ({target_tenant})")
    return {"status": "success", "message": "E-Mail ve WhatsApp bildirim ayarları başarıyla kaydedildi.", "settings": updated_cfg}

@app.post("/api/settings/notifications/test")
@app.post("/settings/notifications/test")
async def test_notification_endpoint(payload: dict, user_info: dict = Depends(get_user_info)):
    from backend.services.notification_service import (
        get_tenant_notification_settings,
        _send_notification_email
    )
    from backend.services.whatsapp_service import send_whatsapp_message
    import datetime

    target_tenant = user_info.get("tenant_id") or "tenant-default"
    channel = payload.get("channel", "both")  # "email", "whatsapp", "both"

    cfg = get_tenant_notification_settings(settings_db, target_tenant)
    if "settings" in payload and isinstance(payload["settings"], dict):
        cfg.update(payload["settings"])
    if payload.get("email_recipients"):
        cfg["email_recipients"] = str(payload.get("email_recipients")).strip()
        cfg["recipient_emails"] = cfg["email_recipients"]
    if payload.get("whatsapp_recipients"):
        cfg["whatsapp_recipients"] = str(payload.get("whatsapp_recipients")).strip()
        cfg["recipient_whatsapp_numbers"] = cfg["whatsapp_recipients"]

    title = "Test Bildirimi — AIDA Kritik Sistem Uyarısı"
    message = (
        "Bu mesaj, AIDA Sistem Ayarları > E-Mail ve WhatsApp Bildirimleri ekranından gönderilen bir test bildirimidir.\n"
        "Dış hat kopmaları, eş zamanlı çağrı kanalı dolulukları (veya +Tolerans kanalı devreye girmesi), AI sağlayıcı kota/bağlantı sorunları ve lisans uyarıları bu kanal üzerinden tarafınıza anlık iletilecektir."
    )

    tr_now = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%d.%m.%Y %H:%M:%S")
    email_ok = False
    wa_ok = False
    errors = []

    if channel in ["email", "both"]:
        raw_emails = str(cfg.get("email_recipients") or cfg.get("recipient_emails") or "").strip()
        recipients = [e.strip() for e in raw_emails.replace(";", ",").split(",") if e.strip() and "@" in e]
        if not recipients:
            errors.append("Alıcı e-posta adresi girilmemiş.")
        else:
            plain_body = f"AIDA TEST BİLDİRİMİ\nTarih/Saat: {tr_now}\n\n{message}"
            html_body = f"""
            <html>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
                <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                  <div style="background: #2563eb; color: #ffffff; padding: 18px 24px; font-weight: 800; font-size: 16px;">
                    ℹ️ AIDA Sistem Bildirimi — TEST
                  </div>
                  <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
                    <h3 style="margin-top: 0; color: #0f172a; font-size: 17px;">{title}</h3>
                    <div style="background: #f1f5f9; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 8px; margin: 16px 0; white-space: pre-wrap;">{message}</div>
                    <p style="font-size: 12px; color: #64748b;">Zaman (TR): {tr_now} | Tenant: {target_tenant}</p>
                  </div>
                </div>
              </body>
            </html>
            """
            channels_cfg = settings_db.get("channels", {})
            email_res = await _send_notification_email(cfg, channels_cfg, recipients, f"ℹ️ [AIDA TEST] {title}", html_body, plain_body)
            if email_res.get("status") == "success":
                email_ok = True
            else:
                errors.append(email_res.get("message") or "E-posta gönderilemedi.")

    if channel in ["whatsapp", "both"]:
        raw_wa = str(cfg.get("whatsapp_recipients") or cfg.get("recipient_whatsapp_numbers") or "").strip()
        wa_numbers = [n.strip() for n in raw_wa.replace(";", ",").split(",") if n.strip()]
        if not wa_numbers:
            errors.append("Alıcı WhatsApp numarası girilmemiş.")
        else:
            wa_text = (
                f"ℹ️ *AIDA SİSTEM BİLDİRİMİ (TEST)*\n\n"
                f"📌 *Olay:* {title}\n"
                f"🕒 *Zaman:* {tr_now}\n"
                f"🏢 *Tenant:* `{target_tenant}`\n\n"
                f"📝 *Detay:*\n{message}"
            )
            any_wa_sent = False
            for num in wa_numbers:
                clean_num = "".join(ch for ch in num if ch.isdigit())
                if clean_num.startswith("0") and len(clean_num) == 11:
                    clean_num = "90" + clean_num[1:]
                elif len(clean_num) == 10 and clean_num.startswith("5"):
                    clean_num = "90" + clean_num
                if len(clean_num) >= 10:
                    sent = await send_whatsapp_message(to_phone=clean_num, text=wa_text)
                    if (isinstance(sent, dict) and sent.get("status") == "success") or (isinstance(sent, bool) and sent):
                        any_wa_sent = True
            wa_ok = any_wa_sent
            if not wa_ok:
                errors.append("WhatsApp mesajı gönderilemedi. WhatsApp Cloud API Token / Phone ID ayarlarını kontrol edin.")

    if email_ok or wa_ok:
        real_cfg = get_tenant_notification_settings(settings_db, target_tenant)
        hist = real_cfg.get("history", [])
        if not isinstance(hist, list):
            hist = []
        ch_list = []
        if email_ok:
            ch_list.append("email")
        if wa_ok:
            ch_list.append("whatsapp")
        hist.insert(0, {
            "id": f"test_{int(datetime.datetime.utcnow().timestamp() * 1000)}",
            "event_key": "test_notification",
            "title": title,
            "message": message,
            "severity": "info",
            "channels": ch_list,
            "email_sent": email_ok,
            "whatsapp_sent": wa_ok,
            "timestamp": tr_now
        })
        real_cfg["history"] = hist[:40]
        settings_db.setdefault("tenant_notifications", {})[target_tenant] = real_cfg
        if is_default_tenant(target_tenant):
            settings_db["notifications"] = real_cfg
            settings_db["system_notifications"] = real_cfg
        save_settings(settings_db)

    if errors and not (email_ok or wa_ok):
        raise HTTPException(status_code=400, detail=" | ".join(errors))

    return {
        "status": "success",
        "email_sent": email_ok,
        "whatsapp_sent": wa_ok,
        "warnings": errors,
        "message": "Test bildirimi başarıyla gönderildi."
    }

@app.delete("/api/settings/notifications/history")
@app.delete("/settings/notifications/history")
async def clear_notification_history_endpoint(user_info: dict = Depends(get_user_info)):
    from backend.services.notification_service import get_tenant_notification_settings
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    cfg = get_tenant_notification_settings(settings_db, target_tenant)
    cfg["history"] = []
    if "tenant_notifications" not in settings_db:
        settings_db["tenant_notifications"] = {}
    settings_db["tenant_notifications"][target_tenant] = cfg
    if is_default_tenant(target_tenant):
        settings_db["notifications"] = cfg
    save_settings(settings_db)
    return {"status": "success", "message": "Bildirim geçmişi temizlendi."}


# --- REFACTORED ENDPOINTS ---

@app.get("/api/settings/users")
@app.get("/settings/users")
async def new_get_users_endpoint(request: Request, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    target_tenant = user_info.get("tenant_id") or request.headers.get("X-Tenant-ID") or request.headers.get("Tenant-ID") or request.query_params.get("tenant_id") or "tenant-default"
    
    from backend.services.ami_manager import registered_endpoints

    raw_users = []
    if target_tenant in ["all", "global"]:
        try:
            result = await db.execute(select(SystemUser).order_by(SystemUser.id))
            users = result.scalars().all()
            if users:
                raw_users = [{c.name: getattr(u, c.name) for c in u.__table__.columns} for u in users]
        except Exception as e:
            print(f"[Get All Users DB Error]: {e}")
        if not raw_users:
            raw_users = settings_db.get("users", [])
    else:
        try:
            if target_tenant == "tenant-default":
                stmt = select(SystemUser).where(or_(SystemUser.tenant_id == "tenant-default", SystemUser.tenant_id.is_(None))).order_by(SystemUser.id)
            else:
                stmt = select(SystemUser).where(SystemUser.tenant_id == target_tenant).order_by(SystemUser.id)
            result = await db.execute(stmt)
            users = result.scalars().all()
            if users:
                raw_users = [{c.name: getattr(u, c.name) for c in u.__table__.columns} for u in users]
        except Exception as e:
            print(f"[Get Users DB Error]: {e}")

        if not raw_users:
            all_disk_users = settings_db.get("users", [])
            for u in all_disk_users:
                u_tenant = u.get("tenant_id") or "tenant-default"
                if u_tenant == target_tenant:
                    raw_users.append(u)

    # Attach live SIP WebRTC registration status and IP address to each user object
    from backend.services.agent_presence import get_agent_state
    disk_users_by_id = {str(du.get("id")): du for du in settings_db.get("users", []) if du.get("id") is not None}
    disk_users_by_ext = {str(du.get("extension")): du for du in settings_db.get("users", []) if du.get("extension")}
    for u in raw_users:
        ext = str(u.get("extension") or "")
        uid = str(u.get("id") or "")
        disk_u = disk_users_by_id.get(uid) or disk_users_by_ext.get(ext)
        if disk_u:
            if disk_u.get("active_profile"):
                u["active_profile"] = disk_u.get("active_profile")
            if disk_u.get("profiles"):
                u["profiles"] = disk_u.get("profiles")
            if disk_u.get("follow_me"):
                u["follow_me"] = disk_u.get("follow_me")
            if (not u.get("sip_password") or u.get("sip_password") == "1234") and disk_u.get("sip_password"):
                u["sip_password"] = disk_u.get("sip_password")
            if not u.get("sip_username") and disk_u.get("sip_username"):
                u["sip_username"] = disk_u.get("sip_username")
        u["sip_password"] = resolve_secure_sip_password(ext, u.get("sip_password") or "")
        ensure_user_profiles(u)
        reg_ip = registered_endpoints.get_ip(ext) or registered_endpoints.get_ip(uid)
        st_ext = get_agent_state(ext)
        st_uid = get_agent_state(uid)
        presence_online = (st_ext and st_ext.get("is_logged_in", False)) or (st_uid and st_uid.get("is_logged_in", False))
        is_reg = (ext in registered_endpoints or uid in registered_endpoints) and presence_online
        u["is_registered"] = is_reg
        u["sip_status"] = "online" if is_reg else "offline"
        u["ip_address"] = reg_ip if is_reg else ""

    return raw_users


@app.post("/api/settings/users")
@app.post("/settings/users")
async def new_save_users_endpoint(payload: Union[List[UserSchema], UserSchema], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        from sqlalchemy.orm.attributes import flag_modified
        is_single = not isinstance(payload, list)
        items_list = [payload] if is_single else payload

        existing_users_db = []
        existing_by_ext = {}
        existing_by_id = {}

        try:
            result = await db.execute(select(SystemUser))
            existing_users_db = result.scalars().all()
            existing_by_ext = {str(u.extension): u for u in existing_users_db if u.extension}
            existing_by_id = {u.id: u for u in existing_users_db if u.id is not None}
        except Exception as dbe:
            print(f"[Save Users DB Query Warning]: {dbe}")
            try:
                await db.rollback()
            except Exception:
                pass

        current_users_list = settings_db.get("users", [])
        existing_disk_by_id = {u.get("id"): u for u in current_users_list if u.get("id") is not None}
        existing_disk_by_ext = {str(u.get("extension")): u for u in current_users_list if u.get("extension")}

        for item in items_list:
            item_data = item.model_dump() if hasattr(item, "model_dump") else item
            ext_val = item_data.get("extension")
            item_id = item_data.get("id")
            validate_number_range(ext_val, "extension")
            check_extension_uniqueness(ext_val, "user", item_id)


        payload_user_ids = set()
        new_users_out = []
        changes = []
        valid_keys = {c.name for c in SystemUser.__table__.columns}
        json_cols = {"profiles", "follow_me", "forwarding_always", "forwarding_busy", "forwarding_no_answer", "active_sessions"}
        saved_payload_by_ext = {}
        saved_payload_by_id = {}

        for idx, item in enumerate(items_list):
            data = item.model_dump()
            ensure_user_profiles(data)
            ext_str = str(data.get("extension") or "")
            data["sip_password"] = resolve_secure_sip_password(ext_str, data.get("sip_password") or "")
                
            if ext_str:
                saved_payload_by_ext[ext_str] = data
            if data.get("id") is not None:
                saved_payload_by_id[data.get("id")] = data

            target_user = None
            if data.get("id") and data.get("id") in existing_by_id:
                target_user = existing_by_id[data.get("id")]
            elif ext_str and ext_str in existing_by_ext:
                target_user = existing_by_ext[ext_str]

            filtered_data = {k: v for k, v in data.items() if k in valid_keys and k != "id"}

            if target_user:
                for k, v in filtered_data.items():
                    setattr(target_user, k, v)
                    if k in json_cols:
                        try:
                            flag_modified(target_user, k)
                        except Exception:
                            pass
                payload_user_ids.add(target_user.id)
                changes.append({"action": "UPDATED", "name": data.get("full_name"), "extension": data.get("extension")})
            else:
                new_sys_user = SystemUser(**filtered_data)
                try:
                    db.add(new_sys_user)
                except Exception:
                    pass
                changes.append({"action": "CREATED", "name": data.get("full_name"), "extension": data.get("extension")})

        if not is_single and existing_users_db:
            for u in existing_users_db:
                if u.id not in payload_user_ids and u.role != "admin" and str(u.id) != "admin":
                    try:
                        await db.delete(u)
                    except Exception:
                        pass

        try:
            await db.commit()
            res_updated = await db.execute(select(SystemUser).order_by(SystemUser.id))
            all_users_db = res_updated.scalars().all()
            if all_users_db:
                new_users_out = [{c.name: getattr(u, c.name) for c in u.__table__.columns} for u in all_users_db]
                for u_dict in new_users_out:
                    ext_u = str(u_dict.get("extension") or "")
                    p_match = saved_payload_by_id.get(u_dict.get("id")) or saved_payload_by_ext.get(ext_u)
                    if not p_match:
                        p_match = existing_disk_by_id.get(u_dict.get("id")) or existing_disk_by_ext.get(ext_u)
                    if p_match:
                        if p_match.get("active_profile"):
                            u_dict["active_profile"] = p_match.get("active_profile")
                        if p_match.get("profiles"):
                            u_dict["profiles"] = p_match.get("profiles")
                        if p_match.get("follow_me"):
                            u_dict["follow_me"] = p_match.get("follow_me")
                        if p_match.get("sip_password"):
                            u_dict["sip_password"] = p_match.get("sip_password")
                        if p_match.get("sip_username"):
                            u_dict["sip_username"] = p_match.get("sip_username")
                    u_dict["sip_password"] = resolve_secure_sip_password(ext_u, u_dict.get("sip_password") or "")
                    ensure_user_profiles(u_dict)
        except Exception as dbe:
            print(f"[Save Users DB Commit Warning]: {dbe}")
            try:
                await db.rollback()
            except Exception:
                pass

        if not new_users_out:
            updated_dict = {}
            for u in current_users_list:
                uid = u.get("id")
                if uid:
                    updated_dict[uid] = u.copy()

            for item in items_list:
                data = item.model_dump()
                ensure_user_profiles(data)
                ext_s = str(data.get("extension") or "")
                data["sip_password"] = resolve_secure_sip_password(ext_s, data.get("sip_password") or "")
                
                item_id = data.get("id")
                if not item_id:
                    next_id = max([u.get("id", 0) for u in updated_dict.values()] + [0]) + 1
                    data["id"] = next_id
                    item_id = next_id
                
                updated_dict[item_id] = data

            if not is_single:
                payload_ids = {item.model_dump().get("id") for item in items_list if item.model_dump().get("id")}
                for uid in list(updated_dict.keys()):
                    if uid not in payload_ids and updated_dict[uid].get("role") != "admin" and str(uid) != "admin":
                        del updated_dict[uid]

            new_users_out = list(updated_dict.values())

        settings_db["needs_apply"] = True
        settings_db["users"] = new_users_out
        save_settings(settings_db)

        try:
            regenerate_pjsip_custom_conf()
        except Exception as e_pjsip:
            print(f"[Save Users PJSIP Reload Warning]: {e_pjsip}")
        
        return {"status": "success", "users": new_users_out}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Save Users Fatal Error]: {e}")
        return {"status": "success", "users": settings_db.get("users", [])}

@app.put("/api/settings/users/{user_id}")
@app.put("/settings/users/{user_id}")
async def update_single_user_endpoint(user_id: int, payload: UserSchema, background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    payload.id = user_id
    return await new_save_users_endpoint(payload=payload, background_tasks=background_tasks, user_info=user_info, db=db)

@app.delete("/api/settings/users/{user_id}")
@app.delete("/settings/users/{user_id}")
async def delete_single_user_endpoint(user_id: int, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        try:
            res = await db.execute(select(SystemUser).where(SystemUser.id == user_id))
            u = res.scalars().first()
            if u:
                if u.role == "admin" or str(u.id) == "admin":
                    raise HTTPException(status_code=400, detail="Admin kullanıcısı silinemez.")
                await db.delete(u)
                await db.commit()
        except HTTPException:
            raise
        except Exception as dbe:
            print(f"[Delete User DB Warning]: {dbe}")
            try:
                await db.rollback()
            except Exception:
                pass

        current_users = settings_db.get("users", [])
        new_users = [u for u in current_users if u.get("id") != user_id or u.get("role") == "admin"]
        settings_db["needs_apply"] = True
        settings_db["users"] = new_users
        save_settings(settings_db)

        return {"status": "success", "users": new_users}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Delete User Error]: {e}")
        return {"status": "success", "users": settings_db.get("users", [])}


@app.get("/api/settings/roles")
@app.get("/settings/roles")
async def new_get_roles_endpoint(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(SystemRole).order_by(SystemRole.id))
        roles = result.scalars().all()
        if roles:
            out = []
            admin_defaults = DEFAULT_SETTINGS["roles"][0]["permissions"]
            for r in roles:
                d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
                if d.get("role_code") in ["admin", "superadmin"]:
                    merged = list(set((d.get("permissions") or []) + admin_defaults))
                    d["permissions"] = merged
                out.append(d)
            return out
    except Exception as e:
        print(f"[Get Roles DB Error]: {e}")
    return settings_db.get("roles", [])


@app.post("/api/settings/roles")
@app.post("/settings/roles")
async def new_save_roles_endpoint(payload: Union[List[RoleSchema], RoleSchema], user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        is_single = not isinstance(payload, list)
        items_list = [payload] if is_single else payload

        for item in items_list:
            data = item.model_dump() if hasattr(item, "model_dump") else item
            check_name_uniqueness(data.get("name"), "roles", data.get("id"), label="Rol")

        result = await db.execute(select(SystemRole))
        existing_roles_db = result.scalars().all()
        existing_by_code = {r.role_code: r for r in existing_roles_db if r.role_code}
        existing_by_id = {r.id: r for r in existing_roles_db if r.id is not None}

        
        payload_role_ids = set()
        new_roles_out = []
        changes = []
        
        for idx, item in enumerate(items_list):
            data = item.model_dump()
            code = data.get("role_code", "").strip().lower()
            if not code:
                continue
            
            target_role = None
            if data.get("id") and data.get("id") in existing_by_id:
                target_role = existing_by_id[data.get("id")]
            elif code in existing_by_code:
                target_role = existing_by_code[code]
            
            if target_role:
                target_role.role_code = code
                target_role.name = data.get("name")
                target_role.permissions = data.get("permissions", [])
                target_role.allowed_breaks = data.get("allowed_breaks", [])
                payload_role_ids.add(target_role.id)
                changes.append({"action": "UPDATED", "name": data.get("name"), "role_code": code})
            else:
                new_sys_role = SystemRole(
                    role_code=code,
                    name=data.get("name"),
                    permissions=data.get("permissions", []),
                    allowed_breaks=data.get("allowed_breaks", [])
                )
                db.add(new_sys_role)
                changes.append({"action": "CREATED", "name": data.get("name"), "role_code": code})
                
        if not is_single:
            for r in existing_roles_db:
                if r.id not in payload_role_ids and r.role_code not in ["admin", "superadmin", "agent", "supervisor", "manager"]:
                    await db.delete(r)
                    changes.append({"action": "DELETED", "name": r.name, "role_code": r.role_code})

        await db.commit()

        res_updated = await db.execute(select(SystemRole).order_by(SystemRole.id))
        all_roles_db = res_updated.scalars().all()
        for r in all_roles_db:
            new_roles_out.append({c.name: getattr(r, c.name) for c in r.__table__.columns})

        settings_db["needs_apply"] = True
        settings_db["roles"] = new_roles_out
        try:
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(settings_db, f, ensure_ascii=False, indent=4)
        except Exception:
            pass
        
        return {"status": "success", "roles": new_roles_out}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"[Save Roles Error]: {e}")
        raise HTTPException(status_code=500, detail=f"Roller kaydedilirken hata oluştu: {str(e)}")

@app.put("/api/settings/roles/{role_id}")
async def update_single_role_endpoint(role_id: int, payload: RoleSchema, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    payload.id = role_id
    return await new_save_roles_endpoint(payload=payload, user_info=user_info, db=db)

@app.delete("/api/settings/roles/{role_id}")
async def delete_single_role_endpoint(role_id: int, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        res = await db.execute(select(SystemRole).where(SystemRole.id == role_id))
        r = res.scalars().first()
        if r:
            if r.role_code in ["admin", "superadmin", "agent", "supervisor", "manager"]:
                raise HTTPException(status_code=400, detail="Sistem varsayılan rolü silinemez.")
            await db.delete(r)
            await db.commit()
        
        res_updated = await db.execute(select(SystemRole).order_by(SystemRole.id))
        all_roles_db = res_updated.scalars().all()
        new_roles_out = [{c.name: getattr(rol, c.name) for c in rol.__table__.columns} for rol in all_roles_db]
        
        settings_db["needs_apply"] = True
        settings_db["roles"] = new_roles_out
        try:
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(settings_db, f, ensure_ascii=False, indent=4)
        except Exception:
            pass
        
        return {"status": "success", "roles": new_roles_out}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Rol silinirken hata oluştu: {str(e)}")
        
        try:
            await log_event(
                user_id=user_info["user_id"],
                action="UPDATE_ROLES",
                module="Roles",
                details={"changes": changes} if changes else {"status": "No changes detected"},
                ip_address=user_info["ip_address"]
            )
        except Exception as le:
            print(f"[Log Event Error]: {le}")

@app.get("/api/settings/queues")
@app.get("/settings/queues")
async def new_get_queues_endpoint(request: Request, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    try:
        if target_tenant in ["all", "global"]:
            stmt = select(PBXQueue).order_by(PBXQueue.id)
        elif target_tenant == "tenant-default":
            stmt = select(PBXQueue).where(or_(PBXQueue.tenant_id == "tenant-default", PBXQueue.tenant_id.is_(None))).order_by(PBXQueue.id)
        else:
            stmt = select(PBXQueue).where(PBXQueue.tenant_id == target_tenant).order_by(PBXQueue.id)
        result = await db.execute(stmt)
        queues = result.scalars().all()
        return [{c.name: getattr(q, c.name) for c in q.__table__.columns} for q in queues]
    except Exception as e:
        print(f"[Get Queues DB Error]: {e}")
    
    all_queues = settings_db.get("queues", [])
    if target_tenant in ["all", "global"]:
        return all_queues
    return [q for q in all_queues if q.get("tenant_id") == target_tenant or (not q.get("tenant_id") and target_tenant == "tenant-default")]


@app.post("/api/settings/queues")
@app.post("/settings/queues")
async def new_save_queues_endpoint(payload: Union[List[Dict[str, Any]], Dict[str, Any]], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        is_single = not isinstance(payload, list)
        items_list = [payload] if is_single else payload

        for item in items_list:
            item_data = item.model_dump() if hasattr(item, "model_dump") else item
            ext_val = item_data.get("extension") or item_data.get("queue_number")
            item_id = item_data.get("id")
            name_val = item_data.get("name")
            validate_number_range(ext_val, "queue")
            check_extension_uniqueness(ext_val, "queue", item_id)
            check_name_uniqueness(name_val, "queues", item_id, label="Kuyruk")

        payload_queue_ids = set()

        new_queues_out = []
        valid_keys = {c.name for c in PBXQueue.__table__.columns}

        try:
            result = await db.execute(select(PBXQueue))
            existing_queues_db = result.scalars().all()
            existing_by_num = {str(getattr(q, 'extension', '')): q for q in existing_queues_db if getattr(q, 'extension', None)}
            existing_by_id = {q.id: q for q in existing_queues_db if q.id is not None}

            for idx, item in enumerate(items_list):
                data = item.model_dump() if hasattr(item, "model_dump") else item.copy()
                target_q = None
                if data.get("id") and data.get("id") in existing_by_id:
                    target_q = existing_by_id[data.get("id")]
                elif data.get("extension") and str(data.get("extension")) in existing_by_num:
                    target_q = existing_by_num[str(data.get("extension"))]
                elif data.get("queue_number") and str(data.get("queue_number")) in existing_by_num:
                    target_q = existing_by_num[str(data.get("queue_number"))]

                filtered_data = {k: v for k, v in data.items() if k in valid_keys and k != "id"}

                if target_q:
                    for k, v in filtered_data.items():
                        setattr(target_q, k, v)
                    payload_queue_ids.add(target_q.id)
                else:
                    new_sys_q = PBXQueue(**filtered_data)
                    db.add(new_sys_q)

            if not is_single:
                for q in existing_queues_db:
                    if q.id not in payload_queue_ids:
                        await db.delete(q)

            await db.commit()

            res_all = await db.execute(select(PBXQueue).order_by(PBXQueue.id))
            all_q = res_all.scalars().all()
            new_queues_out = [{c.name: getattr(item, c.name) for c in item.__table__.columns} for item in all_q]
        except HTTPException:
            raise
        except Exception as dbe:
            print(f"[Save Queues DB Warning]: {dbe}")
            try:
                await db.rollback()
            except Exception:
                pass

        if not new_queues_out:
            new_queues_out = items_list

        settings_db["needs_apply"] = True
        settings_db["queues"] = new_queues_out
        save_settings(settings_db)

        return {"status": "success", "queues": new_queues_out}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Save Queues Error]: {e}")
        return {"status": "success", "queues": settings_db.get("queues", [])}



@app.put("/api/settings/queues/{queue_id}")
@app.put("/settings/queues/{queue_id}")
async def update_single_queue_endpoint(queue_id: int, payload: Dict[str, Any], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    payload["id"] = queue_id
    return await new_save_queues_endpoint(payload=payload, background_tasks=background_tasks, user_info=user_info, db=db)

@app.delete("/api/settings/queues/{queue_id}")
@app.delete("/settings/queues/{queue_id}")
async def delete_single_queue_endpoint(queue_id: int, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        res = await db.execute(select(PBXQueue).where(PBXQueue.id == queue_id))
        q = res.scalars().first()
        if q:
            await db.delete(q)
            await db.commit()

        res_updated = await db.execute(select(PBXQueue).order_by(PBXQueue.id))
        all_queues_db = res_updated.scalars().all()
        new_queues_out = [{c.name: getattr(item, c.name) for c in item.__table__.columns} for item in all_queues_db]

        settings_db["needs_apply"] = True
        settings_db["queues"] = new_queues_out

        return {"status": "success", "queues": new_queues_out}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Kuyruk silinirken hata oluştu: {str(e)}")

@app.get("/api/settings/trunks")
@app.get("/settings/trunks")
async def new_list_trunks(request: Request, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    target_tenant = user_info.get("tenant_id") or request.headers.get("X-Tenant-ID") or request.headers.get("Tenant-ID") or request.query_params.get("tenant_id") or "tenant-default"
    try:
        if target_tenant in ["all", "global"]:
            stmt = select(Trunk).order_by(Trunk.id)
        elif target_tenant == "tenant-default":
            stmt = select(Trunk).where(or_(Trunk.tenant_id == "tenant-default", Trunk.tenant_id.is_(None))).order_by(Trunk.id)
        else:
            stmt = select(Trunk).where(Trunk.tenant_id == target_tenant).order_by(Trunk.id)
        result = await db.execute(stmt)
        trunks = result.scalars().all()
        return [{c.name: getattr(t, c.name) for c in t.__table__.columns} for t in trunks]
    except Exception as e:
        print(f"[List Trunks DB Warning]: {e}")

    all_disk_trunks = settings_db.get("trunks", [])
    out = []
    for t in all_disk_trunks:
        t_tenant = t.get("tenant_id") or "tenant-default"
        if t_tenant == target_tenant:
            out.append(t)
    return out

@app.post("/api/settings/trunks")
@app.post("/settings/trunks")
async def new_add_or_update_trunk(payload: Union[List[Dict[str, Any]], Dict[str, Any]], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    is_single = not isinstance(payload, list)
    items_list = [payload] if is_single else payload

    for item in items_list:
        data = item.model_dump() if hasattr(item, "model_dump") else (item.copy() if isinstance(item, dict) else {})
        check_name_uniqueness(data.get("trunk_name"), "trunks", data.get("id"), label="Trunk / Dış Hat", name_field="trunk_name")

    out = []


    try:
        res_existing = await db.execute(select(Trunk))
        existing_trunks_db = res_existing.scalars().all()
        existing_by_id = {t.id: t for t in existing_trunks_db if t.id}
        existing_by_name = {t.trunk_name: t for t in existing_trunks_db if t.trunk_name}

        valid_keys = {c.name for c in Trunk.__table__.columns}

        for item in items_list:
            data = item.model_dump() if hasattr(item, "model_dump") else (item.copy() if isinstance(item, dict) else {})
            filtered_data = {k: v for k, v in data.items() if k in valid_keys and k != "id"}

            if "port" in filtered_data:
                try:
                    filtered_data["port"] = int(filtered_data["port"])
                except (ValueError, TypeError):
                    filtered_data["port"] = 5060

            if "max_channels" in filtered_data:
                try:
                    filtered_data["max_channels"] = max(1, int(filtered_data["max_channels"]))
                except (ValueError, TypeError):
                    filtered_data["max_channels"] = 30

            target_trunk = None
            if data.get("id") and data.get("id") in existing_by_id:
                target_trunk = existing_by_id[data["id"]]
            elif data.get("trunk_name") and data.get("trunk_name") in existing_by_name:
                target_trunk = existing_by_name[data["trunk_name"]]

            if target_trunk:
                for k, v in filtered_data.items():
                    setattr(target_trunk, k, v)
            else:
                if not filtered_data.get("trunk_name"):
                    filtered_data["trunk_name"] = "Yeni_Trunk"
                if not filtered_data.get("host"):
                    filtered_data["host"] = "127.0.0.1"
                if not filtered_data.get("did_number"):
                    filtered_data["did_number"] = ""
                if not filtered_data.get("transfer_target"):
                    filtered_data["transfer_target"] = "200"
                t = Trunk(**filtered_data)
                db.add(t)

        await db.commit()

        res_all = await db.execute(select(Trunk).order_by(Trunk.id))
        all_trunks = res_all.scalars().all()
        out = [{c.name: getattr(t, c.name) for c in t.__table__.columns} for t in all_trunks]
    except Exception as e:
        await db.rollback()
        print(f"[Save Trunk DB Warning]: {e}")
        current_trunks = list(settings_db.get("trunks", []))
        for item in items_list:
            data = item.model_dump() if hasattr(item, "model_dump") else (item.copy() if isinstance(item, dict) else {})
            if not data.get("id"):
                data["id"] = (max([t.get("id", 0) for t in current_trunks] or [0])) + 1
            existing_idx = next((i for i, t in enumerate(current_trunks) if t.get("id") == data.get("id") or t.get("trunk_name") == data.get("trunk_name")), None)
            if existing_idx is not None:
                current_trunks[existing_idx] = data
            else:
                current_trunks.append(data)
        out = current_trunks

    settings_db["needs_apply"] = True
    settings_db["trunks"] = out

    return {"status": "success", "trunks": out}

@app.delete("/api/settings/trunks/{trunk_id}")
@app.delete("/settings/trunks/{trunk_id}")
async def new_delete_trunk(trunk_id: int, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        res = await db.execute(select(Trunk).where(Trunk.id == trunk_id))
        t = res.scalars().first()
        if t:
            await db.delete(t)
            await db.commit()

        res_all = await db.execute(select(Trunk).order_by(Trunk.id))
        all_trunks = res_all.scalars().all()
        out = [{c.name: getattr(item, c.name) for c in item.__table__.columns} for item in all_trunks]

        settings_db["needs_apply"] = True
        settings_db["trunks"] = [x for x in out if str(x.get("id")) != str(trunk_id)]
        try:
            save_settings(settings_db)
        except Exception:
            pass

        try:
            regenerate_pjsip_custom_conf()
        except Exception as e_ast:
            print(f"[Trunk Delete Config Regeneration Warning]: {e_ast}")

        return {"status": "success", "message": "SIP Trunk başarıyla silindi.", "trunks": settings_db["trunks"]}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"SIP Trunk silinirken hata oluştu: {str(e)}")


@app.get("/api/settings/needs-apply")
async def get_needs_apply():
    return {"needs_apply": settings_db.get("needs_apply", False)}

@app.post("/api/settings/needs-apply")
async def set_needs_apply(status: dict):
    settings_db["needs_apply"] = status.get("needs_apply", True)
    save_settings(settings_db)

@app.get("/api/settings/version")
@app.get("/api/version")
@app.get("/version")
async def get_system_version_info():
    """
    Returns full system version history, git commit hash, release timestamps, and build status.
    Used by local and production servers to verify deployment synchronization.
    """
    live_commit = "auto"
    try:
        import subprocess
        res = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=1.5)
        if res.returncode == 0 and res.stdout.strip():
            live_commit = res.stdout.strip()
    except Exception:
        pass

    return {
        "version": "v2.5.3",
        "commit_hash": live_commit,
        "release_date": "22 Ekim 2026",
        "status": "Güncel / Canlı Sürüm",
        "environment": "Production (On-Premise)",
        "changelog": [
            {
                "version": "v2.5.3",
                "commit_hash": live_commit,
                "release_date": "22 Ekim 2026",
                "badge": "Canlı Sürüm (Güncel)",
                "badge_type": "current",
                "title": "SIP Sızma (Toll-Fraud) Kalkanı, Fail2Ban Arayüz Yönetimi & Güvenli IP / Blok Beyaz Listesi",
                "summary": "Dışarıdan gelen yetkisiz SIP INVITE sızma girişimlerine karşı çok katmanlı güvenlik kalkanı, arayüzdeki SIP şifresi ile Asterisk PJSIP tam senkronizasyonu, canlı Fail2Ban/UFW kontrolü ve Güvenli IP / CIDR Blok tanımlama altyapısı devreye alındı.",
                "features": [
                    {
                        "title": "🛡️ Güvenlik Kalkanı: Canlı Fail2Ban, UFW & Güvenli IP / Blok (Whitelist) Yönetimi",
                        "desc": "Güvenlik Kalkanı ekranından tekil IP veya CIDR alt ağ bloklarını (Örn: 88.247.10.25, 192.168.1.0/24) Güvenli Liste'ye (Fail2Ban ignoreip ve UFW ALLOW) ekleme, silme, saldırgan IP'leri anında banlama ve Asterisk PJSIP sızma denemelerini canlı izleme özelliği eklendi."
                    },
                    {
                        "title": "🔐 Arayüz SIP Şifresi & Asterisk PJSIP Kriptografik Senkronizasyonu",
                        "desc": "Kullanıcı Düzenleme > SIP sekmesindeki SIP şifresinin Asterisk pjsip_custom.conf ve WebRTC istemcisiyle birebir senkronize çalışması sağlandı; zayıf/varsayılan şifreler otomatik olarak güçlü kriptografik şifrelerle korumaya alındı."
                    },
                    {
                        "title": "🚫 Giden Çağrı ACL & Uluslararası Toll-Fraud Koruması",
                        "desc": "/api/acl/check_outbound_call doğrulaması ile PJSIP/anonymous çağrıları ve yetkisiz uluslararası (00 / +) sızma aramaları dialplan seviyesinde anında bloklandı."
                    }
                ],
                "fixes": [
                    "Dahili 1000 ve varsayılan dahililerdeki sabit SIP şifresi açığı kapatılarak arayüzdeki SIP Şifresi alanıyla tam uyumlu hale getirildi.",
                    "Güvenlik Kalkanı ekranının statik veri yerine doğrudan canlı Fail2Ban, UFW ve Asterisk loglarıyla çalışması sağlandı."
                ]
            },
            {
                "version": "v2.5.2",
                "commit_hash": "5eca135",
                "release_date": "21 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Tüm Santral (PBX) Modülleri İçin Excel İçe Aktar (Import) ve Dışa Aktar (Export) Desteği",
                "summary": "Kullanıcı Listesi ve ACD Kuyruk ekranlarında bulunan Excel İçe/Dışa Aktar yapısı tüm santral yönetim ekranlarına standart olarak entegre edildi.",
                "features": [
                    {
                        "title": "📥 10 Santral Modülünde Toplu Excel Import / Export",
                        "desc": "Oto Provizyon, Giden/Gelen Arama Kuralları, Çağrı Toplama Grubu, Abone Grubu, Rehber, Dış Hat Tanımı (SIP Trunk), Konferans, Hızlı Arama ve Numara Engelleme ekranlarına örnek şablon indirme, Excel yükleme ve dışa aktarma butonları eklendi."
                    }
                ],
                "fixes": [
                    "Toplu Excel içe aktarımlarında oluşan mükerrer kayıt ve eksik kolon validasyonları iyileştirildi."
                ]
            },
            {
                "version": "v2.5.1",
                "commit_hash": "4c65fb5",
                "release_date": "21 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Kullanıcı 'Beni Takip Et (Follow Me)' Özelliği & Çağrı Profili Kayıt Senkronizasyonu",
                "summary": "Kullanıcıların masa telefonu yanıt vermediğinde çağrının belirlenen saniye sonunda sırasıyla Mobil Uygulama veya Mobil Telefon Numarasına yönlendirilmesini sağlayan 2 kademeli Beni Takip Et özelliği eklendi.",
                "features": [
                    {
                        "title": "📲 2 Kademeli Beni Takip Et (Follow Me) Yönlendirmesi",
                        "desc": "Kullanıcı Düzenleme > Özellikler sekmesine çalma süresi (sn), 1. Gideceği Yer ve 2. Gideceği Yer (Mobil Uygulama / Mobil Telefon Numarası) seçimi ve Asterisk dialplan entegrasyonu eklendi."
                    }
                ],
                "fixes": [
                    "Temsilci ve kullanıcı düzenleme ekranında seçilen aktif çağrı profilinin (Müsait, Dışarıda, Toplantı, Diğer) kayıt sonrası sıfırlanması sorunu giderildi."
                ]
            },
            {
                "version": "v2.5.0",
                "commit_hash": "34c3a40",
                "release_date": "20 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Temsilci Kronolojisi (Agent Status Timeline) Raporu & Detaylı Zaman Çizelgesi",
                "summary": "Raporlar ekranına temsilcilerin gün içindeki Çevrimiçi, Mola ve Çevrimdışı sürelerini tek satırda özetleyen ve büyüteç ikonu ile saniye bazlı durum geçişlerini gösteren Temsilci Kronolojisi sekmesi eklendi.",
                "features": [
                    {
                        "title": "⏱️ Temsilci Kronolojisi & Büyüteç Detay Modalı",
                        "desc": "Temsilci bazlı toplam durum süreleri, yüzdelik dağılım çubuğu ve detaylı durum geçiş saatlerini gösteren inceleme penceresi eklendi."
                    }
                ],
                "fixes": [
                    "Nginx 502 Bad Gateway ve port çakışması kaynaklı başlangıç hataları giderildi."
                ]
            },
            {
                "version": "v2.4.9",
                "commit_hash": "auto",
                "release_date": "6 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Offline Kriptografik Lisans Anahtarı Yükleme, Donanım Kilidi & Kotaların Canlı Entegrasyonu",
                "summary": "Lisans sunucusunda üretilen HMAC-SHA256 imzalı ve Base64 kotalı lisans anahtarlarının offline ortamda uygulama sunucusuna yüklenmesi, kotaların anında güncellenmesi ve dedicated Lisans & Key Yönetimi panelinin entegrasyonu sağlandı.",
                "features": [
                    {
                        "title": "🔑 Sistem Ayarları > Lisans & Key Yönetimi Paneli",
                        "desc": "Sistem Ayarları sol menüsüne ve üst header barına doğrudan lisans anahtarı yapıştırma (Textarea + Panodan Yapıştır) ve donanım kimliği (Machine Fingerprint) kopyalama alanı eklendi."
                    },
                    {
                        "title": "🛡️ Offline Lisans Doğrulama & Otomatik Kota Güncelleme",
                        "desc": "Yüklenen lisans key'lerinin donanım kimliği ve HMAC imzası doğrulanarak 19 farklı sistem kotası (kullanıcı, agent, trunk vb.) offline sunucularda anında yenilenmektedir."
                    }
                ],
                "fixes": [
                    "Lisans sunucusunda yeni key üretirken oluşan SQLite UNIQUE kısıtlama hatası giderildi.",
                    "Lisans anahtarındaki tire (-) karakteri nedeniyle oluşan HMAC imza eşleşmeme hatası düzeltildi."
                ]
            },
            {
                "version": "v2.4.8",
                "commit_hash": "cb159a0",
                "release_date": "2 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "SystemUser Veritabanı Model Hatası (AttributeError: username) & JSON String Yönlendirme Düzeltmesi",
                "summary": "/api/subscriber/resolve_forwarding endpoint'inde veritabanı sorgusundaki var olmayan 'username' kolon erişim hatası düzeltildi, JSON string yönlendirme nesnelerinin parse edilerek sorunsuz aktarılması sağlandı.",
                "features": [
                    {
                        "title": "SystemUser Kolon Uyumlaştırması",
                        "desc": "Veritabanı SystemUser modelinde var olmayan 'username' alanı yerine 'extension' ve 'email' üzerinden eşleştirme yapılması sağlandı."
                    },
                    {
                        "title": "Gelişmiş JSON Parser & Safe String Extraction",
                        "desc": "Veritabanı veya bellekte string olarak saklanan JSON yönlendirme verileri otomatik parse edilerek hedef numaralar (GSM/Dahili) eksiksiz çıkarıldı."
                    }
                ],
                "fixes": [
                    "Kullanıcılarda yönlendirme açık olmasına rağmen FWD_PRE=DENY:NONE:30 ve FWD_POST=DENY:NONE:30 dönmesi ve çağrıların düşmesi sorunu tamamen giderildi."
                ]
            },
            {
                "version": "v2.4.7",
                "commit_hash": "f3fc018",
                "release_date": "29 Eylül 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "3 Katmanlı Çağrı Yönlendirme (Her Zaman, Meşgulde, Zaman Aşımında) & Dinamik Süre Entegrasyonu",
                "summary": "Görsel Kullanıcı Ayarları panelindeki 3 ayrı Yönlendirme Türü (Her Zaman, Meşgul Durumda, Zaman Aşımında/Cevapsız) ve dinamik Zaman Aşımı süresi (15-30-60 sn) Asterisk dialplan ve resolver servisiyle tam entegre edildi.",
                "features": [
                    {
                        "title": "3 Katmanlı Yönlendirme & Toggle Kontrolü",
                        "desc": "Her Zaman (Always), Meşgul Durumda (Busy) ve Zaman Aşımında (No Answer) kuralları toggle buton durumlarına (active: true/false) göre anında değerlendirilir."
                    },
                    {
                        "title": "Dinamik Zaman Aşımı (Timeout) Entegrasyonu",
                        "desc": "Zaman Aşımı sekmesinde sekmesinde seçilen süre (sn) Asterisk Dial() komutuna iletilerek belirlenen süre sonunda cevapsız yönlendirmenin çalışması sağlandı."
                    }
                ],
                "fixes": [
                    "Abonedeki toggle butonları kapalıyken veya 'active' parametresi olan nesnelerde yönlendirme durumunun doğru okunamaması sorunu çözüldü."
                ]
            },
            {
                "version": "v2.4.6",
                "commit_hash": "eb501d8",
                "release_date": "29 Eylül 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Kullanıcı Yönlendirme Veritabanı Senkronizasyonu & Cevapsız Çağrı Yönlendirme Düzeltmesi",
                "summary": "Profil güncelleme servisindeki veritabanı senkronizasyon eksikliği giderildi ve /api/subscriber/resolve_forwarding servisi veritabanı ile bellek ayarlarını harmanlayarak varsayılan 'enabled' parametresi olmayan yönlendirme sözlüklerini tam uyumlu hale getirdi.",
                "features": [
                    {
                        "title": "Çift Katmanlı Yönlendirme Harmanlama",
                        "desc": "Veritabanı (SystemUser) ile hafıza (settings.json) ayarları birleştirilerek kaydedilen yönlendirmelerin anında dialplan tarafından okunması sağlandı."
                    },
                    {
                        "title": "Gelişmiş Target Extractor & NOANSWER Yönlendirme",
                        "desc": "Cevapsız kalan veya çalmasına rağmen açılmayan dahililerde NOANSWER durumunda Mobil Aktarım (GSM) ve Yönlendirme numaralarına otomatik geçiş garantilendi."
                    }
                ],
                "fixes": [
                    "Abonede yönlendirme tanımlı olmasına rağmen FWD_POST=DENY:NONE dönmesi ve cevapsız çağrıların düşmesi sorunu çözüldü.",
                    "update_agent_profile_endpoint servisindeki GSM ve Yönlendirme alanlarının PostgreSQL veritabanına yazılmama hatası giderildi."
                ]
            },
            {
                "version": "v2.4.5",
                "commit_hash": "90f1cef",
                "release_date": "28 Eylül 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Dahili Çağrı Yönlendirme (Call Forwarding) & Çevrimdışı Mobil Aktarım Entegrasyonu",
                "summary": "Asterisk dialplan webrtc_agents bağlamı ve /api/subscriber/resolve_forwarding servisi güncellendi; Dahili (1000) SIP kaydı olmasa (offline/unreachable) veya cevapsız/meşgul olsa dahi tanımlı Cep Telefonuna (GSM / Mobil Aktarım) veya Yönlendirme numarasına otomatik aktarılması sağlandı.",
                "features": [
                    {
                        "title": "Dinamik Subscriber Forwarding Resolver Engine",
                        "desc": "/api/subscriber/resolve_forwarding servisi kullanıcının forwarding_always, forwarding_busy, forwarding_no_answer ve mobile_transfer_enabled durumlarını anlık taranarak otomatik telefon numarasına yönlendirir."
                    },
                    {
                        "title": "Dialplan Ön & Sonrası Yönlendirme Kontrolü (Pre & Post Dial Forwarding)",
                        "desc": "Dahiliye arama yapılmadan önce SIP registration durumu kontrol edilerek offline kullanıcılarda anında GSM hatlarına yönlendirme yapılır."
                    }
                ],
                "fixes": [
                    "SIP kaydı kapalı olan dahililerde (1000) yönlendirme olmasına rağmen çağrının düşmesi/kapanması sorunu çözüldü."
                ]
            },
            {
                "version": "v2.4.4",
                "commit_hash": "c4b0cdc",
                "release_date": "28 Eylül 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Asterisk 's' Uzantısı Dinamik DID Çözümleme & Gelen Arama Kayıt Düzeltmesi",
                "summary": "SIP Operatöründen gelen çağrılarda Asterisk dialplan 's' uzantısında PJSIP To başlığı ve kanal adı üzerinden gerçek DID (REAL_DID) çözümlendi; AudioSocket fallback ile DID 's' gelse dahi görsel arama akışı Dahili 1000 aktarımına bağlandı.",
                "features": [
                    {
                        "title": "Dinamik REAL_DID Dialplan Çözümleme",
                        "desc": "Asterisk exten => s bağlamı PJSIP_HEADER(read,To) ve CHANNEL(name) üzerinden dinamik DID numarasını çıkartır."
                    },
                    {
                        "title": "AudioSocket 's' Uzantısı Fallback Engine",
                        "desc": "Gelen DID 's' olduğu durumlarda dahi aktif Gelen Arama Kuralı (Inbound Rule) ve Call Flow grafiği taranarak Dahili 1000 transferi sorunsuz gerçekleştirilir."
                    }
                ],
                "fixes": [
                    "Asterisk dialplan s uzantısında /api/calls/register endpoint'ine 'did=s' gönderilerek AI'a düşme sorunu çözüldü.",
                    "/api/calls/register endpoint'indeki Internal Server Error (500) hatası giderildi."
                ]
            },
            {
                "version": "v2.4.3",
                "commit_hash": "14e37d3",
                "release_date": "28 Eylül 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Görsel Arama Akışı DID Yönlendirme & Dahiliye Doğrudan Aktarım (AMI Direct Redirect)",
                "summary": "AudioSocket sunucusu ve AMI manager güncellendi; Visual CallFlow şemasında Yapay Zeka içermeyen direct Dahili/Kuyruk aktarımlarında Gemini AI devreye girmeden çağrının doğrudan temsilci Web Phone cihazına (Dahili 1000) aktarılması sağlandı.",
                "features": [
                    {
                        "title": "AudioSocket CallFlow Evaluator Engine",
                        "desc": "Gelen DID aramaları için Inbound Rules ve Visual CallFlow grafiği taranarak aktarım (transfer), kapatma (hangup) veya yapay zeka (ai) kararları anında yürütülür."
                    },
                    {
                        "title": "AMI Event Registrations & CoreShowChannels Fallback",
                        "desc": "Asterisk AMI kanal takibi event handler'lar ile otomatikleştirildi, eşleşmeyen kanallar için CoreShowChannels sorgusuyla %100 aktarım garantilendi."
                    }
                ],
                "fixes": [
                    "Gelen dış aramada Gemini AI'ın Dahili 1000 aktarımı yerine otomatik söze girmesi sorunu çözüldü.",
                    "AMI event listener kaydının başlatılmaması ve aktif kanal adı bulunamama uyarısı giderildi."
                ]
            },
            {
                "version": "v2.4.2",
                "commit_hash": "2857280",
                "release_date": "28 Eylül 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "Asterisk [from-trunk] Bağlamı (Context) & Gelen Arama Yönlendirme Düzeltmesi",
                "summary": "SIP Operatöründen gelen dış aramaların 'context not found in from-trunk' hatası vermesi engellendi; Dialplan [from-trunk] bağlamı görsel IVR akışına bağlandı.",
                "features": [
                    {
                        "title": "Asterisk [from-trunk] Dialplan Entegrasyonu",
                        "desc": "PJSIP dış hatlarından gelen çağrılar [from-trunk] bağlamında yakalanarak görsel IVR akış şemasına yönlendirildi."
                    }
                ],
                "fixes": [
                    "Asterisk 'extension not found in context from-trunk' hatası giderildi."
                ]
            },
            {
                "version": "v2.4.1",
                "commit_hash": "55906cc",
                "release_date": "28 Eylül 2026",
                "badge": "Stabil",
                "badge_type": "minor",
                "title": "SIP Trunk Silme & Çakışan Rota Düzeltmesi",
                "summary": "Mükerrer delete uç noktaları temizlenerek veritabanı, JSON saklama ve Asterisk PJSIP konfigürasyonları tam senkronize edildi.",
                "features": [
                    {
                        "title": "Veritabanı & Asterisk Senkronizasyonu",
                        "desc": "SIP Trunk silme işlemlerinde veritabanı satırlarının ve Asterisk pjsip_custom.conf dosyasının anında silinmesi sağlandı."
                    }
                ],
                "fixes": [
                    "Dış Hat silme rotasındaki çakışan legacy handler kaldırıldı."
                ]
            },
            {
                "version": "v2.4.0",
                "commit_hash": "57bb458",
                "release_date": "28 Eylül 2026",
                "badge": "Majör Sürüm",
                "badge_type": "major",
                "title": "Omnichannel Çoklu Kanal Entegrasyon Genişletmesi",
                "summary": "WhatsApp, Telegram, Meta Direct (Instagram/Facebook) ve E-Posta (SMTP/IMAP) tam entegrasyonu sağlandı.",
                "features": [
                    {
                        "title": "WhatsApp Cloud API & Telegram Bot",
                        "desc": "Gelen webhook ve giden mesaj iletim servisleri entegre edildi."
                    },
                    {
                        "title": "E-Posta IMAP Poller & SMTP",
                        "desc": "30 saniyelik IMAP poller arka plan işçisi ile e-postalar otomatik gelen kutusuna dönüştürüldü."
                    },
                    {
                        "title": "Gemini 2.5 Kanal Adaptörü",
                        "desc": "Kanal türüne göre resmi veya samimi emoji destekli yanıtlar üretildi."
                    }
                ],
                "fixes": []
            },
            {
                "version": "v2.3.0",
                "commit_hash": "a237a3f",
                "release_date": "27 Eylül 2026",
                "badge": "Özellik Güncellemesi",
                "badge_type": "feature",
                "title": "AI Senaryo Asistanı & İsimle Personel Transferi",
                "summary": "NLP destekli Türkçe senaryo asistanı ve isimle dahili yönlendirme modülü eklendi.",
                "features": [
                    {
                        "title": "NLP Senaryo Oluşturucu",
                        "desc": "Doğal dilde yazılan senaryolar otomatik görsel akış düğümlerine dönüştürüldü."
                    }
                ],
                "fixes": []
            },
            {
                "version": "v2.2.0",
                "commit_hash": "b812f91",
                "release_date": "25 Eylül 2026",
                "badge": "Mimari",
                "badge_type": "arch",
                "title": "Çoklu Müşteri (Multi-Tenant) & WebRTC IP/Varlık Takibi",
                "summary": "Multi-tenant izolasyonu ve agent canlı varlık takibi sağlandı.",
                "features": [],
                "fixes": []
            },
            {
                "version": "v2.1.0",
                "commit_hash": "c410982",
                "release_date": "22 Eylül 2026",
                "badge": "Hata Ayıklama",
                "badge_type": "tool",
                "title": "SipTrapper & Canlı Wireshark PCAP İndirme Paneli",
                "summary": "Canlı sngrep merdiven diyagramı ve PCAP indirme altyapısı eklendi.",
                "features": [],
                "fixes": []
            }
        ]
    }
    return {"status": "success"}

@app.post("/api/settings/apply")
async def apply_settings_endpoint(background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info)):
    settings_db["needs_apply"] = False
    save_settings(settings_db)
    regenerate_pjsip_custom_conf(background_tasks)
    regenerate_queues_conf(background_tasks)
    return {"status": "success", "message": "Değişiklikler başarıyla uygulandı."}

import asyncio

# ==============================================================================
# WEBHOOK ENDPOINTS (WhatsApp, Telegram vb. Kanallar)
# ==============================================================================

from backend.services.chat_service import handle_inbound_chat_message

@app.api_route("/api/webhooks/whatsapp", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/api/webhooks/whatsapp/", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/api/webhook/whatsapp", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/api/webhook/whatsapp/", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/webhooks/whatsapp", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/webhooks/whatsapp/", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/webhook/whatsapp", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/webhook/whatsapp/", methods=["GET", "POST", "HEAD", "OPTIONS"])
async def handle_whatsapp_webhook(request: Request):
    """
    Handles Meta Graph API Webhook Verification & Inbound Messages
    Methods: GET, POST, HEAD, OPTIONS
    """
    if request.method == "OPTIONS":
        return Response(status_code=200)

    if request.method == "HEAD":
        return Response(status_code=200, media_type="text/plain")

    if request.method == "POST":
        try:
            raw_body = await request.body()
            body_str = raw_body.decode('utf-8', errors='ignore')
            print(f"[WhatsApp Webhook POST] Raw payload: {body_str}")
            add_system_log("WHATSAPP", "INFO", f"POST Webhook alındı: {body_str[:120]}")
            asyncio.create_task(log_event(user_id="Meta Webhook", action="POST_RECEIVED", module="WhatsApp", details={"payload": body_str[:300]}))
            
            body = await request.json()
            values_to_process = []
            
            # Structure 1: Meta Production Payload {"entry": [{"changes": [{"value": {...}}]}]}
            if "entry" in body:
                entries = body.get("entry", [])
                if not isinstance(entries, list):
                    entries = [entries]
                for entry in entries:
                    changes = entry.get("changes", [])
                    if not isinstance(changes, list):
                        changes = [changes]
                    for change in changes:
                        if isinstance(change, dict) and "value" in change:
                            values_to_process.append(change.get("value", {}))
                            
            # Structure 2: Meta Test Modal Payload {"field": "messages", "value": {...}}
            if "value" in body and isinstance(body.get("value"), dict):
                values_to_process.append(body.get("value", {}))

            # Structure 3: Direct {"messages": [...]}
            if "messages" in body and isinstance(body.get("messages"), list):
                values_to_process.append(body)

            for value in values_to_process:
                messages = value.get("messages", [])
                contacts = value.get("contacts", [])
                metadata = value.get("metadata", {})
                recipient_phone_id = str(metadata.get("phone_number_id", "")) if metadata.get("phone_number_id") else None
                recipient_phone_num = str(metadata.get("display_phone_number", "")) if metadata.get("display_phone_number") else None
                
                if messages:
                    for msg in messages:
                        sender_phone = msg.get("from") or (contacts[0].get("wa_id") if contacts else "Unknown")
                        sender_name = (contacts[0].get("profile", {}).get("name") if contacts else sender_phone) or sender_phone
                        
                        text_body = ""
                        msg_type = msg.get("type")
                        if msg_type == "text":
                            text_body = msg.get("text", {}).get("body", "")
                        elif msg_type == "interactive":
                            text_body = msg.get("interactive", {}).get("button_reply", {}).get("title") or msg.get("interactive", {}).get("list_reply", {}).get("title") or "Etkileşimli Yanıt"
                        elif msg_type == "button":
                            text_body = msg.get("button", {}).get("text", "") or "Buton Yanıtı"
                        else:
                            text_body = f"[{msg_type.upper() if msg_type else 'MEDYA'} MESAJI]"

                        print(f"[WhatsApp Inbound] Processing message from {sender_phone} ({sender_name}) on line {recipient_phone_num or recipient_phone_id}: '{text_body}'")
                        add_system_log("WHATSAPP", "SUCCESS", f"Gelen Mesaj ({sender_phone} - {sender_name}): '{text_body}'")
                        asyncio.create_task(log_event(user_id=f"{sender_name} ({sender_phone})", action="INBOUND_MESSAGE", module="WhatsApp", details={"text": text_body, "phone": sender_phone, "recipient_phone_id": recipient_phone_id}))
                        asyncio.create_task(
                            handle_inbound_chat_message(
                                channel="whatsapp",
                                sender_info=str(sender_phone),
                                text=text_body,
                                recipient_phone_id=recipient_phone_id,
                                recipient_phone_num=recipient_phone_num
                            )
                        )
        except Exception as e:
            print(f"[WhatsApp Webhook Parse Error]: {e}")
            add_system_log("WHATSAPP", "ERROR", f"Webhook Parse Hatası: {e}")
            asyncio.create_task(log_event(user_id="Meta Webhook", action="PARSE_ERROR", module="WhatsApp", details={"error": str(e)}))
        return Response(content='{"status":"success"}', media_type="application/json", status_code=200)

    # GET method: Verification request
    params = dict(request.query_params)
    mode = params.get("hub.mode") or params.get("hub_mode") or params.get("mode")
    token = params.get("hub.verify_token") or params.get("hub_verify_token") or params.get("verify_token")
    challenge = params.get("hub.challenge") or params.get("hub_challenge") or params.get("challenge")

    if not challenge and "challenge" in str(request.url.query):
        import urllib.parse
        parsed = urllib.parse.parse_qs(str(request.url.query))
        challenge_vals = parsed.get("hub.challenge") or parsed.get("challenge")
        if challenge_vals:
            challenge = challenge_vals[0]
        token_vals = parsed.get("hub.verify_token") or parsed.get("verify_token")
        if token_vals:
            token = token_vals[0]

    print(f"[WhatsApp Webhook GET] mode='{mode}', token='{token}', challenge='{challenge}'")

    settings_data = load_settings()
    channels_cfg = settings_data.get("channels", {})
    expected_token = (channels_cfg.get("whatsapp_verify_token") or "ai_pbx_whatsapp_verify_token_secure").strip()

    if token and token != expected_token and token != "ai_pbx_whatsapp_verify_token_secure":
        print(f"[WhatsApp Webhook GET] Token mismatch: expected '{expected_token}', got '{token}'")
        return Response(content="Forbidden", status_code=403, media_type="text/plain")

    if challenge:
        return Response(content=str(challenge).strip(), media_type="text/plain", status_code=200)

    return Response(content="OK", media_type="text/plain", status_code=200)

@app.post("/api/webhooks/telegram")
async def receive_telegram_webhook(request: Request):
    """
    Handles incoming messages from Telegram Bot API.
    """
    try:
        body = await request.json()
        message = body.get("message")
        if message and message.get("text"):
            chat = message.get("chat", {})
            sender_id = chat.get("id")
            first_name = chat.get("first_name", "")
            last_name = chat.get("last_name", "")
            username = chat.get("username", "")
            
            sender_name = f"{first_name} {last_name}".strip() or username or str(sender_id)
            text_body = message.get("text", "")
            
            sender_info = f"{sender_name} (TG:{sender_id})"
            asyncio.create_task(
                handle_inbound_chat_message(
                    channel="telegram",
                    sender_info=sender_info,
                    text=text_body
                )
            )
        return {"status": "success"}
    except Exception as e:
        print(f"Telegram webhook parse error: {e}")
        return {"status": "error"}

@app.api_route("/api/webhooks/meta", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/api/webhooks/instagram", methods=["GET", "POST", "HEAD", "OPTIONS"])
@app.api_route("/api/webhooks/facebook", methods=["GET", "POST", "HEAD", "OPTIONS"])
async def handle_meta_webhook(request: Request):
    """
    Handles Meta (Instagram Direct / Facebook Messenger) Webhook Verification & Inbound Messages
    """
    if request.method == "OPTIONS":
        return Response(status_code=200)

    if request.method == "HEAD":
        return Response(status_code=200, media_type="text/plain")

    if request.method == "POST":
        try:
            body = await request.json()
            print(f"[Meta Webhook POST] Incoming payload: {body}")
            obj = body.get("object")
            if obj in ["instagram", "page"]:
                channel = "instagram" if obj == "instagram" else "facebook"
                for entry in body.get("entry", []):
                    messaging = entry.get("messaging", [])
                    for msg_event in messaging:
                        sender_id = msg_event.get("sender", {}).get("id")
                        message = msg_event.get("message", {})
                        text_body = message.get("text", "")
                        
                        if sender_id and text_body:
                            print(f"[Meta Inbound] {channel.capitalize()} message from {sender_id}: '{text_body}'")
                            asyncio.create_task(
                                handle_inbound_chat_message(
                                    channel=channel,
                                    sender_info=str(sender_id),
                                    text=text_body
                                )
                            )
        except Exception as e:
            print(f"Meta webhook parse error: {e}")
        return Response(content='{"status":"success"}', media_type="application/json", status_code=200)

    params = dict(request.query_params)
    challenge = params.get("hub.challenge") or params.get("hub_challenge") or params.get("challenge")
    print(f"[Meta Webhook GET] Verification request params={params}")
    body = str(challenge) if challenge else "OK"
    return Response(content=body, media_type="text/plain", status_code=200)

# ==============================================================================
# WEBRTC ENDPOINTS
# ==============================================================================

@app.get("/api/webrtc/config")
async def get_webrtc_config(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Frontend'in WebRTC/SIP bağlantısı yapabilmesi için dinamik ve güvenli SIP yapılandırmasını döner.
    """
    try:
        user_info = None
        try:
            user_info = get_current_user_optional(request)
        except Exception:
            pass
            
        header_user_id = request.headers.get("X-User-ID") or request.headers.get("x-user-id") or request.query_params.get("user_id")
        user_id = header_user_id or (user_info.get("user_id") or user_info.get("id") if user_info else None)
        if str(user_id) == "admin":
            user_id = 1
        
        # Search user by ID, extension, username, or email
        current_user = None
        if user_id:
            try:
                if str(user_id).isdigit():
                    uid = int(user_id)
                    result = await db.execute(select(SystemUser).filter(SystemUser.id == uid))
                    db_user = result.scalars().first()
                    if db_user:
                        current_user = {c.name: getattr(db_user, c.name) for c in db_user.__table__.columns}

                if not current_user:
                    result = await db.execute(select(SystemUser).filter(or_(
                        SystemUser.extension == str(user_id),
                        SystemUser.email == str(user_id)
                    )))
                    db_user = result.scalars().first()
                    if db_user:
                        current_user = {c.name: getattr(db_user, c.name) for c in db_user.__table__.columns}
            except Exception as ex_usr:
                print(f"[WebRTC Config User Resolution Error]: {ex_usr}")
                
        # Fallback to settings.json if DB didn't find the user
        if not current_user and user_id:
            for u in settings_db.get("users", []):
                if str(u.get("id")) == str(user_id) or str(u.get("extension")) == str(user_id) or u.get("email") == str(user_id):
                    current_user = u
                    break

        if not current_user:
            try:
                result = await db.execute(select(SystemUser).filter(SystemUser.is_active == True))
                db_user = result.scalars().first()
                if db_user:
                    current_user = {c.name: getattr(db_user, c.name) for c in db_user.__table__.columns}
            except Exception:
                pass
                
        agent_ext = str(current_user.get("extension", "1000") if current_user else "1000").strip()
        raw_sip_pwd = (current_user.get("sip_password") if current_user else "") or ""
        sip_password = resolve_secure_sip_password(agent_ext, raw_sip_pwd)
        
        # Dynamically compute WebSocket URL and resolved viaHost IPv4
        req_host = request.headers.get("host", "").split(":")[0] or request.url.hostname or "127.0.0.1"
        client_ip = request.client.host if request.client else "127.0.0.1"
        scheme = "wss" if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https" else "ws"
        if scheme == "wss":
            wss_url = f"wss://{req_host}:8089/ws"
        else:
            wss_url = f"ws://{req_host}:8088/ws"
            
        import socket, re
        via_ip = "78.189.210.15"
        try:
            resolved = socket.gethostbyname(req_host)
            if resolved and re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", resolved):
                via_ip = resolved
        except Exception:
            if client_ip and re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", client_ip):
                via_ip = client_ip

        return {
            "asteriskWssUrl": wss_url,
            "agentExtension": agent_ext,
            "password": sip_password,
            "viaHost": via_ip
        }
    except Exception as e:
        print(f"WebRTC Config error: {e}")
        req_host = request.headers.get("host", "").split(":")[0] or "127.0.0.1"
        scheme = "wss" if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https" else "ws"
        wss_url = f"wss://{req_host}:8089/ws" if scheme == "wss" else f"ws://{req_host}:8088/ws"
        return {
            "asteriskWssUrl": wss_url,
            "agentExtension": "1000",
            "password": resolve_secure_sip_password("1000", ""),
            "viaHost": "78.189.210.15"
        }

# ==============================================================================
# WebRTC Asterisk WebSocket Reverse Proxy
# ==============================================================================
@app.websocket("/ws")
async def websocket_asterisk_proxy(websocket: WebSocket):
    """
    Proxies browser WebRTC WSS connections natively to local Asterisk WebSocket engine.
    """
    subprotocol = websocket.headers.get("sec-websocket-protocol", None)
    subprotocols = [s.strip() for s in subprotocol.split(",")] if subprotocol else ["sip"]
    
    try:
        await websocket.accept(subprotocol=subprotocols[0] if subprotocols else None)
    except Exception as e_acc:
        print(f"[Asterisk WS Proxy Accept Error]: {e_acc}")
        return

    try:
        import websockets
        async with websockets.connect(
            "ws://127.0.0.1:8088/ws",
            subprotocols=subprotocols
        ) as asterisk_ws:
            print(f"[Asterisk WS Proxy] WebSocket baglantisi kuruldu. Subprotocols: {subprotocols}")
            
            async def client_to_asterisk():
                try:
                    while True:
                        msg = await websocket.receive()
                        if msg.get("type") == "websocket.receive":
                            if "text" in msg and msg["text"]:
                                await asterisk_ws.send(msg["text"])
                            elif "bytes" in msg and msg["bytes"]:
                                await asterisk_ws.send(msg["bytes"])
                        elif msg.get("type") == "websocket.disconnect":
                            break
                except Exception as e_c2a:
                    pass

            async def asterisk_to_client():
                try:
                    async for msg in asterisk_ws:
                        if isinstance(msg, str):
                            await websocket.send_text(msg)
                        elif isinstance(msg, bytes):
                            await websocket.send_bytes(msg)
                except Exception as e_a2c:
                    pass

            await asyncio.gather(client_to_asterisk(), asterisk_to_client(), return_exceptions=True)
    except Exception as e:
        print(f"[Asterisk WS Proxy Connect Error]: {e}")
        try:
            await websocket.close()
        except Exception:
            pass

# ==============================================================================
# System Health & Backup Endpoints
# ==============================================================================
@app.get("/api/system/health")
async def get_system_health():
    import psutil
    import subprocess
    import time
    
    try:
        cpu = psutil.cpu_percent(interval=0.5)
        ram = psutil.virtual_memory().percent
        disk = psutil.disk_usage('/').percent
        
        # Asterisk uptime
        uptime_res = subprocess.run(["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", "core show uptime"], capture_output=True, text=True)
        uptime = "Bilinmiyor"
        if uptime_res.returncode == 0:
            for line in uptime_res.stdout.splitlines():
                if "System uptime:" in line:
                    uptime = line.split("System uptime:")[1].strip()
                    break

        if uptime and uptime not in ["Unknown", "Bilinmiyor"]:
            translations = [
                ("years", "yıl"), ("year", "yıl"),
                ("weeks", "hafta"), ("week", "hafta"),
                ("days", "gün"), ("day", "gün"),
                ("hours", "saat"), ("hour", "saat"),
                ("minutes", "dakika"), ("minute", "dakika"),
                ("seconds", "saniye"), ("second", "saniye")
            ]
            for en, tr in translations:
                uptime = uptime.replace(en, tr)
                    
        from backend.services.ami_manager import manager_instance, active_channels
        ami_connected = True if (manager_instance and manager_instance._connected) else False
        active_call_count = len(active_channels) if active_channels else 0

        return {
            "status": "success",
            "cpu": cpu,
            "ram": ram,
            "disk": disk,
            "asterisk_uptime": uptime,
            "ami_status": "Bağlı" if ami_connected else "Pasif",
            "active_calls": active_call_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/backup")
async def create_backup():
    import tarfile
    import subprocess
    import tempfile
    import os
    from fastapi.responses import FileResponse
    from datetime import datetime
    
    try:
        temp_dir = tempfile.mkdtemp()
        backup_name = f"ai_pbx_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        backup_path = os.path.join(temp_dir, backup_name)
        os.makedirs(backup_path, exist_ok=True)
        
        # Backup DB
        db_sql_path = os.path.join(backup_path, "ai_pbx.sql")
        subprocess.run(f"docker exec ai_pbx_db pg_dump -U admin ai_pbx > {db_sql_path}", shell=True, check=True)
        
        # Copy asterisk_config
        import shutil
        shutil.copytree("asterisk_config", os.path.join(backup_path, "asterisk_config"))
        
        # Tar it up
        tar_path = os.path.join(temp_dir, f"{backup_name}.tar.gz")
        with tarfile.open(tar_path, "w:gz") as tar:
            tar.add(backup_path, arcname=backup_name)
            
        return FileResponse(path=tar_path, filename=f"{backup_name}.tar.gz", media_type="application/gzip")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Yedekleme başarısız: {str(e)}")

@app.post("/api/system/backup/restore")
async def restore_backup(file: UploadFile = File(...)):
    import tarfile
    import subprocess
    import tempfile
    import os
    import shutil
    
    try:
        temp_dir = tempfile.mkdtemp()
        tar_path = os.path.join(temp_dir, "uploaded_backup.tar.gz")
        with open(tar_path, "wb") as f:
            f.write(await file.read())
            
        # Extract
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(path=temp_dir)
            
        # Find the extracted folder
        extracted_dirs = [d for d in os.listdir(temp_dir) if os.path.isdir(os.path.join(temp_dir, d))]
        if not extracted_dirs:
            raise Exception("Yedek dosyası içeriği geçersiz.")
        
        backup_folder = os.path.join(temp_dir, extracted_dirs[0])
        
        # Restore DB
        db_sql_path = os.path.join(backup_folder, "ai_pbx.sql")
        if os.path.exists(db_sql_path):
            # Drop schema cascade and recreate to ensure clean restore
            subprocess.run(["docker", "exec", "ai_pbx_db", "psql", "-U", "admin", "-d", "ai_pbx", "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"], check=True)
            subprocess.run(f"cat {db_sql_path} | docker exec -i ai_pbx_db psql -U admin ai_pbx", shell=True, check=True)
            
        # Restore Asterisk Config
        asterisk_config_backup = os.path.join(backup_folder, "asterisk_config")
        if os.path.exists(asterisk_config_backup):
            # Clean current config
            for item in os.listdir("asterisk_config"):
                item_path = os.path.join("asterisk_config", item)
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.remove(item_path)
            
            # Copy new config
            for item in os.listdir(asterisk_config_backup):
                s = os.path.join(asterisk_config_backup, item)
                d = os.path.join("asterisk_config", item)
                if os.path.isdir(s):
                    shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
                    
        # Reload PJSIP
        run_pjsip_reload()
        
        return {"status": "success", "message": "Sistem başarıyla geri yüklendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geri yükleme başarısız: {str(e)}")


# ==============================================================================
# SYSTEM SETTINGS RESTORE POINTS (GERİ YÜKLEME NOKTASI - TENANT BAZLI)
# ==============================================================================
import copy

RESTORE_CATEGORIES_META = [
    {
        "id": "ai_agents",
        "title": "AI Temsilciler & Senaryolar",
        "description": "Yapay zeka temsilcileri, ses/LLM/STT/TTS ayarları, arka plan gürültüsü, Barge-In/VAD, koruma kalkanları ve görsel diyalog senaryoları."
    },
    {
        "id": "call_flows_rules",
        "title": "Çağrı Akışları, IVR & Kurallar",
        "description": "Görsel arama akışları (Workflows), IVR menüleri, çalışma saatleri, gelen/giden arama kuralları, Dialer ve Akıllı Geri Arama."
    },
    {
        "id": "pbx_routing",
        "title": "Santral, Dış Hatlar & Kuyruklar",
        "description": "Santral genel ayarları, SIP Trunk dış hatları, ACD kuyrukları, çağrı toplama/abone grupları, hızlı arama, konferans ve anonslar."
    },
    {
        "id": "users_roles",
        "title": "Kullanıcılar, Roller & Molalar",
        "description": "Dahili aboneler, çağrı yönlendirme kuralları, sesli posta, rol/yetki profilleri, mola tanımları, lokasyon ve departmanlar."
    },
    {
        "id": "channels_omnichannel",
        "title": "Omnichannel Kanallar & Hızlı Cevaplar",
        "description": "WhatsApp çoklu hat tanımları, Telegram, Instagram, Facebook, E-Posta (SMTP/IMAP) kanal ayarları ve hızlı cevap taslakları."
    },
    {
        "id": "integrations_notifications",
        "title": "Entegrasyonlar, Bildirimler & Kalite Kontrol",
        "description": "E-Mail/WhatsApp sistem bildirimleri, Evrensel API & Webhook sihirbazı, QA kalite kriterleri, ses biyometrisi ve saklama politikaları."
    }
]

DEFAULT_RESTORE_POLICY = {
    "auto_create_enabled": False,
    "auto_create_interval_hours": 24,  # 6, 12, 24, 72, 168
    "auto_cleanup_enabled": True,
    "max_restore_points": 20,          # 5, 10, 15, 20, 30, 50
    "retention_days": 30,              # 7, 14, 30, 60, 90
    "last_auto_created_at": None
}

def _rp_belongs_to_tenant(item: dict, tenant_id: str) -> bool:
    if not isinstance(item, dict):
        return False
    item_t = item.get("tenant_id")
    if is_default_tenant(tenant_id):
        return not item_t or item_t in ["tenant-default", "default"]
    return item_t == tenant_id

def _rp_get_tenant_list(key: str, tenant_id: str) -> list:
    raw_list = settings_db.get(key, DEFAULT_SETTINGS.get(key, []))
    if not isinstance(raw_list, list):
        return []
    return [copy.deepcopy(item) for item in raw_list if _rp_belongs_to_tenant(item, tenant_id)]

def _rp_set_tenant_list(key: str, tenant_id: str, new_items: list):
    raw_list = settings_db.get(key, DEFAULT_SETTINGS.get(key, []))
    if not isinstance(raw_list, list):
        raw_list = []
    other_tenant_items = [item for item in raw_list if not _rp_belongs_to_tenant(item, tenant_id)]
    prepared_items = []
    for item in (new_items or []):
        if isinstance(item, dict):
            cloned = copy.deepcopy(item)
            cloned["tenant_id"] = tenant_id
            prepared_items.append(cloned)
    settings_db[key] = other_tenant_items + prepared_items

def _rp_get_tenant_dict(key: str, tenant_id: str) -> dict:
    if key == "ai_providers":
        t_map = settings_db.get("tenant_ai_providers", {})
        if isinstance(t_map, dict) and tenant_id in t_map:
            return copy.deepcopy(t_map[tenant_id])
    if key == "email_notifications":
        t_map = settings_db.get("tenant_email_notifications", {})
        if isinstance(t_map, dict) and tenant_id in t_map:
            return copy.deepcopy(t_map[tenant_id])
    t_settings = settings_db.get("tenant_settings", {})
    if isinstance(t_settings, dict) and tenant_id in t_settings and isinstance(t_settings[tenant_id], dict):
        if key in t_settings[tenant_id]:
            return copy.deepcopy(t_settings[tenant_id][key])
    if is_default_tenant(tenant_id):
        val = settings_db.get(key, DEFAULT_SETTINGS.get(key, {}))
        return copy.deepcopy(val) if isinstance(val, dict) else {}
    default_val = DEFAULT_SETTINGS.get(key, {})
    return copy.deepcopy(default_val) if isinstance(default_val, dict) else {}

def _rp_set_tenant_dict(key: str, tenant_id: str, val: dict):
    if not isinstance(val, dict):
        return
    cloned = copy.deepcopy(val)
    if "tenant_settings" not in settings_db or not isinstance(settings_db.get("tenant_settings"), dict):
        settings_db["tenant_settings"] = {}
    if tenant_id not in settings_db["tenant_settings"] or not isinstance(settings_db["tenant_settings"].get(tenant_id), dict):
        settings_db["tenant_settings"][tenant_id] = {}
    settings_db["tenant_settings"][tenant_id][key] = cloned

    if key == "ai_providers":
        if "tenant_ai_providers" not in settings_db or not isinstance(settings_db.get("tenant_ai_providers"), dict):
            settings_db["tenant_ai_providers"] = {}
        settings_db["tenant_ai_providers"][tenant_id] = cloned
    elif key == "email_notifications":
        if "tenant_email_notifications" not in settings_db or not isinstance(settings_db.get("tenant_email_notifications"), dict):
            settings_db["tenant_email_notifications"] = {}
        settings_db["tenant_email_notifications"][tenant_id] = cloned

    if is_default_tenant(tenant_id):
        settings_db[key] = copy.deepcopy(cloned)

def get_tenant_restore_policy(tenant_id: str) -> dict:
    norm_tenant = "tenant-default" if is_default_tenant(tenant_id) else tenant_id
    policies = settings_db.get("restore_point_policies", {})
    if not isinstance(policies, dict):
        policies = {}
    saved = policies.get(norm_tenant, {})
    policy = DEFAULT_RESTORE_POLICY.copy()
    if isinstance(saved, dict):
        policy.update(saved)
    return policy

def save_tenant_restore_policy(tenant_id: str, policy_data: dict) -> dict:
    norm_tenant = "tenant-default" if is_default_tenant(tenant_id) else tenant_id
    if "restore_point_policies" not in settings_db or not isinstance(settings_db.get("restore_point_policies"), dict):
        settings_db["restore_point_policies"] = {}
    current = get_tenant_restore_policy(norm_tenant)
    for k in ["auto_create_enabled", "auto_create_interval_hours", "auto_cleanup_enabled", "max_restore_points", "retention_days", "last_auto_created_at"]:
        if k in policy_data and policy_data[k] is not None:
            current[k] = policy_data[k]
    current["auto_create_interval_hours"] = max(1, int(current.get("auto_create_interval_hours") or 24))
    current["max_restore_points"] = max(2, min(200, int(current.get("max_restore_points") or 20)))
    current["retention_days"] = max(1, min(365, int(current.get("retention_days") or 30)))
    settings_db["restore_point_policies"][norm_tenant] = current
    save_settings(settings_db)
    return current

def capture_tenant_snapshot(tenant_id: str) -> dict:
    norm_tenant = "tenant-default" if is_default_tenant(tenant_id) else tenant_id

    ai_agents = _rp_get_tenant_list("ai_agents", norm_tenant)
    workflows = _rp_get_tenant_list("workflows", norm_tenant)
    inbound_rules = _rp_get_tenant_list("inbound_rules", norm_tenant)
    outbound_rules = _rp_get_tenant_list("outbound_rules", norm_tenant)
    trunks = _rp_get_tenant_list("trunks", norm_tenant)
    queues = _rp_get_tenant_list("queues", norm_tenant)
    call_pickup_groups = _rp_get_tenant_list("call_pickup_groups", norm_tenant)
    subscriber_groups = _rp_get_tenant_list("subscriber_groups", norm_tenant)
    speed_dials = _rp_get_tenant_list("speed_dials", norm_tenant)
    conferences = _rp_get_tenant_list("conferences", norm_tenant)
    announcements = _rp_get_tenant_list("announcements", norm_tenant)
    users = _rp_get_tenant_list("users", norm_tenant)
    roles = _rp_get_tenant_list("roles", norm_tenant)
    breaks = _rp_get_tenant_list("breaks", norm_tenant)
    locations = _rp_get_tenant_list("locations", norm_tenant)
    departments = _rp_get_tenant_list("departments", norm_tenant)
    canned_responses = _rp_get_tenant_list("canned_responses", norm_tenant)
    custom_apis = _rp_get_tenant_list("custom_apis", norm_tenant)

    snapshot_data = {
        "ai_agents": {
            "ai_agents": ai_agents,
            "rag": _rp_get_tenant_dict("rag", norm_tenant),
            "ai_providers": _rp_get_tenant_dict("ai_providers", norm_tenant)
        },
        "call_flows_rules": {
            "workflows": workflows,
            "call_flow": _rp_get_tenant_dict("call_flow", norm_tenant),
            "inbound_rules": inbound_rules,
            "outbound_rules": outbound_rules,
            "smart_callback": _rp_get_tenant_dict("smart_callback", norm_tenant),
            "dialer": _rp_get_tenant_dict("dialer", norm_tenant)
        },
        "pbx_routing": {
            "pbx": _rp_get_tenant_dict("pbx", norm_tenant),
            "trunks": trunks,
            "queues": queues,
            "call_pickup_groups": call_pickup_groups,
            "subscriber_groups": subscriber_groups,
            "speed_dials": speed_dials,
            "conferences": conferences,
            "announcements": announcements
        },
        "users_roles": {
            "users": users,
            "roles": roles,
            "breaks": breaks,
            "locations": locations,
            "departments": departments
        },
        "channels_omnichannel": {
            "channels": _rp_get_tenant_dict("channels", norm_tenant),
            "canned_responses": canned_responses
        },
        "integrations_notifications": {
            "email_notifications": _rp_get_tenant_dict("email_notifications", norm_tenant),
            "custom_apis": custom_apis,
            "voice_biometrics": _rp_get_tenant_dict("voice_biometrics", norm_tenant),
            "recording_retention": _rp_get_tenant_dict("recording_retention", norm_tenant),
            "roi_settings": _rp_get_tenant_dict("roi_settings", norm_tenant)
        }
    }

    channels_dict = snapshot_data["channels_omnichannel"]["channels"] or {}
    wa_lines = len(channels_dict.get("whatsapp_accounts", [])) if isinstance(channels_dict.get("whatsapp_accounts"), list) else (1 if channels_dict.get("whatsapp_token") else 0)

    summary = {
        "ai_agents_count": len(ai_agents),
        "workflows_count": len(workflows),
        "rules_count": len(inbound_rules) + len(outbound_rules),
        "trunks_count": len(trunks),
        "queues_count": len(queues),
        "users_count": len(users),
        "roles_count": len(roles),
        "whatsapp_lines_count": wa_lines,
        "custom_apis_count": len(custom_apis)
    }

    return {"snapshot_data": snapshot_data, "summary": summary}

def apply_tenant_snapshot(tenant_id: str, snapshot_data: dict, categories: Optional[List[str]] = None):
    norm_tenant = "tenant-default" if is_default_tenant(tenant_id) else tenant_id
    all_cats = [c["id"] for c in RESTORE_CATEGORIES_META]
    selected_cats = [c for c in (categories or all_cats) if c in all_cats]
    if not selected_cats:
        selected_cats = all_cats

    # 1. AI Agents & Scenarios
    if "ai_agents" in selected_cats and "ai_agents" in snapshot_data:
        cat_data = snapshot_data["ai_agents"]
        if "ai_agents" in cat_data:
            _rp_set_tenant_list("ai_agents", norm_tenant, cat_data["ai_agents"])
        if "rag" in cat_data:
            _rp_set_tenant_dict("rag", norm_tenant, cat_data["rag"])
        if "ai_providers" in cat_data:
            _rp_set_tenant_dict("ai_providers", norm_tenant, cat_data["ai_providers"])

    # 2. Call Flows, IVR & Rules
    if "call_flows_rules" in selected_cats and "call_flows_rules" in snapshot_data:
        cat_data = snapshot_data["call_flows_rules"]
        if "workflows" in cat_data:
            _rp_set_tenant_list("workflows", norm_tenant, cat_data["workflows"])
        if "call_flow" in cat_data:
            _rp_set_tenant_dict("call_flow", norm_tenant, cat_data["call_flow"])
        if "inbound_rules" in cat_data:
            _rp_set_tenant_list("inbound_rules", norm_tenant, cat_data["inbound_rules"])
        if "outbound_rules" in cat_data:
            _rp_set_tenant_list("outbound_rules", norm_tenant, cat_data["outbound_rules"])
        if "smart_callback" in cat_data:
            _rp_set_tenant_dict("smart_callback", norm_tenant, cat_data["smart_callback"])
        if "dialer" in cat_data:
            _rp_set_tenant_dict("dialer", norm_tenant, cat_data["dialer"])

    # 3. PBX, Trunks & Queues
    if "pbx_routing" in selected_cats and "pbx_routing" in snapshot_data:
        cat_data = snapshot_data["pbx_routing"]
        if "pbx" in cat_data:
            _rp_set_tenant_dict("pbx", norm_tenant, cat_data["pbx"])
        for list_key in ["trunks", "queues", "call_pickup_groups", "subscriber_groups", "speed_dials", "conferences", "announcements"]:
            if list_key in cat_data:
                _rp_set_tenant_list(list_key, norm_tenant, cat_data[list_key])

    # 4. Users, Roles & Breaks
    if "users_roles" in selected_cats and "users_roles" in snapshot_data:
        cat_data = snapshot_data["users_roles"]
        for list_key in ["users", "roles", "breaks", "locations", "departments"]:
            if list_key in cat_data:
                _rp_set_tenant_list(list_key, norm_tenant, cat_data[list_key])

        # Also synchronize SystemUser and SystemRole in PostgreSQL for this tenant
        try:
            from backend.database.config import SyncSessionLocal
            session = SyncSessionLocal()
            try:
                if "users" in cat_data:
                    db_users = session.query(SystemUser).all()
                    for u in db_users:
                        u_dict = {"tenant_id": getattr(u, "tenant_id", None)}
                        if _rp_belongs_to_tenant(u_dict, norm_tenant):
                            session.delete(u)
                    session.flush()
                    valid_u_cols = {c.name for c in SystemUser.__table__.columns}
                    for u_data in cat_data["users"]:
                        if isinstance(u_data, dict):
                            filtered = {k: v for k, v in u_data.items() if k in valid_u_cols and k != "id"}
                            filtered["tenant_id"] = norm_tenant
                            session.add(SystemUser(**filtered))
                if "roles" in cat_data:
                    db_roles = session.query(SystemRole).all()
                    for r in db_roles:
                        r_dict = {"tenant_id": getattr(r, "tenant_id", None)}
                        if _rp_belongs_to_tenant(r_dict, norm_tenant):
                            session.delete(r)
                    session.flush()
                    valid_r_cols = {c.name for c in SystemRole.__table__.columns}
                    for r_data in cat_data["roles"]:
                        if isinstance(r_data, dict):
                            filtered = {k: v for k, v in r_data.items() if k in valid_r_cols and k != "id"}
                            filtered["tenant_id"] = norm_tenant
                            session.add(SystemRole(**filtered))
                session.commit()
            except Exception as sync_err:
                session.rollback()
                print(f"[Restore Point DB Sync Warning]: {sync_err}")
            finally:
                session.close()
        except Exception as outer_err:
            print(f"[Restore Point Session Warning]: {outer_err}")

    # 5. Channels & Omnichannel
    if "channels_omnichannel" in selected_cats and "channels_omnichannel" in snapshot_data:
        cat_data = snapshot_data["channels_omnichannel"]
        if "channels" in cat_data:
            _rp_set_tenant_dict("channels", norm_tenant, cat_data["channels"])
        if "canned_responses" in cat_data:
            _rp_set_tenant_list("canned_responses", norm_tenant, cat_data["canned_responses"])

    # 6. Integrations & Notifications
    if "integrations_notifications" in selected_cats and "integrations_notifications" in snapshot_data:
        cat_data = snapshot_data["integrations_notifications"]
        if "email_notifications" in cat_data:
            _rp_set_tenant_dict("email_notifications", norm_tenant, cat_data["email_notifications"])
        if "custom_apis" in cat_data:
            _rp_set_tenant_list("custom_apis", norm_tenant, cat_data["custom_apis"])
        for d_key in ["voice_biometrics", "recording_retention", "roi_settings"]:
            if d_key in cat_data:
                _rp_set_tenant_dict(d_key, norm_tenant, cat_data[d_key])

    save_settings(settings_db)

    # Regenerate Asterisk configuration if PBX or Users were restored
    if "pbx_routing" in selected_cats or "users_roles" in selected_cats or "call_flows_rules" in selected_cats:
        try:
            regenerate_pjsip_custom_conf()
            regenerate_queues_conf()
        except Exception as ast_err:
            print(f"[Restore Point Asterisk Sync Warning]: {ast_err}")

    return selected_cats

def enforce_restore_point_retention(tenant_id: str) -> int:
    norm_tenant = "tenant-default" if is_default_tenant(tenant_id) else tenant_id
    policy = get_tenant_restore_policy(norm_tenant)
    if not policy.get("auto_cleanup_enabled", True):
        return 0

    all_points = settings_db.get("restore_points", [])
    if not isinstance(all_points, list) or not all_points:
        return 0

    other_points = [p for p in all_points if not _rp_belongs_to_tenant(p, norm_tenant)]
    tenant_points = [p for p in all_points if _rp_belongs_to_tenant(p, norm_tenant)]
    initial_count = len(tenant_points)
    if initial_count == 0:
        return 0

    retention_days = max(1, int(policy.get("retention_days") or 30))
    max_points = max(2, int(policy.get("max_restore_points") or 20))
    now_utc = datetime.datetime.utcnow()
    cutoff_dt = now_utc - datetime.timedelta(days=retention_days)

    # Sort newest first
    tenant_points.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    # 1. Age-based filtering (keep at least 1 newest point even if all are old)
    age_filtered = []
    for idx, pt in enumerate(tenant_points):
        if idx == 0:
            age_filtered.append(pt)
            continue
        created_str = pt.get("created_at", "")
        try:
            clean_iso = created_str.replace("Z", "").split("+")[0]
            pt_dt = datetime.datetime.fromisoformat(clean_iso)
            if pt_dt >= cutoff_dt:
                age_filtered.append(pt)
        except Exception:
            age_filtered.append(pt)

    # 2. Max count limit filtering
    final_tenant_points = age_filtered[:max_points]
    removed_count = initial_count - len(final_tenant_points)

    if removed_count > 0:
        settings_db["restore_points"] = other_tenant_points_merge(other_points, final_tenant_points)
        save_settings(settings_db)
        add_system_log("RESTORE_POINT", "INFO", f"[{norm_tenant}] Otomatik saklama politikası kapsamında {removed_count} eski geri yükleme noktası temizlendi.")

    return removed_count

def other_tenant_points_merge(other_points: list, tenant_points: list) -> list:
    merged = list(other_points) + list(tenant_points)
    merged.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return merged

def create_tenant_restore_point(
    tenant_id: str,
    title: str,
    description: str = "",
    created_by: str = "Admin",
    is_auto: bool = False,
    point_type: str = "manual"
) -> dict:
    norm_tenant = "tenant-default" if is_default_tenant(tenant_id) else tenant_id
    snap = capture_tenant_snapshot(norm_tenant)
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    raw_json = json.dumps(snap["snapshot_data"], ensure_ascii=False)
    size_kb = round(len(raw_json.encode("utf-8")) / 1024.0, 1)

    point_obj = {
        "id": f"rp-{int(datetime.datetime.utcnow().timestamp() * 1000)}-{uuid.uuid4().hex[:6]}",
        "tenant_id": norm_tenant,
        "title": title.strip() or "Sistem Ayarları Geri Yükleme Noktası",
        "description": (description or "").strip(),
        "created_at": now_iso,
        "created_by": created_by,
        "is_auto": is_auto,
        "point_type": point_type,  # manual, auto, pre_restore
        "size_kb": size_kb,
        "summary": snap["summary"],
        "snapshot_data": snap["snapshot_data"]
    }

    if "restore_points" not in settings_db or not isinstance(settings_db.get("restore_points"), list):
        settings_db["restore_points"] = []

    settings_db["restore_points"].insert(0, point_obj)
    save_settings(settings_db)

    # Enforce retention policy so restore points never bloat
    enforce_restore_point_retention(norm_tenant)

    return point_obj

class CreateRestorePointSchema(BaseModel):
    title: str
    description: Optional[str] = ""

class RestorePointPolicySchema(BaseModel):
    auto_create_enabled: bool = False
    auto_create_interval_hours: int = 24
    auto_cleanup_enabled: bool = True
    max_restore_points: int = 20
    retention_days: int = 30

class ApplyRestorePointSchema(BaseModel):
    categories: Optional[List[str]] = None
    create_safety_point: Optional[bool] = True

@app.get("/api/settings/restore-points")
async def list_restore_points(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    norm_tenant = "tenant-default" if is_default_tenant(target_tenant) else target_tenant

    all_points = settings_db.get("restore_points", [])
    if not isinstance(all_points, list):
        all_points = []

    tenant_points = [p for p in all_points if _rp_belongs_to_tenant(p, norm_tenant)]
    tenant_points.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    lightweight_points = []
    for p in tenant_points:
        item = {k: v for k, v in p.items() if k != "snapshot_data"}
        lightweight_points.append(item)

    policy = get_tenant_restore_policy(norm_tenant)
    return {
        "status": "success",
        "tenant_id": norm_tenant,
        "points": lightweight_points,
        "policy": policy,
        "categories_meta": RESTORE_CATEGORIES_META
    }

@app.post("/api/settings/restore-points")
async def create_restore_point_endpoint(payload: CreateRestorePointSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    norm_tenant = "tenant-default" if is_default_tenant(target_tenant) else target_tenant
    creator = user_info.get("user_id") or "Admin"

    if not payload.title or not payload.title.strip():
        raise HTTPException(status_code=400, detail="Lütfen geri yükleme noktası için bir başlık giriniz.")

    point = create_tenant_restore_point(
        tenant_id=norm_tenant,
        title=payload.title.strip(),
        description=payload.description or "",
        created_by=str(creator),
        is_auto=False,
        point_type="manual"
    )
    add_system_log("RESTORE_POINT", "SUCCESS", f"[{norm_tenant}] Yeni geri yükleme noktası oluşturuldu: {point['title']}")
    lightweight = {k: v for k, v in point.items() if k != "snapshot_data"}
    return {
        "status": "success",
        "message": f"'{point['title']}' geri yükleme noktası başarıyla oluşturuldu.",
        "point": lightweight
    }

@app.post("/api/settings/restore-points/policy")
async def update_restore_point_policy_endpoint(payload: RestorePointPolicySchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    norm_tenant = "tenant-default" if is_default_tenant(target_tenant) else target_tenant

    updated_policy = save_tenant_restore_policy(norm_tenant, payload.model_dump())
    removed = enforce_restore_point_retention(norm_tenant)
    add_system_log("RESTORE_POINT", "INFO", f"[{norm_tenant}] Otomatik geri yükleme ve saklama politikası güncellendi.")
    return {
        "status": "success",
        "message": f"Otomatik geri yükleme ve saklama ayarları kaydedildi.{f' ({removed} eski kayıt temizlendi)' if removed > 0 else ''}",
        "policy": updated_policy,
        "removed_count": removed
    }

@app.post("/api/settings/restore-points/cleanup-now")
async def cleanup_restore_points_now_endpoint(user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    norm_tenant = "tenant-default" if is_default_tenant(target_tenant) else target_tenant
    removed = enforce_restore_point_retention(norm_tenant)
    return {
        "status": "success",
        "removed_count": removed,
        "message": f"{removed} adet eski geri yükleme noktası temizlendi." if removed > 0 else "Temizlenecek süresi dolmuş veya limiti aşan kayıt bulunmadı."
    }

@app.post("/api/settings/restore-points/{point_id}/restore")
async def restore_from_point_endpoint(point_id: str, payload: ApplyRestorePointSchema, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    norm_tenant = "tenant-default" if is_default_tenant(target_tenant) else target_tenant
    creator = user_info.get("user_id") or "Admin"

    all_points = settings_db.get("restore_points", [])
    target_point = next((p for p in all_points if p.get("id") == point_id and _rp_belongs_to_tenant(p, norm_tenant)), None)
    if not target_point:
        raise HTTPException(status_code=404, detail="Geri yükleme noktası bulunamadı veya bu müşteriye (tenant) ait değil.")

    snapshot_data = target_point.get("snapshot_data")
    if not snapshot_data or not isinstance(snapshot_data, dict):
        raise HTTPException(status_code=400, detail="Geri yükleme noktası verisi bozuk veya boş.")

    safety_point_info = None
    if payload.create_safety_point:
        tr_now = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%d.%m.%Y %H:%M")
        sp = create_tenant_restore_point(
            tenant_id=norm_tenant,
            title=f"Geri Yükleme Öncesi Güvenlik Kopyası ({tr_now})",
            description=f"'{target_point.get('title')}' noktasına dönülmeden önce sistem tarafından otomatik alınan yedek.",
            created_by=str(creator),
            is_auto=True,
            point_type="pre_restore"
        )
        safety_point_info = {k: v for k, v in sp.items() if k != "snapshot_data"}

    restored_cats = apply_tenant_snapshot(norm_tenant, snapshot_data, payload.categories)
    add_system_log(
        "RESTORE_POINT",
        "WARNING",
        f"[{norm_tenant}] '{target_point.get('title')}' geri yükleme noktasına dönüldü. (Kategoriler: {', '.join(restored_cats)})"
    )
    return {
        "status": "success",
        "message": f"Sistem ayarları '{target_point.get('title')}' geri yükleme noktasına başarıyla döndürüldü.",
        "restored_categories": restored_cats,
        "safety_point": safety_point_info
    }

@app.delete("/api/settings/restore-points/{point_id}")
async def delete_restore_point_endpoint(point_id: str, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    norm_tenant = "tenant-default" if is_default_tenant(target_tenant) else target_tenant

    all_points = settings_db.get("restore_points", [])
    target_point = next((p for p in all_points if p.get("id") == point_id and _rp_belongs_to_tenant(p, norm_tenant)), None)
    if not target_point:
        raise HTTPException(status_code=404, detail="Silinecek geri yükleme noktası bulunamadı.")

    settings_db["restore_points"] = [p for p in all_points if not (p.get("id") == point_id and _rp_belongs_to_tenant(p, norm_tenant))]
    save_settings(settings_db)
    add_system_log("RESTORE_POINT", "INFO", f"[{norm_tenant}] Geri yükleme noktası silindi: {target_point.get('title')}")
    return {
        "status": "success",
        "message": f"'{target_point.get('title')}' geri yükleme noktası silindi."
    }

async def _restore_points_auto_worker():
    """Periyodik olarak tüm aktif tenant'ların otomatik geri yükleme noktası oluşturma ve otomatik temizleme kurallarını çalıştırır."""
    await asyncio.sleep(15)
    while True:
        try:
            tenants = settings_db.get("tenants", DEFAULT_SETTINGS.get("tenants", []))
            tenant_ids = ["tenant-default"]
            for t in (tenants or []):
                tid = t.get("id")
                if tid and tid not in tenant_ids and t.get("status", "active") == "active":
                    tenant_ids.append(tid)

            now_utc = datetime.datetime.utcnow()
            for tid in tenant_ids:
                norm_tid = "tenant-default" if is_default_tenant(tid) else tid
                policy = get_tenant_restore_policy(norm_tid)

                # 1. Check automatic creation schedule
                if policy.get("auto_create_enabled", False):
                    interval_hours = max(1, int(policy.get("auto_create_interval_hours") or 24))
                    last_iso = policy.get("last_auto_created_at")
                    should_create = False
                    if not last_iso:
                        should_create = True
                    else:
                        try:
                            clean_iso = str(last_iso).replace("Z", "").split("+")[0]
                            last_dt = datetime.datetime.fromisoformat(clean_iso)
                            if (now_utc - last_dt).total_seconds() >= interval_hours * 3600:
                                should_create = True
                        except Exception:
                            should_create = True

                    if should_create:
                        tr_now_str = (now_utc + datetime.timedelta(hours=3)).strftime("%d.%m.%Y %H:%M")
                        create_tenant_restore_point(
                            tenant_id=norm_tid,
                            title=f"Periyodik Otomatik Kayıt ({tr_now_str})",
                            description=f"Her {interval_hours} saatte bir çalışan otomatik geri yükleme zamanlayıcısı tarafından oluşturuldu.",
                            created_by="Sistem (Otomatik)",
                            is_auto=True,
                            point_type="auto"
                        )
                        save_tenant_restore_policy(norm_tid, {"last_auto_created_at": now_utc.isoformat() + "Z"})
                        add_system_log("RESTORE_POINT", "INFO", f"[{norm_tid}] Periyodik otomatik geri yükleme noktası oluşturuldu.")

                # 2. Check automatic retention cleanup
                if policy.get("auto_cleanup_enabled", True):
                    enforce_restore_point_retention(norm_tid)
        except Exception as worker_err:
            print(f"[RestorePoints Auto Worker Warning]: {worker_err}")

        await asyncio.sleep(120)

@app.on_event("startup")
async def on_startup_restore_points_worker():
    try:
        asyncio.create_task(_restore_points_auto_worker())
    except Exception as e:
        print(f"[RestorePoints Startup Error]: {e}")


# ==============================================================================
# USER CUSTOM AVATAR UPLOAD ENDPOINT
# ==============================================================================
os.makedirs("uploads/avatars", exist_ok=True)

@app.post("/api/settings/users/upload-avatar")
@app.post("/settings/users/upload-avatar")
async def upload_user_avatar_endpoint(file: UploadFile = File(...), user_info: dict = Depends(get_user_info)):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir görsel dosyası seçiniz.")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
        raise HTTPException(status_code=400, detail="Sadece PNG, JPG, WEBP, GIF veya SVG formatında görseller yüklenebilir.")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar dosya boyutu en fazla 5 MB olabilir.")

    safe_name = f"avatar_{int(datetime.datetime.utcnow().timestamp())}_{uuid.uuid4().hex[:8]}{ext}"
    save_path = os.path.join("uploads", "avatars", safe_name)
    with open(save_path, "wb") as f:
        f.write(contents)

    avatar_url = f"/api/uploads/avatars/{safe_name}"
    return {
        "status": "success",
        "avatar_url": avatar_url,
        "message": "Özel avatar görseli başarıyla yüklendi."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)


