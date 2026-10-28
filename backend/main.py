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
import base64
import httpx
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
from backend.database.models import Rule, Call, Transcript, Appointment, ChatSession, ChatMessage, Contact, CannedResponse, BlacklistItem, BlockWord, SystemUser, SystemRole, PBXQueue, Trunk, AIAgent, BreakType, AgentBreakLog, SystemSetting, EventLog, QueueSurveyResponse
from backend.services.agent_presence import get_agent_state
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

class CallForwardingPrefixSchema(BaseModel):
    always: str = "*21*"
    busy: str = "*67*"
    no_answer: str = "*61*"
    cancel: str = "#21#"

class CallMonitoringPrefixSchema(BaseModel):
    listen: str = "*551*"
    whisper: str = "*552*"
    barge: str = "*553*"

class NumberingPlanSchema(BaseModel):
    extension_range: NumberingPlanRangeSchema
    queue_range: NumberingPlanRangeSchema
    conference_range: NumberingPlanRangeSchema
    speed_dial_range: NumberingPlanRangeSchema
    call_flow_range: NumberingPlanRangeSchema
    call_pickup: Optional[CallPickupPrefixSchema] = None
    call_forwarding: Optional[CallForwardingPrefixSchema] = None
    call_monitoring: Optional[CallMonitoringPrefixSchema] = None

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
    max_duration_minutes: Optional[int] = 0
    daily_quota_minutes: Optional[int] = 0

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
    user_id: Optional[Union[int, str]] = None
    extension: Optional[str] = None
    by_supervisor: Optional[bool] = False
    acw_duration: Optional[int] = None

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
        "timeout_action": "none",
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
    two_factor_method: Optional[str] = "google_auth"
    two_factor_secret: Optional[str] = None
    two_factor_enrolled: Optional[bool] = False
    managed_users: Optional[List[Union[int, str]]] = []
    managed_queues: Optional[List[Union[int, str]]] = []

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
    trunk_type: str = "register" # register, peer, account
    trunk_name: str
    host: Optional[str] = ""
    username: Optional[str] = None
    password: Optional[str] = None
    port: int = 5060
    did_number: Optional[str] = ""
    protocol: str = "udp" # udp, tcp, tls
    greeting_prompt: Optional[str] = None
    transfer_target_type: str = "extension" # extension, queue, custom
    transfer_target: str = "200"
    codec: str = "alaw,ulaw,g722,g729"
    codecs: Optional[List[str]] = ["alaw", "ulaw", "g722", "g729"]
    call_limit_enabled: Optional[bool] = False
    call_limit_direction: Optional[str] = "both" # both, outbound, inbound
    max_channels: Optional[int] = 30
    sip_headers: Optional[Dict[str, Any]] = {}
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
        "auto_whisper_enabled": True,
        "numbering_plan": {
            "extension_range": {"start": 1000, "end": 1999},
            "queue_range": {"start": 2000, "end": 2999},
            "conference_range": {"start": 3000, "end": 3999},
            "speed_dial_range": {"start": 4000, "end": 4999},
            "call_flow_range": {"start": 5000, "end": 5999},
            "call_pickup": {"group": "*8", "directed": "**"},
            "call_forwarding": {
                "always": "*21*",
                "busy": "*67*",
                "no_answer": "*61*",
                "cancel": "#21#"
            },
            "call_monitoring": {
                "listen": "*551*",
                "whisper": "*552*",
                "barge": "*553*"
            }
        }
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
        "google": {"loaded_credit": 0.0, "spent_credit": 0.0, "spent_offset": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None},
        "elevenlabs": {"loaded_credit": 0.0, "spent_credit": 0.0, "spent_offset": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None},
        "openai": {"loaded_credit": 0.0, "spent_credit": 0.0, "spent_offset": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None},
        "anthropic": {"loaded_credit": 0.0, "spent_credit": 0.0, "spent_offset": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None},
        "groq": {"loaded_credit": 0.0, "spent_credit": 0.0, "spent_offset": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None},
        "deepgram": {"loaded_credit": 0.0, "spent_credit": 0.0, "spent_offset": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None},
        "whatsapp": {"loaded_credit": 0.0, "spent_credit": 0.0, "spent_offset": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None}
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
                "dashboard:access", "wallboard:access", "supervisor:access",
                "supervisor:agent_status", "supervisor:agent_logout", "supervisor:scope_filter",
                "live_translator:access", "call_panel:live_translation", "call_panel:voice_interpreter",
                "call_panel:access", "call_panel:listen_records", "call_panel:view_transcripts", "omnichannel:access",
                "call_monitor:listen", "call_monitor:whisper", "call_monitor:barge",
                "call_panel:tab_dashboard", "call_panel:tab_webphone", "call_panel:tab_agents", "call_panel:tab_speeddial",
                "call_panel:tab_missed", "call_panel:tab_directory", "call_panel:tab_history", "call_panel:tab_voicemail", "call_panel:tab_chat",
                "call_panel:webphone_save_contact", "call_panel:webphone_transfer", "call_panel:webphone_conference", "call_panel:webphone_reject",
                "call_panel:agents_status", "call_panel:agents_duration", "call_panel:agents_call_counts", "call_panel:agents_login_logout",
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
                "reports_pano:access", "reports_cdr:access", "reports_audio:access", "reports_transcripts:access",
                "reports_sentiment:access", "reports_qa:access", "reports_notes:access", "reports_perf:access",
                "reports_queue:access", "reports_survey:access", "reports_sentiment_heat:access", "reports_wordcloud:access", "reports_fcr:access",
                "reports_roi:access", "reports_missed:access", "reports_traffic_load:access", "reports_trunk:access",
                "reports_ivr_drop:access", "reports_transfer_hold:access", "reports_ab_testing:access",
                "reports_friction:access", "reports_compliance:access", "reports_silence:access", "reports_ceo_summary:access",
                "reports_intent:access",
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
                "tenants:read", "tenants:write", "tenants:delete",
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
                "dashboard:access", "wallboard:access", "supervisor:access",
                "supervisor:agent_status", "supervisor:agent_logout", "supervisor:scope_filter",
                "live_translator:access", "call_panel:live_translation", "call_panel:voice_interpreter",
                "call_panel:access", "call_panel:listen_records", "call_panel:view_transcripts", "omnichannel:access",
                "call_monitor:listen", "call_monitor:whisper", "call_monitor:barge",
                "call_panel:tab_dashboard", "call_panel:tab_webphone", "call_panel:tab_agents", "call_panel:tab_speeddial",
                "call_panel:tab_missed", "call_panel:tab_directory", "call_panel:tab_history", "call_panel:tab_voicemail", "call_panel:tab_chat",
                "call_panel:webphone_save_contact", "call_panel:webphone_transfer", "call_panel:webphone_conference", "call_panel:webphone_reject",
                "call_panel:agents_status", "call_panel:agents_duration", "call_panel:agents_call_counts", "call_panel:agents_login_logout",
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
                "reports_pano:access", "reports_cdr:access", "reports_audio:access", "reports_transcripts:access",
                "reports_sentiment:access", "reports_qa:access", "reports_notes:access", "reports_perf:access",
                "reports_queue:access", "reports_survey:access", "reports_sentiment_heat:access", "reports_wordcloud:access", "reports_fcr:access",
                "reports_roi:access", "reports_missed:access", "reports_traffic_load:access", "reports_trunk:access",
                "reports_ivr_drop:access", "reports_transfer_hold:access", "reports_ab_testing:access",
                "reports_friction:access", "reports_compliance:access", "reports_silence:access", "reports_ceo_summary:access",
                "reports_intent:access",
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
                "call_panel:tab_dashboard", "call_panel:tab_webphone", "call_panel:tab_agents", "call_panel:tab_speeddial",
                "call_panel:tab_missed", "call_panel:tab_directory", "call_panel:tab_history", "call_panel:tab_voicemail", "call_panel:tab_chat",
                "call_panel:listen_records", "call_panel:view_transcripts", "call_panel:webphone_save_contact", "call_panel:webphone_transfer", "call_panel:webphone_conference", "call_panel:webphone_reject",
                "call_panel:agents_status", "call_panel:agents_duration", "call_panel:agents_call_counts", "call_panel:agents_login_logout",
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
    "intent_rules": [
        {
            "id": "intent-sales-positive",
            "name": "Satış Olumlu / Sipariş Niyeti",
            "category": "Satış",
            "keywords": ["satın almak", "sipariş", "onaylıyorum", "alıyorum", "kredi kartı", "gönderin", "kabul ediyorum", "paket"],
            "speaker_scope": "customer",
            "status_color": "emerald",
            "tenant_id": "tenant-default"
        },
        {
            "id": "intent-sales-inquiry",
            "name": "Fiyat & Teklif Sorgulama",
            "category": "Satış",
            "keywords": ["fiyat", "ücret", "kampanya", "indirim", "teklif", "kaç para", "taksit", "maliyet"],
            "speaker_scope": "customer",
            "status_color": "blue",
            "tenant_id": "tenant-default"
        },
        {
            "id": "intent-helpdesk-issue",
            "name": "Yardım Masası / Teknik Destek",
            "category": "Yardım Masası",
            "keywords": ["arıza", "çalışmıyor", "hata", "bağlanamıyorum", "şifre", "sorun var", "destek", "kesildi"],
            "speaker_scope": "customer",
            "status_color": "amber",
            "tenant_id": "tenant-default"
        },
        {
            "id": "intent-cancel-complaint",
            "name": "İptal / İade / Şikayet Niyeti",
            "category": "Müşteri Hizmetleri",
            "keywords": ["iptal", "iade", "vazgeçtim", "istemiyorum", "şikayet", "memnun değilim", "kapatmak istiyorum"],
            "speaker_scope": "customer",
            "status_color": "rose",
            "tenant_id": "tenant-default"
        }
    ],
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
                disk_u_map = {str(du.get("id")): du for du in db.get("users", []) if isinstance(du, dict) and du.get("id") is not None}
                users_list = []
                for u in db_users:
                    u_dict = {col.name: getattr(u, col.name) for col in SystemUser.__table__.columns}
                    du = disk_u_map.get(str(u_dict.get("id")))
                    if du:
                        if not u_dict.get("managed_users") and du.get("managed_users"):
                            u_dict["managed_users"] = du.get("managed_users")
                        if not u_dict.get("managed_queues") and du.get("managed_queues"):
                            u_dict["managed_queues"] = du.get("managed_queues")
                    u_dict["managed_users"] = u_dict.get("managed_users") if isinstance(u_dict.get("managed_users"), list) else []
                    u_dict["managed_queues"] = u_dict.get("managed_queues") if isinstance(u_dict.get("managed_queues"), list) else []
                    users_list.append(u_dict)
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

            
            # Auto assign wallboard, dialer, call_flow, and call_monitor to admin and supervisor if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "wallboard:access" not in new_perms:
                    new_perms.append("wallboard:access")
                if "supervisor:access" not in new_perms:
                    new_perms.append("supervisor:access")
                for sup_sub in ["supervisor:agent_status", "supervisor:agent_logout", "supervisor:scope_filter"]:
                    if sup_sub not in new_perms:
                        new_perms.append(sup_sub)
                if "dialer:access" not in new_perms:
                    new_perms.append("dialer:access")
                if "call_flow:access" not in new_perms:
                    new_perms.append("call_flow:access")
                if "ai_agents:access" not in new_perms:
                    new_perms.append("ai_agents:access")
                if "ai_whisper:access" not in new_perms:
                    new_perms.append("ai_whisper:access")
                if "call_monitor:listen" not in new_perms:
                    new_perms.append("call_monitor:listen")
                if "call_monitor:whisper" not in new_perms:
                    new_perms.append("call_monitor:whisper")
                if "call_monitor:barge" not in new_perms:
                    new_perms.append("call_monitor:barge")
                if "sip_debugger:access" not in new_perms:
                    new_perms.append("sip_debugger:access")
                for tr_perm in ["live_translator:access", "call_panel:live_translation", "call_panel:voice_interpreter"]:
                    if tr_perm not in new_perms:
                        new_perms.append(tr_perm)
            
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
                if "call_panel:view_transcripts" not in new_perms:
                    new_perms.append("call_panel:view_transcripts")
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

            # Migrate call_panel granular sub-permissions if role has call_panel:access but no call_panel:tab_* yet
            has_call_panel_subs = any(
                p.startswith("call_panel:tab_") or p.startswith("call_panel:webphone_") or p.startswith("call_panel:agents_")
                for p in new_perms
            )
            if "call_panel:access" in new_perms and not has_call_panel_subs:
                default_cp_subs = [
                    "call_panel:tab_dashboard", "call_panel:tab_webphone", "call_panel:tab_agents", "call_panel:tab_speeddial",
                    "call_panel:tab_missed", "call_panel:tab_directory", "call_panel:tab_history", "call_panel:tab_voicemail", "call_panel:tab_chat",
                    "call_panel:listen_records", "call_panel:view_transcripts", "call_panel:webphone_save_contact", "call_panel:webphone_transfer",
                    "call_panel:webphone_conference", "call_panel:webphone_reject",
                    "call_panel:agents_status", "call_panel:agents_duration", "call_panel:agents_call_counts", "call_panel:agents_login_logout",
                ]
                for cp_p in default_cp_subs:
                    if cp_p not in new_perms:
                        new_perms.append(cp_p)

            # Auto assign all system permissions to admin and superadmin roles
            if r.get("role_code") in ["admin", "superadmin"]:
                admin_defaults = DEFAULT_SETTINGS["roles"][0]["permissions"]
                for p in admin_defaults:
                    if p not in new_perms:
                        new_perms.append(p)
            elif r.get("role_code") == "supervisor":
                sup_defaults = DEFAULT_SETTINGS["roles"][1]["permissions"]
                for p in sup_defaults:
                    if has_call_panel_subs and p.startswith("call_panel:") and p != "call_panel:access":
                        continue
                    if p not in new_perms:
                        new_perms.append(p)
            elif r.get("role_code") == "agent":
                agt_defaults = DEFAULT_SETTINGS["roles"][2]["permissions"]
                for p in agt_defaults:
                    if has_call_panel_subs and p.startswith("call_panel:") and p != "call_panel:access":
                        continue
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

    # Ensure intent_rules config exists
    if "intent_rules" not in db or not isinstance(db.get("intent_rules"), list):
        db["intent_rules"] = [r.copy() for r in DEFAULT_SETTINGS["intent_rules"]]

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
    # Trigger Asterisk HTTP/WSS, PJSIP & Dialplan Reload command dynamically
    try:
        import subprocess
        subprocess.run(["asterisk", "-rx", "module reload http"], capture_output=True, text=True, timeout=2.0)
        res = subprocess.run(["asterisk", "-rx", "pjsip reload"], capture_output=True, text=True, timeout=2.0)
        subprocess.run(["asterisk", "-rx", "dialplan reload"], capture_output=True, text=True, timeout=2.0)
        if res.returncode == 0:
            print("[Asterisk Config] HTTP/WSS, PJSIP ve Dialplan başarıyla yenilendi (host).")
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


def _normalize_trunk_codecs(t: dict) -> str:
    valid_codecs = {"alaw", "ulaw", "g722", "g729", "opus", "gsm", "ilbc", "h264", "vp8", "g726", "slin", "speex"}
    raw_list = t.get("codecs")
    if isinstance(raw_list, str):
        try:
            import json
            raw_list = json.loads(raw_list)
        except Exception:
            raw_list = [x.strip() for x in raw_list.split(",") if x.strip()]
    out = []
    if isinstance(raw_list, list) and len(raw_list) > 0:
        for item in raw_list:
            c = str(item or "").strip().lower()
            if c in ("g711", "g.711"):
                for sub in ("alaw", "ulaw"):
                    if sub not in out:
                        out.append(sub)
            elif c in valid_codecs and c not in out:
                out.append(c)
    if not out:
        legacy = str(t.get("codec") or "alaw,ulaw,g722,g729").strip()
        for part in legacy.split(","):
            p = part.strip().lower()
            if p in ("g711", "g.711"):
                for sub in ("alaw", "ulaw"):
                    if sub not in out:
                        out.append(sub)
            elif p in valid_codecs and p not in out:
                out.append(p)
    if not out:
        out = ["alaw", "ulaw", "g722", "g729"]
    return ",".join(out)


def _parse_trunk_sip_headers(t: dict) -> dict:
    raw = t.get("sip_headers")
    if isinstance(raw, str):
        try:
            import json
            raw = json.loads(raw)
        except Exception:
            raw = {}
    if not isinstance(raw, dict):
        raw = {}
    return raw


def _sanitize_trunk_name(name: str) -> str:
    import re
    clean = re.sub(r"[^a-zA-Z0-9_\-.]", "_", str(name or "trunk").strip())
    return clean or "trunk"


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

    # Merge any extra fields from settings_db["trunks"] if DB columns were newly added
    disk_trunks_map = {str(dt.get("trunk_name") or dt.get("id") or ""): dt for dt in settings_db.get("trunks", [])}
    for t in trunks_list:
        tk = str(t.get("trunk_name") or t.get("id") or "")
        dt = disk_trunks_map.get(tk)
        if dt:
            for extra_k in ("codecs", "call_limit_enabled", "call_limit_direction", "max_channels", "sip_headers"):
                if t.get(extra_k) in (None, {}, []) and dt.get(extra_k) not in (None, {}, []):
                    t[extra_k] = dt.get(extra_k)

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

    # Check if any active trunk sets a custom User-Agent
    custom_global_ua = ""
    for t in trunks_list:
        if t.get("is_active", True) is False:
            continue
        sh = _parse_trunk_sip_headers(t)
        ua_val = str(sh.get("user_agent") or "").strip()
        if ua_val:
            custom_global_ua = ua_val
            break

    global_ua_block = ""
    if custom_global_ua:
        global_ua_block = f"""[global]
type=global
user_agent={custom_global_ua}
max_forwards=70

"""

    tls_transport_block = ""
    has_tls_trunk = any(str(t.get("protocol") or "").lower() == "tls" and (t.get("is_active", True) is not False) for t in trunks_list)
    if has_tls_trunk or os.path.exists("/etc/asterisk/keys/asterisk.pem"):
        tls_transport_block = f"""[transport-tls]
type=transport
protocol=tls
bind=0.0.0.0:5061
cert_file=/etc/asterisk/keys/asterisk.pem
priv_key_file=/etc/asterisk/keys/webphone_privkey.pem
method=tlsv1_2
verify_server=no
verify_client=no
{nat_lines}"""

    has_explicit_operator_trunk = any(
        _sanitize_trunk_name(t.get("trunk_name") or t.get("name") or "") == "Operator_Trunk" and (t.get("is_active", True) is not False)
        for t in trunks_list
    )
    primary_trunk_ref = next(
        (t for t in trunks_list if (t.get("is_active", True) is not False) and str(t.get("trunk_name") or "") == "908503607390"),
        next((t for t in trunks_list if (t.get("is_active", True) is not False)), None)
    )
    op_trunk_codecs = _normalize_trunk_codecs(primary_trunk_ref) if primary_trunk_ref else "ulaw,alaw,g722,g729"

    conf_content = f"""; ==========================================
; DINAMIK OLARAK OLUŞTURULAN SIP TRUNK VE TRANSPORT AYARLARI
; ==========================================

{global_ua_block}[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0
{nat_lines}
[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0
{nat_lines}
{tls_transport_block}[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0:8088
{nat_lines}
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
{nat_lines}
"""
    if not has_explicit_operator_trunk:
        conf_content += f"""
; --- OPERATOR TRUNK (OUTBOUND LINK) ---
[Operator_Trunk]
type=endpoint
context=default
disallow=all
allow={op_trunk_codecs}
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
        raw_name = t.get("trunk_name") or t.get("name") or "trunk"
        name = _sanitize_trunk_name(raw_name)
        host = str(t.get("host") or "").strip() or "127.0.0.1"
        port = t.get("port") or 5060
        did = str(t.get("did_number") or "").strip()
        protocol = str(t.get("protocol") or "udp").lower()
        if protocol == "tls":
            transport = "transport-tls"
        elif protocol == "tcp":
            transport = "transport-tcp"
        else:
            transport = "transport-udp"

        t_type = str(t.get("trunk_type") or "register").lower()
        if t_type == "ip":
            t_type = "peer"

        username = str(t.get("username") or "").strip()
        password = str(t.get("password") or "").strip()
        allow_codecs = _normalize_trunk_codecs(t)
        sip_hdrs = _parse_trunk_sip_headers(t)

        realm = str(sip_hdrs.get("realm") or "").strip()
        user_agent = str(sip_hdrs.get("user_agent") or "").strip()
        maxptime = str(sip_hdrs.get("maxptime") or "").strip()
        in_caller_hdr = str(sip_hdrs.get("inbound_caller_header") or "default").strip()
        out_from_user = str(sip_hdrs.get("outbound_from_user") or "default").strip()
        out_from_user_custom = str(sip_hdrs.get("outbound_from_user_custom") or "").strip()
        out_diversion = str(sip_hdrs.get("outbound_diversion") or "none").strip()
        out_rpid = str(sip_hdrs.get("outbound_rpid") or "none").strip()
        out_pai = str(sip_hdrs.get("outbound_pai") or "none").strip()

        send_rpid = "yes" if out_rpid != "none" else "no"
        send_pai = "yes" if out_pai != "none" else "no"
        send_diversion = "yes" if out_diversion != "none" else "no"
        trust_id_in = "yes" if in_caller_hdr in ("rpid", "pai", "ppi", "default") else "no"

        # Resolve static from_user for PJSIP endpoint if applicable
        endpoint_from_user = ""
        if out_from_user == "trunk_username" and username:
            endpoint_from_user = username
        elif out_from_user == "trunk_did" and did:
            endpoint_from_user = did
        elif out_from_user == "custom" and out_from_user_custom:
            endpoint_from_user = out_from_user_custom
        elif t_type == "register" and out_from_user == "default" and username:
            endpoint_from_user = username

        endpoint_from_domain = realm if realm else (host if t_type in ("register", "peer") and host != "127.0.0.1" else "")
        realm_line = f"realm={realm}\n" if realm else ""
        contact_user_line = f"contact_user={did}\n" if did else ""

        conf_content += f"\n; --- TRUNK: {raw_name} (Type={t_type}, Transport={protocol.upper()}, Codecs={allow_codecs}{f', Maxptime={maxptime}' if maxptime else ''}{f', UA={user_agent}' if user_agent else ''}) ---\n"

        if t_type == "register":
            conf_content += f"""[{name}-auth]
type=auth
auth_type=userpass
username={username}
password={password}
{realm_line}
[{name}-reg]
type=registration
transport={transport}
outbound_auth={name}-auth
server_uri=sip:{host}:{port}
client_uri=sip:{username}@{host}:{port}
retry_interval=60
expiration=3600
auth_rejection_permanent=no
{contact_user_line}
[{name}-aor]
type=aor
contact=sip:{host}:{port}
qualify_frequency=60

[{name}]
type=endpoint
transport={transport}
context=from-trunk-{name}
disallow=all
allow={allow_codecs}
aors={name}-aor
outbound_auth={name}-auth
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
send_rpid={send_rpid}
send_pai={send_pai}
send_diversion={send_diversion}
trust_id_inbound={trust_id_in}
"""
            if endpoint_from_user:
                conf_content += f"from_user={endpoint_from_user}\n"
            if endpoint_from_domain:
                conf_content += f"from_domain={endpoint_from_domain}\n"
            if did:
                conf_content += f"callerid={did} <{did}>\n"

            conf_content += f"""
[{name}-identify]
type=identify
endpoint={name}
match={host}

"""
        elif t_type == "peer":
            conf_content += f"""[{name}-aor]
type=aor
contact=sip:{host}:{port}
qualify_frequency=60

[{name}]
type=endpoint
transport={transport}
context=from-trunk-{name}
disallow=all
allow={allow_codecs}
aors={name}-aor
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
send_rpid={send_rpid}
send_pai={send_pai}
send_diversion={send_diversion}
trust_id_inbound={trust_id_in}
"""
            if endpoint_from_user:
                conf_content += f"from_user={endpoint_from_user}\n"
            if endpoint_from_domain:
                conf_content += f"from_domain={endpoint_from_domain}\n"
            if did:
                conf_content += f"callerid={did} <{did}>\n"

            conf_content += f"""
[{name}-identify]
type=identify
endpoint={name}
match={host}

"""
        elif t_type == "account":
            acc_user = username or name
            conf_content += f"""[{name}-auth]
type=auth
auth_type=userpass
username={acc_user}
password={password}
{realm_line}
[{name}-aor]
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=30

[{name}]
type=endpoint
transport={transport}
context=from-trunk-{name}
disallow=all
allow={allow_codecs}
auth={name}-auth
outbound_auth={name}-auth
aors={name}-aor
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
send_rpid={send_rpid}
send_pai={send_pai}
send_diversion={send_diversion}
trust_id_inbound={trust_id_in}
"""
            if endpoint_from_user:
                conf_content += f"from_user={endpoint_from_user}\n"
            if endpoint_from_domain:
                conf_content += f"from_domain={endpoint_from_domain}\n"
            if did:
                conf_content += f"callerid={did} <{did}>\n"
            conf_content += "\n"

            if acc_user and acc_user != name:
                conf_content += f"""[{acc_user}]
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=30

[{acc_user}]
type=endpoint
transport={transport}
context=from-trunk-{name}
disallow=all
allow={allow_codecs}
auth={name}-auth
outbound_auth={name}-auth
aors={acc_user}
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
send_rpid={send_rpid}
send_pai={send_pai}
send_diversion={send_diversion}
trust_id_inbound={trust_id_in}
"""
                if endpoint_from_user:
                    conf_content += f"from_user={endpoint_from_user}\n"
                if endpoint_from_domain:
                    conf_content += f"from_domain={endpoint_from_domain}\n"
                conf_content += "\n"

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
            max_act = max(5, int(u.get("max_activations") or 5))
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
rtp_symmetric=yes
webrtc=yes
rewrite_contact=no
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
            
    # Comprehensive search for SSL certificate (Let's Encrypt)
    try:
        ast_keys_dir = "/etc/asterisk/keys"
        os.makedirs(ast_keys_dir, exist_ok=True)
        try:
            os.chmod(ast_keys_dir, 0o755)
        except Exception:
            pass
        target_cert = None
        target_key = None

        letsencrypt_base = "/etc/letsencrypt/live"
        if os.path.exists(letsencrypt_base):
            try:
                candidates = []
                for root, dirs, files in os.walk(letsencrypt_base):
                    if "fullchain.pem" in files and "privkey.pem" in files:
                        fc_p = os.path.join(root, "fullchain.pem")
                        pk_p = os.path.join(root, "privkey.pem")
                        score = 2 if ("aida" in root.lower() or "saphira" in root.lower()) else 1
                        candidates.append((score, fc_p, pk_p))
                if candidates:
                    candidates.sort(key=lambda x: x[0], reverse=True)
                    target_cert = candidates[0][1]
                    target_key = candidates[0][2]
            except Exception:
                pass

        if target_cert and target_key:
            try:
                ast_fc = os.path.join(ast_keys_dir, "webphone_fullchain.pem")
                ast_pk = os.path.join(ast_keys_dir, "webphone_privkey.pem")
                ast_combined = os.path.join(ast_keys_dir, "asterisk.pem")

                shutil.copy2(os.path.realpath(target_cert), ast_fc)
                shutil.copy2(os.path.realpath(target_key), ast_pk)

                with open(ast_fc, "r") as f1, open(ast_pk, "r") as f2, open(ast_combined, "w") as fout:
                    fout.write(f1.read().strip() + "\n" + f2.read().strip() + "\n")

                os.chmod(ast_fc, 0o644)
                os.chmod(ast_pk, 0o644)
                os.chmod(ast_combined, 0o644)
                subprocess.run(["chown", "-R", "asterisk:asterisk", ast_keys_dir], check=False, capture_output=True, timeout=2.0)
                print(f"[Asterisk Config] SSL sertifikası Asterisk için hazırlandı ve birleştirildi: {ast_combined}")
            except Exception as e_ssl_main:
                print(f"[Asterisk Config] SSL birleştirme hatası: {e_ssl_main}")
    except Exception as e_keys:
        print(f"[Asterisk Config] SSL anahtar dizini oluşturulamadı/erişilemedi: {e_keys}")

    # Auto-sync /etc/asterisk/http.conf for WebRTC WebSocket port 8088 & WSS port 8089
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
sessionlimit=1000
session_inactivity=30000
session_keep_alive=15000
"""
    if os.path.exists("/etc/asterisk"):
        try:
            http_etc_path = "/etc/asterisk/http.conf"
            with open(http_etc_path, "w", encoding="utf-8") as f:
                f.write(http_content)
            print("[Asterisk Config] /etc/asterisk/http.conf güncellendi.")
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
        added_exts = set()
        all_groups = settings_db.get("subscriber_groups", [])
        for member in members:
            user_id = member.get("user_id") if isinstance(member, dict) else member
            s_uid = str(user_id or "")
            if s_uid.startswith("group_"):
                gid = s_uid.replace("group_", "", 1)
                grp = next((g for g in all_groups if str(g.get("id")) == gid), None)
                if grp:
                    for ext_or_id in (grp.get("extensions") or grp.get("members") or []):
                        u_grp = next((u for u in users_list if str(u.get("id")) == str(ext_or_id) or str(u.get("extension")) == str(ext_or_id)), None)
                        if u_grp and u_grp.get("extension") and str(u_grp["extension"]) not in added_exts:
                            added_exts.add(str(u_grp["extension"]))
                            conf_content += f"member => PJSIP/{u_grp['extension']}\n"
                continue
            u = next((u for u in users_list if str(u.get("id")) == s_uid or str(u.get("extension")) == s_uid), None)
            if u and u.get("extension") and str(u["extension"]) not in added_exts:
                added_exts.add(str(u["extension"]))
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

def _build_trunk_inbound_contexts(trunks_list: list) -> str:
    header_map = {
        "from": "From",
        "contact": "Contact",
        "rpid": "Remote-Party-ID",
        "pai": "P-Asserted-Identity",
        "ppi": "P-Preferred-Identity",
        "to": "To",
        "diversion": "Diversion",
        "p_called_party_id": "P-Called-Party-ID",
    }
    blocks = []
    seen_names = set()
    for t in trunks_list:
        is_act = t.get("is_active") if "is_active" in t else True
        if not is_act:
            continue
        raw_name = t.get("trunk_name") or t.get("name") or "trunk"
        name = _sanitize_trunk_name(raw_name)
        if name in seen_names:
            continue
        seen_names.add(name)

        sip_hdrs = _parse_trunk_sip_headers(t)
        in_caller = str(sip_hdrs.get("inbound_caller_header") or "default").strip().lower()
        in_callee = str(sip_hdrs.get("inbound_callee_header") or "default").strip().lower()
        maxptime = str(sip_hdrs.get("maxptime") or "").strip()

        limit_enabled = bool(t.get("call_limit_enabled", False))
        limit_dir = str(t.get("call_limit_direction") or "both").strip().lower()
        try:
            max_ch = max(1, int(t.get("max_channels") or 30))
        except Exception:
            max_ch = 30

        caller_hdr_name = header_map.get(in_caller, "")
        callee_hdr_name = header_map.get(in_callee, "")

        lines = [f"; --- INBOUND CONTEXT FOR TRUNK: {raw_name} ({name}) ---", f"[from-trunk-{name}]"]
        for ext_pat in ("_X.", "_+X.", "s"):
            lines.append(f"exten => {ext_pat},1,NoOp(Trunk [{name}] Gelen Arama: Exten=${{EXTEN}} Caller=${{CALLERID(num)}})")
            lines.append(f"same => n,Set(__INBOUND_TRUNK_NAME={name})")
            if maxptime:
                lines.append(f"same => n,Set(__SIP_MAXPTIME={maxptime})")

            # 1. Inbound Caller Number Header Extraction
            if caller_hdr_name:
                lines.append(f"same => n,Set(RAW_IN_CALLER=${{PJSIP_HEADER(read,{caller_hdr_name})}})")
                lines.append("same => n,Set(PARSED_CALLER=${CUT(CUT(CUT(RAW_IN_CALLER,@,1),:,2),>,1)})")
                lines.append("same => n,Set(CALLERID(num)=${IF($[\"${PARSED_CALLER}\" != \"\"]?${PARSED_CALLER}:${CALLERID(num)})})")

            # 2. Inbound Callee Number (DID) Header Extraction
            if callee_hdr_name:
                lines.append(f"same => n,Set(RAW_IN_CALLEE=${{PJSIP_HEADER(read,{callee_hdr_name})}})")
                lines.append("same => n,Set(PARSED_CALLEE=${CUT(CUT(CUT(RAW_IN_CALLEE,@,1),:,2),>,1)})")
                lines.append("same => n,Set(RESOLVED_DID=${IF($[\"${PARSED_CALLEE}\" != \"\"]?${PARSED_CALLEE}:${EXTEN})})")
            else:
                lines.append("same => n,Set(RESOLVED_DID=${EXTEN})")

            # Preserve original caller for forwarding / outbound headers
            lines.append("same => n,Set(__ORIG_CALLER_NUM=${CALLERID(num)})")
            lines.append("same => n,Set(__ORIG_CALLER_NAME=${CALLERID(name)})")

            # 3. Call Limit Check (Inbound / Both)
            if limit_enabled and limit_dir in ("both", "inbound"):
                lines.append(f"same => n,Set(GROUP(trunk_limit)={name})")
                lines.append(f"same => n,NoOp(Trunk [{name}] Aktif Kanal: ${{GROUP_COUNT({name}@trunk_limit)}} / {max_ch})")
                lines.append(f"same => n,GotoIf($[${{GROUP_COUNT({name}@trunk_limit)}} > {max_ch}]?limit_exceeded)")

            lines.append("same => n,Goto(default,${RESOLVED_DID},1)")
            if limit_enabled and limit_dir in ("both", "inbound"):
                lines.append(f"same => n(limit_exceeded),NoOp(TRUNK CAGRI LIMITI ASILDI [{name}]: Max={max_ch})")
                lines.append("same => n,Busy(5)")
                lines.append("same => n,Hangup(17)")
            lines.append("")

        blocks.append("\n".join(lines))
    return "\n".join(blocks)


def regenerate_extensions_custom_conf(background_tasks: Optional[BackgroundTasks] = None):
    is_docker = os.path.exists("/.dockerenv") or os.getenv("IS_DOCKER", "false").lower() == "true"
    default_backend_host = "host.docker.internal:8000" if is_docker else "127.0.0.1:8000"
    default_audiosocket_host = "host.docker.internal:9092" if is_docker else "127.0.0.1:9092"
    backend_host = os.getenv("BACKEND_HOST", default_backend_host)
    audiosocket_host = os.getenv("AUDIOSOCKET_HOST", default_audiosocket_host)

    trunks_list = []
    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import Trunk
        with SyncSessionLocal() as session:
            db_trunks = session.query(Trunk).all()
            for t in db_trunks:
                trunks_list.append({col.name: getattr(t, col.name) for col in Trunk.__table__.columns})
    except Exception:
        pass
    if not trunks_list:
        trunks_list = settings_db.get("trunks", [])
    disk_trunks_map = {str(dt.get("trunk_name") or dt.get("id") or ""): dt for dt in settings_db.get("trunks", [])}
    for t in trunks_list:
        tk = str(t.get("trunk_name") or t.get("id") or "")
        dt = disk_trunks_map.get(tk)
        if dt:
            for extra_k in ("codecs", "call_limit_enabled", "call_limit_direction", "max_channels", "sip_headers"):
                if t.get(extra_k) in (None, {}, []) and dt.get(extra_k) not in (None, {}, []):
                    t[extra_k] = dt.get(extra_k)

    trunk_inbound_contexts = _build_trunk_inbound_contexts(trunks_list)

    pbx_cfg = settings_db.get("pbx", {}) if isinstance(settings_db.get("pbx"), dict) else {}
    num_plan = pbx_cfg.get("numbering_plan", {}) if isinstance(pbx_cfg.get("numbering_plan"), dict) else {}
    pickup_cfg = num_plan.get("call_pickup", {}) if isinstance(num_plan.get("call_pickup"), dict) else {}
    fwd_cfg = num_plan.get("call_forwarding", {}) if isinstance(num_plan.get("call_forwarding"), dict) else {}
    mon_cfg = num_plan.get("call_monitoring", {}) if isinstance(num_plan.get("call_monitoring"), dict) else {}

    pickup_group = str(pickup_cfg.get("group") or "*8").strip() or "*8"
    pickup_directed = str(pickup_cfg.get("directed") or "**").strip() or "**"
    pickup_dir_len = len(pickup_directed)

    fwd_always_pfx = str(fwd_cfg.get("always") or "*21*").strip() or "*21*"
    fwd_busy_pfx = str(fwd_cfg.get("busy") or "*67*").strip() or "*67*"
    fwd_noans_pfx = str(fwd_cfg.get("no_answer") or "*61*").strip() or "*61*"
    fwd_cancel_pfx = str(fwd_cfg.get("cancel") or "#21#").strip() or "#21#"

    mon_listen_pfx = str(mon_cfg.get("listen") or "*551*").strip() or "*551*"
    mon_whisper_pfx = str(mon_cfg.get("whisper") or "*552*").strip() or "*552*"
    mon_barge_pfx = str(mon_cfg.get("barge") or "*553*").strip() or "*553*"

    def _build_chanspy_exten(pat_str: str, mode_str: str, comment_str: str) -> str:
        return f"""; {comment_str} ({pat_str})
exten => {pat_str},1,NoOp(Masa Telefonu Canli Cagri Izleme [{mode_str}]: Arayan=${{CALLERID(num)}}, Kod=${{EXTEN}})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=3)
same => n,Set(SPY_RES=${{CURL(http://{backend_host}/api/calls/resolve_chanspy?caller=${{URIENCODE(${{CALLERID(num)}})}}&exten=${{URIENCODE(${{EXTEN}})}}&mode={mode_str}&channel=${{URIENCODE(${{CHANNEL(name)}})}})}})
same => n,Set(SPY_STATUS=${{CUT(SPY_RES,:,1)}})
same => n,Set(SPY_CHAN=${{CUT(SPY_RES,:,2)}})
same => n,Set(SPY_FLAGS=${{CUT(SPY_RES,:,3)}})
same => n,GotoIf($["${{SPY_STATUS}}"="ALLOW"]?do_spy:deny_spy)
same => n(do_spy),NoOp(ChanSpy Baslatiliyor: Kanal=${{SPY_CHAN}}, Bayraklar=${{SPY_FLAGS}})
same => n,Answer()
same => n,Wait(0.2)
same => n,ChanSpy(${{SPY_CHAN}},${{SPY_FLAGS}})
same => n,Hangup()
same => n(deny_spy),NoOp(ChanSpy Reddedildi veya Aktif Cagri Yok: ${{SPY_RES}})
same => n,Answer()
same => n,Wait(0.2)
same => n,Playback(beeperr)
same => n,Hangup()
"""

    def _build_feat_exten(pat_str: str, comment_str: str) -> str:
        return f"""; {comment_str} ({pat_str})
exten => {pat_str},1,NoOp(Masa Telefonu Yonlendirme Kodu: Arayan=${{CALLERID(num)}}, Kod=${{EXTEN}})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=3)
same => n,Set(FEAT_RES=${{CURL(http://{backend_host}/api/subscriber/resolve_feature_code?caller=${{URIENCODE(${{CALLERID(num)}})}}&exten=${{URIENCODE(${{EXTEN}})}}&channel=${{URIENCODE(${{CHANNEL(name)}})}})}})
same => n,GotoIf($["${{CUT(FEAT_RES,:,1)}}"="CHANSPY"]?do_feat_spy)
same => n,Answer()
same => n,Wait(0.3)
same => n,GotoIf($["${{FEAT_RES}}"="ACTIVATED"]?play_act)
same => n,GotoIf($["${{FEAT_RES}}"="CANCELLED"]?play_canc)
same => n,Playback(beeperr)
same => n,Hangup()
same => n(do_feat_spy),Set(SPY_CHAN=${{CUT(FEAT_RES,:,2)}})
same => n,Set(SPY_FLAGS=${{CUT(FEAT_RES,:,3)}})
same => n,Answer()
same => n,Wait(0.2)
same => n,ChanSpy(${{SPY_CHAN}},${{SPY_FLAGS}})
same => n,Hangup()
same => n(play_act),Playback(/var/spool/asterisk/monitor/tr_yonlendirme_aktif)
same => n,Hangup()
same => n(play_canc),Playback(/var/spool/asterisk/monitor/tr_yonlendirme_iptal)
same => n,Hangup()
"""

    reserved_pats = {pickup_group, f"_{pickup_directed}X."}
    feat_blocks = []
    seen_pats = set(reserved_pats)

    def _add_chanspy_feat(pat: str, mode_str: str, label: str):
        if not pat or pat in seen_pats:
            return
        seen_pats.add(pat)
        feat_blocks.append(_build_chanspy_exten(pat, mode_str, label))

    def _add_feat(pat: str, label: str):
        if not pat or pat in seen_pats:
            return
        seen_pats.add(pat)
        feat_blocks.append(_build_feat_exten(pat, label))

    for m_pfx, m_mode, m_lbl in [
        (mon_listen_pfx, "listen", "Cagri Dinleme / Fisildama (ChanSpy Listen)"),
        (mon_whisper_pfx, "whisper", "Sufle Verme (ChanSpy Whisper)"),
        (mon_barge_pfx, "barge", "Araya Girme (ChanSpy Barge)"),
    ]:
        _add_chanspy_feat(f"_{m_pfx}.", m_mode, m_lbl)
        if m_pfx.endswith("*") and len(m_pfx.rstrip("*")) >= 2:
            _add_chanspy_feat(f"_{m_pfx.rstrip('*')}X.", m_mode, f"{m_lbl} (Alternatif)")
        _add_chanspy_feat(m_pfx, m_mode, f"{m_lbl} (Genel AI/Aktif Cagri)")

    for pfx, lbl in [
        (fwd_always_pfx, "Her Zaman Yonlendirme"),
        (fwd_busy_pfx, "Mesgulde Yonlendirme"),
        (fwd_noans_pfx, "Zaman Asiminda Yonlendirme"),
    ]:
        _add_feat(f"_{pfx}.", f"{lbl} Aktiflestirme")
        if pfx.endswith("*") and len(pfx.rstrip("*")) >= 2:
            _add_feat(f"_{pfx.rstrip('*')}X.", f"{lbl} Alternatif Aktiflestirme")
        _add_feat(pfx, f"{lbl} Dogrudan Iptal")

    _add_feat(fwd_cancel_pfx, "Yonlendirme Iptal Kodu")
    if fwd_cancel_pfx.endswith("#") and len(fwd_cancel_pfx.rstrip("#")) >= 2:
        _add_feat(fwd_cancel_pfx.rstrip("#"), "Yonlendirme Iptal Kodu (# Send Fallback)")
    _add_feat(f"_{fwd_cancel_pfx}.", "Yonlendirme Iptal Kodu + Hedef")

    # Generic catch-all feature code patterns for * and # (and URL-encoded %23)
    _add_feat("_*.", "Genel Yildiz (*) Ozellik Kodu Yakalayici")
    _add_feat("_#.", "Genel Kare (#) Ozellik Kodu Yakalayici")
    _add_feat("_%23.", "Genel URL-Encoded Kare (%23) Ozellik Kodu Yakalayici")

    dynamic_feature_dialplan = "\n".join(feat_blocks)

    conf_content = f"""; ==========================================
; DINAMIK OLARAK OLUŞTURULAN EXTENSIONS (DIALPLAN) AYARLARI
; ==========================================

[from-trunk]
include => default

[from-pstn]
include => default

[from-sip]
include => default

{trunk_inbound_contexts}

[trunk-outbound-headers]
exten => s,1,NoOp(Trunk Giden SIP Basliklari Uygulanıyor: Trunk=${{OUT_TRUNK_NAME}})
same => n,GotoIf($["${{OUT_HDR_DIVERSION}}" = ""]?chk_rpid)
same => n,Set(PJSIP_HEADER(add,Diversion)=${{OUT_HDR_DIVERSION}})
same => n(chk_rpid),GotoIf($["${{OUT_HDR_RPID}}" = ""]?chk_pai)
same => n,Set(PJSIP_HEADER(add,Remote-Party-ID)=${{OUT_HDR_RPID}})
same => n(chk_pai),GotoIf($["${{OUT_HDR_PAI}}" = ""]?chk_ppi)
same => n,Set(PJSIP_HEADER(add,P-Asserted-Identity)=${{OUT_HDR_PAI}})
same => n(chk_ppi),GotoIf($["${{OUT_HDR_PPI}}" = ""]?chk_ptime)
same => n,Set(PJSIP_HEADER(add,P-Preferred-Identity)=${{OUT_HDR_PPI}})
same => n(chk_ptime),GotoIf($["${{OUT_MAXPTIME}}" = ""]?done_hdrs)
same => n,Set(PJSIP_HEADER(add,X-Maxptime)=${{OUT_MAXPTIME}})
same => n(done_hdrs),Return()

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
same => n,Playback(/var/spool/asterisk/monitor/tr_aktariliyor)
same => n,Queue(temsilci_kuyrugu,c)
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(SURVEY_CFG=${{CURL(http://{backend_host}/api/queues/survey/config?queue_ext=temsilci_kuyrugu&agent_ext=${{URIENCODE(${{MEMBERINTERFACE}})}}&call_id=${{CALL_UUID}})}})
same => n,GotoIf($["${{CUT(SURVEY_CFG,:,1)}}" != "ENABLED"]?hangup_transfer)
same => n,Set(SURVEY_Q_EXT=${{CUT(SURVEY_CFG,:,2)}})
same => n,Set(SURVEY_MAX_DIGITS=${{CUT(SURVEY_CFG,:,3)}})
same => n,Set(SURVEY_TIMEOUT=${{CUT(SURVEY_CFG,:,4)}})
same => n,Set(SURVEY_Q_WAVS=${{CUT(SURVEY_CFG,:,5)}})
same => n,Set(SURVEY_TY_WAV=${{CUT(SURVEY_CFG,:,6)}})
same => n,Set(SURVEY_Q_CNT=${{CUT(SURVEY_CFG,:,7)}})
same => n,Set(SURVEY_Q_CNT=${{IF($["${{SURVEY_Q_CNT}}" = ""]?1:${{SURVEY_Q_CNT}})}})
same => n,Set(SURVEY_Q_IDX=1)
same => n,Set(SURVEY_ALL_SCORES=)
same => n,Set(SURVEY_ANY_ANS=0)
same => n(survey_t_loop),GotoIf($[${{SURVEY_Q_IDX}} > ${{SURVEY_Q_CNT}}]?survey_t_done)
same => n,Set(CUR_Q_WAV=${{CUT(SURVEY_Q_WAVS,&,${{SURVEY_Q_IDX}})}})
same => n,Set(CUR_Q_WAV=${{IF($["${{CUR_Q_WAV}}" = ""]?tr_anket_soru:${{CUR_Q_WAV}})}})
same => n,Set(SURVEY_SCORE=)
same => n,Read(SURVEY_SCORE,/var/spool/asterisk/monitor/${{CUR_Q_WAV}},${{SURVEY_MAX_DIGITS}},,,${{SURVEY_TIMEOUT}})
same => n,Set(SURVEY_ANY_ANS=${{IF($["${{SURVEY_SCORE}}" != ""]?1:${{SURVEY_ANY_ANS}})}})
same => n,Set(SURVEY_ALL_SCORES=${{IF($[${{SURVEY_Q_IDX}} = 1]?${{SURVEY_SCORE}}:${{SURVEY_ALL_SCORES}},${{SURVEY_SCORE}})}})
same => n,Set(SURVEY_Q_IDX=$[${{SURVEY_Q_IDX}} + 1])
same => n,Goto(survey_t_loop)
same => n(survey_t_done),Set(SURVEY_RES=${{CURL(http://{backend_host}/api/queues/survey/submit?call_id=${{CALL_UUID}}&queue_ext=${{SURVEY_Q_EXT}}&agent_ext=${{URIENCODE(${{MEMBERINTERFACE}})}}&caller=${{CALLERID(num)}}&score=${{URIENCODE(${{SURVEY_ALL_SCORES}})}})}})
same => n,GotoIf($["${{SURVEY_ANY_ANS}}" != "1"]?hangup_transfer)
same => n,Playback(/var/spool/asterisk/monitor/${{SURVEY_TY_WAV}})
same => n(hangup_transfer),Hangup()

[webrtc_agents]
; WebRTC istemcileri ve Masa Telefonları (temsilciler) bu context üzerinden görüşme yapar

; Hedefli Çağrı Çekme (Directed Call Pickup: {pickup_directed}1001 vb.) ve Grup Çağrı Çekme ({pickup_group})
exten => _{pickup_directed}X.,1,NoOp(Hedefli Cagri Cekme: Ceken=${{CALLERID(num)}} -> Calan=${{EXTEN:{pickup_dir_len}}})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(PICKUP_CHAN=${{CURL(http://{backend_host}/api/webrtc/resolve_pickup_channel?target_ext=${{EXTEN:{pickup_dir_len}}}&picker_ext=${{CALLERID(num)}})}})
same => n,GotoIf($["${{PICKUP_CHAN}}" != "" & "${{PICKUP_CHAN}}" != "NONE"]?do_pickupchan:do_std_pickup)
same => n(do_pickupchan),NoOp(PickupChan ile cagri cekiliyor: ${{PICKUP_CHAN}})
same => n,PickupChan(${{PICKUP_CHAN}})
same => n(do_std_pickup),Pickup(${{EXTEN:{pickup_dir_len}}}@webrtc_agents)
same => n,Pickup(${{EXTEN:{pickup_dir_len}}}@default)
same => n,Hangup()

exten => {pickup_group},1,NoOp(Grup Cagri Cekme ({pickup_group}): Ceken=${{CALLERID(num)}})
same => n,Pickup()
same => n,Hangup()

; Çağrı Yönlendirme (Her Zaman, Meşgulde, Zaman Aşımında, İptal Kodu) Prefix'leri
{dynamic_feature_dialplan}

; +90 veya + ile başlayan dış hat aramalarını başında + olmadan yönlendir
exten => _+X.,1,Goto(webrtc_agents,${{EXTEN:1}},1)

; Dış hat aramaları için (0 ile başlayan numaralar - Güvenlik & Toll-Fraud ACL Korumalı)
exten => _0.,1,NoOp(Dis arama guvenlik kontrolu: Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}})
same => n(outbound_start),Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(OUT_ACL=${{CURL(http://{backend_host}/api/acl/check_outbound_call?caller=${{CALLERID(num)}}&callee=${{EXTEN}}&channel=${{URIENCODE(${{CHANNEL(name)}})}}&via=${{URIENCODE(${{PJSIP_HEADER(read,Via)}})}})}})
same => n,GotoIf($["${{OUT_ACL}}" = "ALLOW"]?allow_out:deny_out)
same => n(deny_out),NoOp(GUVENLIK ENGELI: Yetkisiz veya sahte dis arama reddedildi -> Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}}, Sebep=${{OUT_ACL}})
same => n,Playback(/var/spool/asterisk/monitor/tr_yetkisiz_arama)
same => n,Hangup(21)
same => n(allow_out),NoOp(Dis arama onaylandi: Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}})
same => n,Set(MD5_VAL=${{MD5(${{UNIQUEID}}${{EPOCH}})}})
same => n,Set(__CALL_UUID=${{MD5_VAL:0:8}}-${{MD5_VAL:8:4}}-4${{MD5_VAL:13:3}}-a${{MD5_VAL:17:3}}-${{MD5_VAL:20:12}})
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/register?call_id=${{CALL_UUID}}&did=${{EXTEN}}&caller=${{CALLERID(num)}}&asterisk_id=${{UNIQUEID}})}})
same => n,GotoIf($["${{CURL_RESULT}}" = "BLOCKED"]?deny_out)
same => n,MixMonitor(/var/spool/asterisk/monitor/${{CALL_UUID}}.wav)
same => n,Set(DIAL_NUM=${{IF($["${{EXTEN:0:1}}"="0"]?90${{EXTEN:1}}:${{EXTEN}})}})
same => n,Set(OUT_CFG=${{CURL(http://{backend_host}/api/trunks/resolve_outbound_dial?caller=${{URIENCODE(${{CALLERID(num)}})}}&caller_name=${{URIENCODE(${{CALLERID(name)}})}}&callee=${{URIENCODE(${{EXTEN}})}}&dial_num=${{URIENCODE(${{DIAL_NUM}})}}&orig_caller=${{URIENCODE(${{ORIG_CALLER_NUM}})}}&orig_name=${{URIENCODE(${{ORIG_CALLER_NAME}})}})}})
same => n,GotoIf($["${{CUT(OUT_CFG,|,1)}}" = "ALLOW"]?apply_out_cfg:fallback_out_dial)
same => n(apply_out_cfg),Set(__OUT_TRUNK_NAME=${{CUT(OUT_CFG,|,2)}})
same => n,Set(OUT_LIMIT_EN=${{CUT(OUT_CFG,|,3)}})
same => n,Set(OUT_MAX_CH=${{CUT(OUT_CFG,|,4)}})
same => n,Set(OUT_CID_NUM=${{CUT(OUT_CFG,|,5)}})
same => n,Set(OUT_CID_NAME=${{CUT(OUT_CFG,|,6)}})
same => n,Set(OUT_DIAL_STR=${{CUT(OUT_CFG,|,7)}})
same => n,Set(__OUT_HDR_DIVERSION=${{CUT(OUT_CFG,|,8)}})
same => n,Set(__OUT_HDR_RPID=${{CUT(OUT_CFG,|,9)}})
same => n,Set(__OUT_HDR_PAI=${{CUT(OUT_CFG,|,10)}})
same => n,Set(__OUT_HDR_PPI=${{CUT(OUT_CFG,|,11)}})
same => n,Set(__OUT_MAXPTIME=${{CUT(OUT_CFG,|,12)}})
same => n,GotoIf($["${{OUT_LIMIT_EN}}" != "1"]?set_out_cid)
same => n,Set(GROUP(trunk_limit)=${{OUT_TRUNK_NAME}})
same => n,GotoIf($[${{GROUP_COUNT(${{OUT_TRUNK_NAME}}@trunk_limit)}} > ${{OUT_MAX_CH}}]?out_limit_exceeded)
same => n(set_out_cid),Set(CALLERID(num)=${{IF($["${{OUT_CID_NUM}}" != ""]?${{OUT_CID_NUM}}:908503607390)}})
same => n,Set(CALLERID(name)=${{IF($["${{OUT_CID_NAME}}" != ""]?${{OUT_CID_NAME}}:${{CALLERID(num)}})}})
same => n,Dial(${{OUT_DIAL_STR}},60,rb(trunk-outbound-headers^s^1))
same => n,Hangup()
same => n(out_limit_exceeded),NoOp(TRUNK GIDEN CAGRI LIMITI ASILDI: ${{OUT_TRUNK_NAME}} Max=${{OUT_MAX_CH}})
same => n,Busy(5)
same => n,Hangup(17)
same => n(fallback_out_dial),Set(CALLERID(num)=908503607390)
same => n,Set(CALLERID(name)=908503607390)
same => n,Dial(PJSIP/Operator_Trunk/sip:${{DIAL_NUM}}@ikonsip.com:5060,60,r)
same => n,Hangup()

exten => h,1,NoOp(Temsilci aramasi sonlandi. Call ID: ${{CALL_UUID}}, Status: ${{DIALSTATUS}}, Cause: ${{HANGUPCAUSE}})
same => n,GotoIf($["${{CALL_UUID}}" = ""]?done_h)
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/end?call_id=${{CALL_UUID}}&dialstatus=${{DIALSTATUS}}&hangupcause=${{HANGUPCAUSE}})}})
same => n(done_h),NoOp(Hangup tamamlandi)

; İç hat (Diğer temsilciler & Dahililer: 100-999999) ve Prefix'li Dış Aramalar (99805..., 905..., 507... vb. >= 7 hane)
exten => _[1-9]X.,1,GotoIf($[${{LEN(${{EXTEN}})}} >= 7]?outbound_route_ext)
same => n,NoOp(Dahili arama basladi: Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(MD5_VAL=${{MD5(${{UNIQUEID}}${{EPOCH}})}})
same => n,Set(__CALL_UUID=${{MD5_VAL:0:8}}-${{MD5_VAL:8:4}}-4${{MD5_VAL:13:3}}-a${{MD5_VAL:17:3}}-${{MD5_VAL:20:12}})
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/register?call_id=${{CALL_UUID}}&did=${{EXTEN}}&caller=${{CALLERID(num)}}&asterisk_id=${{UNIQUEID}})}})
same => n,GotoIf($["${{CURL_RESULT}}" = "BLOCKED"]?deny)
same => n,Set(ACL_RESULT=${{CURL(http://{backend_host}/api/acl/check_subscriber_call?caller=${{CALLERID(num)}}&callee=${{EXTEN}})}})
same => n,GotoIf($["${{ACL_RESULT}}" = "DENY"]?deny:allow)
same => n(deny),NoOp(ACL REDDEDILDI: Yetkisiz arama)
same => n,Set(DIALSTATUS=FAILED)
same => n,Answer()
same => n,Playback(/var/spool/asterisk/monitor/tr_yetkisiz_arama)
same => n,Hangup()
same => n(outbound_route_ext),NoOp(Prefixli veya 7+ haneli dis arama yonlendiriliyor: Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(OUT_ACL=${{CURL(http://{backend_host}/api/acl/check_outbound_call?caller=${{CALLERID(num)}}&callee=${{EXTEN}}&channel=${{URIENCODE(${{CHANNEL(name)}})}}&via=${{URIENCODE(${{PJSIP_HEADER(read,Via)}})}})}})
same => n,GotoIf($["${{OUT_ACL}}" = "ALLOW"]?allow_out_ext:deny_out_ext)
same => n(deny_out_ext),NoOp(GUVENLIK ENGELI: Yetkisiz veya sahte dis arama reddedildi -> Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}}, Sebep=${{OUT_ACL}})
same => n,Playback(/var/spool/asterisk/monitor/tr_yetkisiz_arama)
same => n,Hangup(21)
same => n(allow_out_ext),NoOp(Dis arama onaylandi: Arayan=${{CALLERID(num)}}, Aranan=${{EXTEN}})
same => n,Set(MD5_VAL=${{MD5(${{UNIQUEID}}${{EPOCH}})}})
same => n,Set(__CALL_UUID=${{MD5_VAL:0:8}}-${{MD5_VAL:8:4}}-4${{MD5_VAL:13:3}}-a${{MD5_VAL:17:3}}-${{MD5_VAL:20:12}})
same => n,Set(CURL_RESULT=${{CURL(http://{backend_host}/api/calls/register?call_id=${{CALL_UUID}}&did=${{EXTEN}}&caller=${{CALLERID(num)}}&asterisk_id=${{UNIQUEID}})}})
same => n,GotoIf($["${{CURL_RESULT}}" = "BLOCKED"]?deny_out_ext)
same => n,MixMonitor(/var/spool/asterisk/monitor/${{CALL_UUID}}.wav)
same => n,Set(DIAL_NUM=${{IF($["${{EXTEN:0:1}}"="0"]?90${{EXTEN:1}}:${{EXTEN}})}})
same => n,Set(OUT_CFG=${{CURL(http://{backend_host}/api/trunks/resolve_outbound_dial?caller=${{URIENCODE(${{CALLERID(num)}})}}&caller_name=${{URIENCODE(${{CALLERID(name)}})}}&callee=${{URIENCODE(${{EXTEN}})}}&dial_num=${{URIENCODE(${{DIAL_NUM}})}}&orig_caller=${{URIENCODE(${{ORIG_CALLER_NUM}})}}&orig_name=${{URIENCODE(${{ORIG_CALLER_NAME}})}})}})
same => n,GotoIf($["${{CUT(OUT_CFG,|,1)}}" = "ALLOW"]?apply_out_cfg_ext:fallback_out_dial_ext)
same => n(apply_out_cfg_ext),Set(__OUT_TRUNK_NAME=${{CUT(OUT_CFG,|,2)}})
same => n,Set(OUT_LIMIT_EN=${{CUT(OUT_CFG,|,3)}})
same => n,Set(OUT_MAX_CH=${{CUT(OUT_CFG,|,4)}})
same => n,Set(OUT_CID_NUM=${{CUT(OUT_CFG,|,5)}})
same => n,Set(OUT_CID_NAME=${{CUT(OUT_CFG,|,6)}})
same => n,Set(OUT_DIAL_STR=${{CUT(OUT_CFG,|,7)}})
same => n,Set(__OUT_HDR_DIVERSION=${{CUT(OUT_CFG,|,8)}})
same => n,Set(__OUT_HDR_RPID=${{CUT(OUT_CFG,|,9)}})
same => n,Set(__OUT_HDR_PAI=${{CUT(OUT_CFG,|,10)}})
same => n,Set(__OUT_HDR_PPI=${{CUT(OUT_CFG,|,11)}})
same => n,Set(__OUT_MAXPTIME=${{CUT(OUT_CFG,|,12)}})
same => n,GotoIf($["${{OUT_LIMIT_EN}}" != "1"]?set_out_cid_ext)
same => n,Set(GROUP(trunk_limit)=${{OUT_TRUNK_NAME}})
same => n,GotoIf($[${{GROUP_COUNT(${{OUT_TRUNK_NAME}}@trunk_limit)}} > ${{OUT_MAX_CH}}]?out_limit_exceeded_ext)
same => n(set_out_cid_ext),Set(CALLERID(num)=${{IF($["${{OUT_CID_NUM}}" != ""]?${{OUT_CID_NUM}}:908503607390)}})
same => n,Set(CALLERID(name)=${{IF($["${{OUT_CID_NAME}}" != ""]?${{OUT_CID_NAME}}:${{CALLERID(num)}})}})
same => n,Dial(${{OUT_DIAL_STR}},60,rb(trunk-outbound-headers^s^1))
same => n,Hangup()
same => n(out_limit_exceeded_ext),NoOp(TRUNK GIDEN CAGRI LIMITI ASILDI: ${{OUT_TRUNK_NAME}} Max=${{OUT_MAX_CH}})
same => n,Busy(5)
same => n,Hangup(17)
same => n(fallback_out_dial_ext),Set(CALLERID(num)=908503607390)
same => n,Set(CALLERID(name)=908503607390)
same => n,Dial(PJSIP/Operator_Trunk/sip:${{DIAL_NUM}}@ikonsip.com:5060,60,r)
same => n,Hangup()
same => n(allow),NoOp(ACL ONAYLANDI: On Yonlendirme Kontrol Ediliyor)
same => n,MixMonitor(/var/spool/asterisk/monitor/${{CALL_UUID}}.wav)

; 1. Ön Yönlendirme ve Aktif Profil Kontrolü (Offline / Koşulsuz Yönlendirme / Cihaz Seçimi)
same => n,Set(FWD_PRE=${{CURL(http://{backend_host}/api/subscriber/resolve_forwarding?extension=${{EXTEN}}&dialstatus=BEFORE_DIAL)}})
same => n,Set(FWD_STATUS=${{CUT(FWD_PRE,:,1)}})
same => n,Set(FWD_TARGET=${{CUT(FWD_PRE,:,2)}})
same => n,Set(FWD_TIMEOUT=${{CUT(FWD_PRE,:,3)}})
same => n,Set(DIAL_TIMEOUT=${{IF($[${{ISNULL(${{FWD_TIMEOUT}})}} | "${{FWD_TIMEOUT}}"=""]?30:${{FWD_TIMEOUT}})}})
same => n,GotoIf($["${{FWD_STATUS}}"="ALLOW"]?forward_call:dial_pjsip)

; 2. PJSIP Dahili Arama (Profil veya Yönlendirme Zaman Aşımı Süresi)
same => n(dial_pjsip),Set(TARGET_CONTACTS=${{PJSIP_DIAL_CONTACTS(${{EXTEN}})}})
same => n,Set(DIAL_STR=${{IF($["${{TARGET_CONTACTS}}"=""]?PJSIP/${{EXTEN}}:${{TARGET_CONTACTS}})}})
same => n,NoOp(PJSIP Dahiliye Arama Yapiliyor: ${{DIAL_STR}} Timeout=${{DIAL_TIMEOUT}}s)
same => n,Dial(${{DIAL_STR}},${{DIAL_TIMEOUT}},tTg)
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
same => n,Answer()
same => n,Playback(/var/spool/asterisk/monitor/tr_sesli_mesaj)
same => n,Hangup()

same => n(dial_internal_fwd),NoOp(Ic Dahili / Mobil Uygulama Yonlendirme: PJSIP/${{FWD_TARGET}} Timeout=${{STEP_TIMEOUT}}s)
same => n,Dial(PJSIP/${{FWD_TARGET}},${{STEP_TIMEOUT}},tTg)
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
same => n,GotoIf($["${{DIALSTATUS}}"="ANSWER"]?check_post_call_survey)
same => n,GotoIf($["${{DIALSTATUS}}"="CANCEL"]?final_hangup)
same => n,Answer()
same => n,GotoIf($["${{DIALSTATUS}}"="BUSY"]?play_busy:play_unavail)
same => n(play_busy),Playback(/var/spool/asterisk/monitor/tr_abone_mesgul)
same => n,Goto(final_hangup)
same => n(play_unavail),Playback(/var/spool/asterisk/monitor/tr_abone_ulasilamiyor)
same => n,Goto(final_hangup)
same => n(check_post_call_survey),Set(SURVEY_CFG=${{CURL(http://{backend_host}/api/queues/survey/config?queue_ext=${{EXTEN}}&agent_ext=${{EXTEN}}&call_id=${{CALL_UUID}})}})
same => n,GotoIf($["${{CUT(SURVEY_CFG,:,1)}}" != "ENABLED"]?final_hangup)
same => n,Set(SURVEY_Q_EXT=${{CUT(SURVEY_CFG,:,2)}})
same => n,Set(SURVEY_MAX_DIGITS=${{CUT(SURVEY_CFG,:,3)}})
same => n,Set(SURVEY_TIMEOUT=${{CUT(SURVEY_CFG,:,4)}})
same => n,Set(SURVEY_Q_WAVS=${{CUT(SURVEY_CFG,:,5)}})
same => n,Set(SURVEY_TY_WAV=${{CUT(SURVEY_CFG,:,6)}})
same => n,Set(SURVEY_Q_CNT=${{CUT(SURVEY_CFG,:,7)}})
same => n,Set(SURVEY_Q_CNT=${{IF($["${{SURVEY_Q_CNT}}" = ""]?1:${{SURVEY_Q_CNT}})}})
same => n,Set(SURVEY_Q_IDX=1)
same => n,Set(SURVEY_ALL_SCORES=)
same => n,Set(SURVEY_ANY_ANS=0)
same => n(survey_w_loop),GotoIf($[${{SURVEY_Q_IDX}} > ${{SURVEY_Q_CNT}}]?survey_w_done)
same => n,Set(CUR_Q_WAV=${{CUT(SURVEY_Q_WAVS,&,${{SURVEY_Q_IDX}})}})
same => n,Set(CUR_Q_WAV=${{IF($["${{CUR_Q_WAV}}" = ""]?tr_anket_soru:${{CUR_Q_WAV}})}})
same => n,Set(SURVEY_SCORE=)
same => n,Read(SURVEY_SCORE,/var/spool/asterisk/monitor/${{CUR_Q_WAV}},${{SURVEY_MAX_DIGITS}},,,${{SURVEY_TIMEOUT}})
same => n,Set(SURVEY_ANY_ANS=${{IF($["${{SURVEY_SCORE}}" != ""]?1:${{SURVEY_ANY_ANS}})}})
same => n,Set(SURVEY_ALL_SCORES=${{IF($[${{SURVEY_Q_IDX}} = 1]?${{SURVEY_SCORE}}:${{SURVEY_ALL_SCORES}},${{SURVEY_SCORE}})}})
same => n,Set(SURVEY_Q_IDX=$[${{SURVEY_Q_IDX}} + 1])
same => n,Goto(survey_w_loop)
same => n(survey_w_done),Set(SURVEY_RES=${{CURL(http://{backend_host}/api/queues/survey/submit?call_id=${{CALL_UUID}}&queue_ext=${{SURVEY_Q_EXT}}&agent_ext=${{EXTEN}}&caller=${{CALLERID(num)}}&score=${{URIENCODE(${{SURVEY_ALL_SCORES}})}})}})
same => n,GotoIf($["${{SURVEY_ANY_ANS}}" != "1"]?final_hangup)
same => n,Playback(/var/spool/asterisk/monitor/${{SURVEY_TY_WAV}})
same => n(final_hangup),Hangup()

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

    # Copy Turkish announcement WAV files to /var/spool/asterisk/monitor/
    try:
        import shutil
        sounds_tr_dir = os.path.join(config_dir, "sounds_tr")
        monitor_dir = "/var/spool/asterisk/monitor"
        if os.path.exists("/var/spool/asterisk") or os.path.exists("/etc/asterisk"):
            os.makedirs(monitor_dir, exist_ok=True)
            for src_dir in [sounds_tr_dir, "uploads/announcements"]:
                if os.path.isdir(src_dir):
                    for fname in os.listdir(src_dir):
                        if fname.endswith(".wav"):
                            src_wav = os.path.join(src_dir, fname)
                            dst_wav = os.path.join(monitor_dir, fname)
                            shutil.copy2(src_wav, dst_wav)
                            os.chmod(dst_wav, 0o644)
    except Exception as e_snd:
        print(f"[Asterisk Config] Turkce ses dosyalari kopyalanamadi: {e_snd}")

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

def _asterisk_pattern_to_regex(pat_raw: str) -> tuple[str, str]:
    """
    Converts an Asterisk dialplan pattern (e.g. '_998.', '998.', '998X.', '998', '0.')
    into a (regex_str, fixed_digit_prefix) tuple.
    """
    p = str(pat_raw or "").strip()
    if p.startswith("_"):
        p = p[1:].strip()
    if not p:
        return r"^\d+$", ""

    # Extract fixed leading digits before any wildcard (X, Z, N, ., !, [)
    m_pref = re.match(r"^(\d+)", p)
    fixed_prefix = m_pref.group(1) if m_pref else ""

    # If the pattern is purely digits (e.g. "998") and <= 6 digits, treat it as a prefix match "998."
    if p.isdigit() and len(p) <= 6:
        return f"^{re.escape(p)}\\d*$", p

    out = ["^"]
    i = 0
    n = len(p)
    while i < n:
        ch = p[i]
        if ch == "[":
            j = p.find("]", i + 1)
            if j != -1:
                out.append(p[i : j + 1])
                i = j + 1
                continue
        if ch in ("X", "x"):
            out.append(r"\d")
        elif ch in ("Z", "z"):
            out.append(r"[1-9]")
        elif ch in ("N", "n"):
            out.append(r"[2-9]")
        elif ch in (".", "!"):
            out.append(r"\d*")
        elif ch.isdigit() or ch == "+":
            out.append(re.escape(ch))
        else:
            out.append(re.escape(ch))
        i += 1
    out.append("$")
    return "".join(out), fixed_prefix


def _match_and_transform_outbound_number(callee_raw: str, caller_ext: str = "", users_list: list = None) -> dict:
    """
    Evaluates configured outbound_rules against callee_raw (e.g. '99805071796372' or '05071796372'):
    - Matches patterns (pattern, strip, prepend)
    - Strips rule access prefix (explicit strip count/prefix or smart prefix detection before 05.../02.../03.../04.../0850...)
    - Normalizes target number for SIP trunk ('905071796372') and ACL check ('05071796372')
    """
    raw = str(callee_raw or "").strip()
    clean_num = raw[1:] if raw.startswith("+") else raw
    outbound_rules = settings_db.get("outbound_rules", [])
    u_list = users_list if users_list is not None else settings_db.get("users", [])
    caller_str = str(caller_ext or "").strip()
    caller_user = next((u for u in u_list if str(u.get("extension") or "").strip() == caller_str), None)
    caller_uid = str(caller_user.get("id") or "") if caller_user else ""

    matched_rule = None
    matched_pat_obj = None
    matched_fixed_prefix = ""

    # Pass 1: Look for explicit pattern match in active outbound_rules
    for rule in outbound_rules:
        if rule.get("is_active", True) is False:
            continue
        allowed = [str(x).strip() for x in (rule.get("allowed_users") or []) if str(x).strip()]
        if allowed and caller_str:
            if caller_str not in allowed and (not caller_uid or caller_uid not in allowed):
                continue
        patterns = rule.get("patterns") or []
        for pat_obj in patterns:
            pat_str = str((pat_obj.get("pattern") if isinstance(pat_obj, dict) else pat_obj) or "").strip()
            if not pat_str:
                continue
            rx, fixed_pref = _asterisk_pattern_to_regex(pat_str)
            try:
                if re.match(rx, clean_num) or (raw != clean_num and re.match(rx, raw)):
                    matched_rule = rule
                    matched_pat_obj = pat_obj if isinstance(pat_obj, dict) else {"pattern": pat_str}
                    matched_fixed_prefix = fixed_pref
                    break
            except Exception:
                pass
        if matched_rule:
            break

    # Pass 2: If no pattern explicitly matched, pick first active rule allowed for caller
    if not matched_rule:
        for rule in outbound_rules:
            if rule.get("is_active", True) is False:
                continue
            allowed = [str(x).strip() for x in (rule.get("allowed_users") or []) if str(x).strip()]
            if allowed and caller_str:
                if caller_str not in allowed and (not caller_uid or caller_uid not in allowed):
                    continue
            matched_rule = rule
            break

    working = clean_num
    prepend_val = ""
    if matched_pat_obj:
        strip_raw = str(matched_pat_obj.get("strip") or "").strip()
        prepend_val = str(matched_pat_obj.get("prepend") or "").strip()
        stripped_done = False
        if strip_raw:
            if strip_raw.isdigit():
                s_cnt = int(strip_raw)
                if 0 < s_cnt < len(working):
                    working = working[s_cnt:]
                    stripped_done = True
            elif working.startswith(strip_raw) and len(working) > len(strip_raw):
                working = working[len(strip_raw):]
                stripped_done = True

        # Smart fallback: if pattern had a fixed prefix (e.g. '998' from '998.') and strip was left empty,
        # and removing that prefix leaves a valid 10-to-12 digit phone number (e.g. '05071796372')
        if not stripped_done and matched_fixed_prefix and working.startswith(matched_fixed_prefix):
            rem = working[len(matched_fixed_prefix):]
            if re.match(r"^(?:0?[2345]\d{9}|0?850\d{7}|0?800\d{7}|0?444\d{4}|90[23458]\d{9}|00\d{7,15})$", rem):
                working = rem
                stripped_done = True

    # Smart prefix strip even if no pattern specified strip: e.g. 1-4 digit prefix + '05071796372' (12-15 digits total)
    m_pref_tr = re.match(r"^(\d{1,4})(0(?:[2345]\d{9}|850\d{7}|800\d{7}|444\d{4}))$", working)
    if m_pref_tr and not working.startswith("00") and not working.startswith("90"):
        working = m_pref_tr.group(2)

    if prepend_val:
        working = prepend_val + working

    # acl_number: number format suitable for check_outbound_call (starts with 0 or 90 or 00)
    acl_number = working
    if re.match(r"^([2345]\d{9}|850\d{7}|800\d{7})$", acl_number):
        acl_number = "0" + acl_number

    # trunk_dial_number: format suitable for SIP trunk (905071796372 for Turkish numbers unless prepend explicitly set '0')
    trunk_dial_number = working
    if prepend_val != "0":
        if re.match(r"^0([2345]\d{9}|850\d{7}|800\d{7})$", trunk_dial_number):
            trunk_dial_number = "90" + trunk_dial_number[1:]
        elif re.match(r"^([2345]\d{9}|850\d{7}|800\d{7})$", trunk_dial_number):
            trunk_dial_number = "90" + trunk_dial_number

    return {
        "matched_rule": matched_rule,
        "matched_pattern": matched_pat_obj,
        "acl_number": acl_number,
        "trunk_dial_number": trunk_dial_number,
    }


@app.get("/api/trunks/resolve_outbound_dial", response_class=PlainTextResponse)
async def resolve_outbound_dial_endpoint(
    caller: str = "",
    caller_name: str = "",
    callee: str = "",
    dial_num: str = "",
    orig_caller: str = "",
    orig_name: str = "",
    db: AsyncSession = Depends(get_db)
):
    """
    Asterisk giden aramalarda (webrtc_agents _0. ve _[1-9]X. vb.) seçili Dış Hat (Trunk) üzerindeki:
    - Giden Arama Kuralları (outbound_rules: pattern, strip, prepend, trunk_ids/trunks, caller_id)
    - Çağrı Kısıtlama (call_limit_enabled, call_limit_direction, max_channels)
    - Giden SIP Başlıkları (From User, From Display Name, Diversion, Remote-Party-ID, P-Asserted-Identity, P-Preferred-Identity)
    - Diğer Ayarlar (Realm, Maxptime)
    değerlerini bire bir hesaplayarak Asterisk Dialplan'a pipe (|) ayracıyla döner.
    Format: ALLOW|TRUNK_SAFE_NAME|LIMIT_EN|MAX_CH|CID_NUM|CID_NAME|DIAL_STR|DIVERSION|RPID|PAI|PPI|MAXPTIME
    """
    try:
        trunks_list = []
        users_list = []
        try:
            res_t = await db.execute(select(Trunk).order_by(Trunk.id))
            for row in res_t.scalars().all():
                trunks_list.append({c.name: getattr(row, c.name) for c in row.__table__.columns})
            res_u = await db.execute(select(SystemUser))
            for row in res_u.scalars().all():
                users_list.append({c.name: getattr(row, c.name) for c in row.__table__.columns})
        except Exception:
            pass
        if not trunks_list:
            trunks_list = settings_db.get("trunks", [])
        if not users_list:
            users_list = settings_db.get("users", [])

        disk_trunks_map = {str(dt.get("trunk_name") or dt.get("id") or ""): dt for dt in settings_db.get("trunks", [])}
        for t in trunks_list:
            tk = str(t.get("trunk_name") or t.get("id") or "")
            dt = disk_trunks_map.get(tk)
            if dt:
                for extra_k in ("codecs", "call_limit_enabled", "call_limit_direction", "max_channels", "sip_headers"):
                    if t.get(extra_k) in (None, {}, []) and dt.get(extra_k) not in (None, {}, []):
                        t[extra_k] = dt.get(extra_k)

        # Match outbound rule & strip prefix (e.g. 99805071796372 -> 905071796372)
        transform_info = _match_and_transform_outbound_number(callee or dial_num, caller_ext=caller, users_list=users_list)
        matched_rule = transform_info.get("matched_rule")
        resolved_target_num = transform_info.get("trunk_dial_number") or dial_num or callee

        active_trunks = [t for t in trunks_list if t.get("is_active", True) is not False]
        if not active_trunks:
            return f"ALLOW|Operator_Trunk|0|30|908503607390|908503607390|PJSIP/Operator_Trunk/sip:{resolved_target_num}@ikonsip.com:5060|||||"

        selected_trunk = None
        if matched_rule:
            r_trunks = (
                matched_rule.get("trunk_ids")
                or matched_rule.get("trunks")
                or ([matched_rule.get("trunk_id")] if matched_rule.get("trunk_id") else [])
            )
            for t_ref in r_trunks:
                t_ref_str = str(t_ref).strip()
                cand = next(
                    (
                        t for t in active_trunks
                        if str(t.get("id")) == t_ref_str or str(t.get("trunk_name")) == t_ref_str
                    ),
                    None,
                )
                if cand:
                    selected_trunk = cand
                    break

        if not selected_trunk:
            selected_trunk = next((t for t in active_trunks if str(t.get("trunk_name")) == "908503607390"), active_trunks[0])

        raw_t_name = selected_trunk.get("trunk_name") or "Operator_Trunk"
        safe_t_name = _sanitize_trunk_name(raw_t_name)
        t_type = str(selected_trunk.get("trunk_type") or "register").lower()
        t_host = str(selected_trunk.get("host") or "").strip() or "ikonsip.com"
        t_port = int(selected_trunk.get("port") or 5060)
        t_user = str(selected_trunk.get("username") or "").strip()
        t_did = str(selected_trunk.get("did_number") or "").strip() or t_user or "908503607390"

        # Find calling user
        caller_clean = str(caller or "").strip()
        user_obj = next((u for u in users_list if str(u.get("extension") or "").strip() == caller_clean), None)
        ext_number = caller_clean or "1000"
        ext_name = (user_obj.get("full_name") or user_obj.get("username") or caller_name or ext_number) if user_obj else (caller_name or ext_number)
        ext_callerid = str((user_obj.get("outbound_caller_id") or user_obj.get("caller_id") or user_obj.get("did_number") or t_did) if user_obj else t_did).strip()
        rule_cid = str((matched_rule.get("caller_id") or matched_rule.get("outbound_caller_id") or t_did) if matched_rule else t_did).strip()
        orig_num = str(orig_caller or "").strip() or ext_number
        orig_nm = str(orig_name or "").strip() or ext_name

        sip_hdrs = _parse_trunk_sip_headers(selected_trunk)
        realm = str(sip_hdrs.get("realm") or "").strip()
        domain = realm or (t_host if t_host != "127.0.0.1" else "ikonsip.com")
        maxptime = str(sip_hdrs.get("maxptime") or "").strip()

        def _resolve_num_val(mode: str, custom_val: str, default_val: str) -> str:
            m = str(mode or "default").strip().lower()
            if m == "ext_number":
                return ext_number
            if m == "trunk_username":
                return t_user or t_did
            if m == "trunk_did":
                return t_did
            if m == "ext_callerid":
                return ext_callerid
            if m in ("outbound_rule_cid", "outbound_route_cid"):
                return rule_cid
            if m == "orig_caller":
                return orig_num
            if m == "custom":
                return str(custom_val or "").strip() or default_val
            return default_val

        # 1. Outbound From User (CID Number)
        out_from_user_mode = str(sip_hdrs.get("outbound_from_user") or "default").strip()
        out_from_user_custom = str(sip_hdrs.get("outbound_from_user_custom") or "").strip()
        default_cid_num = rule_cid if (matched_rule and (matched_rule.get("caller_id") or matched_rule.get("outbound_caller_id"))) else t_did
        cid_num = _resolve_num_val(out_from_user_mode, out_from_user_custom, default_cid_num)

        # 2. Outbound From Display Name (CID Name)
        out_from_name_mode = str(sip_hdrs.get("outbound_from_name") or "trunk_name").strip().lower()
        out_from_name_custom = str(sip_hdrs.get("outbound_from_name_custom") or "").strip()
        if out_from_name_mode == "ext_name":
            cid_name = ext_name
        elif out_from_name_mode == "trunk_name":
            cid_name = t_did or raw_t_name
        elif out_from_name_mode == "orig_caller_name":
            cid_name = orig_nm
        elif out_from_name_mode == "custom":
            cid_name = out_from_name_custom or cid_num
        else:
            cid_name = cid_num

        # 3. Diversion, Remote-Party-ID, P-Asserted-Identity, P-Preferred-Identity
        def _build_sip_uri_hdr(mode_key: str, custom_key: str, suffix: str = "") -> str:
            m = str(sip_hdrs.get(mode_key) or "none").strip().lower()
            if not m or m == "none":
                return ""
            val = _resolve_num_val(m, str(sip_hdrs.get(custom_key) or ""), t_did)
            if not val:
                return ""
            return f"<sip:{val}@{domain}>{suffix}"

        div_hdr = _build_sip_uri_hdr("outbound_diversion", "outbound_diversion_custom", ";reason=unconditional")
        rpid_hdr = _build_sip_uri_hdr("outbound_rpid", "outbound_rpid_custom", ";party=calling;privacy=off;screen=no")
        pai_hdr = _build_sip_uri_hdr("outbound_pai", "outbound_pai_custom", "")
        ppi_hdr = _build_sip_uri_hdr("outbound_ppi", "outbound_ppi_custom", "")

        # 4. Call Limit Check (Outbound / Both)
        limit_enabled = bool(selected_trunk.get("call_limit_enabled", False))
        limit_dir = str(selected_trunk.get("call_limit_direction") or "both").strip().lower()
        limit_en_flag = "1" if (limit_enabled and limit_dir in ("both", "outbound")) else "0"
        try:
            max_ch = max(1, int(selected_trunk.get("max_channels") or 30))
        except Exception:
            max_ch = 30

        # 5. Dial Target String
        target_num = resolved_target_num
        if t_type == "account":
            dial_str = f"PJSIP/{target_num}@{safe_t_name}"
        elif raw_t_name == "908503607390" or safe_t_name == "Operator_Trunk":
            dial_str = f"PJSIP/Operator_Trunk/sip:{target_num}@{t_host}:{t_port}"
        else:
            dial_str = f"PJSIP/{safe_t_name}/sip:{target_num}@{t_host}:{t_port}"

        # Clean pipe characters to prevent CUT misalignment
        parts = [
            "ALLOW",
            safe_t_name.replace("|", ""),
            limit_en_flag,
            str(max_ch),
            cid_num.replace("|", ""),
            cid_name.replace("|", ""),
            dial_str.replace("|", ""),
            div_hdr.replace("|", ""),
            rpid_hdr.replace("|", ""),
            pai_hdr.replace("|", ""),
            ppi_hdr.replace("|", ""),
            maxptime.replace("|", ""),
        ]
        return "|".join(parts)
    except Exception as e:
        print(f"[Resolve Outbound Dial Warning]: {e}")
        return f"ALLOW|Operator_Trunk|0|30|908503607390|908503607390|PJSIP/Operator_Trunk/sip:{dial_num or callee}@ikonsip.com:5060|||||"


@app.get("/api/settings/trunks/status")
async def get_trunks_status(db: AsyncSession = Depends(get_db)):
    status_dict = {}
    trunks_list = []
    try:
        res = await db.execute(select(Trunk).order_by(Trunk.id))
        for row in res.scalars().all():
            trunks_list.append({c.name: getattr(row, c.name) for c in row.__table__.columns})
    except Exception:
        pass
    if not trunks_list:
        trunks_list = settings_db.get("trunks", [])

    for t in trunks_list:
        trunk_id = t.get("id")
        if t.get("is_active", True) is False:
            status_dict[trunk_id] = "inactive"
            continue
        t_type = str(t.get("trunk_type") or "register").lower()
        if t_type == "account":
            status_dict[trunk_id] = "active"
            continue
        host = str(t.get("host") or "").strip()
        if not host:
            status_dict[trunk_id] = "inactive"
            continue
        try:
            socket.gethostbyname(host)
            if host == "sip.operator.com":
                status_dict[trunk_id] = "trying"
            else:
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

        try:
            from backend.services.agent_presence import handle_agent_reconnect_auto_pause
            asyncio.create_task(handle_agent_reconnect_auto_pause(ext))
        except Exception:
            pass

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

        update_agent_state(is_logged_in=False, status="offline", current_break=None, user_id=matched_user_id, extension=ext)

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
async def get_agent_status_endpoint(
    user_id: Optional[str] = None,
    extension: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    from backend.services.agent_presence import get_agent_state, update_agent_state, is_auto_break_name, AUTO_BREAK_DEFAULT_COLOR
    from backend.database.models import AgentBreakLog
    from sqlalchemy import select, or_

    uid_str = str(user_id).strip() if user_id and str(user_id).strip() not in ("undefined", "null", "") else None
    ext_str = str(extension).strip() if extension and str(extension).strip() not in ("undefined", "null", "") else None

    if not uid_str and not ext_str:
        return get_agent_state()

    now_utc = datetime.datetime.utcnow()
    now_tr = now_utc + datetime.timedelta(hours=3)
    today_start_utc = (now_tr.replace(hour=0, minute=0, second=0, microsecond=0)) - datetime.timedelta(hours=3)

    target_vals = {v for v in (uid_str, ext_str) if v}
    settings = load_settings()
    for u in settings.get("users", []):
        u_id = str(u.get("id", "")).strip()
        u_ext = str(u.get("extension", "")).strip()
        if u_id in target_vals or u_ext in target_vals:
            if u_id:
                target_vals.add(u_id)
                if not uid_str:
                    uid_str = u_id
            if u_ext:
                target_vals.add(u_ext)
                if not ext_str:
                    ext_str = u_ext

    mem_state = get_agent_state(user_id=uid_str, extension=ext_str)
    if mem_state and mem_state.get("status_since_utc") and not mem_state.get("is_logged_in"):
        return mem_state

    try:
        conds = []
        for tv in target_vals:
            conds.append(AgentBreakLog.user_id == tv)
            conds.append(AgentBreakLog.extension == tv)
        all_today_logs = []
        if conds:
            stmt_today_logs = select(AgentBreakLog).where(
                AgentBreakLog.start_time >= today_start_utc,
                or_(*conds)
            ).order_by(AgentBreakLog.start_time.desc(), AgentBreakLog.id.desc())
            res_today_logs = await db.execute(stmt_today_logs)
            all_today_logs = res_today_logs.scalars().all()

            if all_today_logs and str(all_today_logs[0].break_name or "") == "__LOGOUT__":
                st_out = update_agent_state(
                    is_logged_in=False,
                    status="offline",
                    current_break=None,
                    user_id=uid_str,
                    extension=ext_str
                )
                return st_out

            active_brk = next(
                (b for b in all_today_logs if b.end_time is None and not str(b.break_name or "").startswith("__")),
                None
            )
            if active_brk:
                is_auto = is_auto_break_name(active_brk.break_name)
                brk_color = AUTO_BREAK_DEFAULT_COLOR if is_auto else "#eab308"
                brk_id = "auto_pause" if is_auto else None
                brk_max_min = 0
                brk_quota_min = 0
                for b_cfg in settings.get("breaks", []):
                    if str(b_cfg.get("name", "")).strip().lower() == str(active_brk.break_name or "").strip().lower():
                        brk_color = b_cfg.get("color") or brk_color
                        brk_id = b_cfg.get("id")
                        brk_max_min = int(b_cfg.get("max_duration_minutes") or 0)
                        brk_quota_min = int(b_cfg.get("daily_quota_minutes") or 0)
                        break
                brk_start_dt = active_brk.start_time.replace(tzinfo=None)
                brk_start_iso = brk_start_dt.isoformat() + "Z"
                elapsed_sec = max(0, int((now_utc - brk_start_dt).total_seconds()))
                brk_obj = {
                    "id": brk_id,
                    "name": active_brk.break_name or "Mola",
                    "color": brk_color,
                    "is_auto_break": is_auto,
                    "max_duration_minutes": brk_max_min,
                    "daily_quota_minutes": brk_quota_min,
                    "start_time_utc": brk_start_iso,
                    "elapsed_seconds": elapsed_sec
                }
                st = update_agent_state(
                    is_logged_in=True,
                    status="break",
                    current_break=brk_obj,
                    user_id=uid_str,
                    extension=ext_str,
                    status_since_utc=brk_start_iso
                )
                return {**st, "elapsed_seconds": elapsed_sec, "break_start_utc": brk_start_iso}
    except Exception as e_st:
        print(f"[Get Agent Status DB Check Error]: {e_st}")
        all_today_logs = []

    if mem_state and mem_state.get("status_since_utc"):
        elapsed_online = 0
        try:
            dt_m = datetime.datetime.fromisoformat(str(mem_state["status_since_utc"]).replace("Z", ""))
            elapsed_online = max(0, int((now_utc - dt_m).total_seconds()))
        except Exception:
            elapsed_online = 0
        return {**mem_state, "elapsed_seconds": elapsed_online}

    # Restore online state after backend restart only if the agent had logged in today and not logged out
    if all_today_logs and str(all_today_logs[0].break_name or "") != "__LOGOUT__":
        last_dt = (all_today_logs[0].end_time or all_today_logs[0].start_time).replace(tzinfo=None)
        last_iso = last_dt.isoformat() + "Z"
        elapsed_online = max(0, int((now_utc - last_dt).total_seconds()))
        auto_state = update_agent_state(
            is_logged_in=True,
            status="online",
            current_break=None,
            user_id=uid_str,
            extension=ext_str,
            status_since_utc=last_iso
        )
        return {**auto_state, "elapsed_seconds": elapsed_online}

    return get_agent_state(user_id=uid_str, extension=ext_str)

@app.post("/api/agent/status")
@app.post("/agent/status")
async def update_agent_status_endpoint(payload: AgentStateSchema, db: AsyncSession = Depends(get_db)):
    from backend.services.agent_presence import update_agent_state, active_agent_status, reset_agent_missed_calls, sync_asterisk_queue_pause
    from backend.database.models import AgentBreakLog, PBXQueue
    from sqlalchemy import select, or_

    user_id_str = str(payload.user_id).strip() if payload.user_id is not None and str(payload.user_id).strip() != "" else None
    ext_str = str(payload.extension).strip() if getattr(payload, "extension", None) and str(payload.extension).strip() != "" else None

    settings = load_settings()
    if user_id_str or ext_str:
        for u in settings.get("users", []):
            u_id = str(u.get("id", "")).strip()
            u_ext = str(u.get("extension", "")).strip()
            if (user_id_str and (u_id == user_id_str or u_ext == user_id_str)) or (ext_str and u_ext == ext_str):
                if u_ext and not ext_str:
                    ext_str = u_ext
                if u_id and (not user_id_str or user_id_str == u_ext):
                    user_id_str = u_id
                break

        if not ext_str or not user_id_str:
            try:
                stmt_u = select(SystemUser)
                res_u = await db.execute(stmt_u)
                for su in res_u.scalars().all():
                    su_id = str(su.id)
                    su_ext = str(su.extension or "").strip()
                    if (user_id_str and (su_id == user_id_str or su_ext == user_id_str)) or (ext_str and su_ext == ext_str):
                        if su_ext and not ext_str:
                            ext_str = su_ext
                        if su_id and (not user_id_str or user_id_str == su_ext):
                            user_id_str = su_id
                        break
            except Exception:
                pass

    if not ext_str and user_id_str and user_id_str.isdigit() and len(user_id_str) <= 5:
        ext_str = user_id_str

    now_utc = datetime.datetime.utcnow()
    now_tr = now_utc + datetime.timedelta(hours=3)
    today_start_utc = (now_tr.replace(hour=0, minute=0, second=0, microsecond=0)) - datetime.timedelta(hours=3)

    brk_payload = payload.current_break
    if payload.status == "break" and isinstance(brk_payload, dict):
        brk_name = str(brk_payload.get("name") or "Mola").strip()
        brk_max_min = int(brk_payload.get("max_duration_minutes") or 0)
        brk_quota_min = int(brk_payload.get("daily_quota_minutes") or 0)
        for b_cfg in settings.get("breaks", []):
            if str(b_cfg.get("name", "")).strip().lower() == brk_name.lower() or (brk_payload.get("id") and b_cfg.get("id") == brk_payload.get("id")):
                if not brk_max_min:
                    brk_max_min = int(b_cfg.get("max_duration_minutes") or 0)
                if not brk_quota_min:
                    brk_quota_min = int(b_cfg.get("daily_quota_minutes") or 0)
                break

        # Enforce Break Quota & Queue Concurrent Break Limit (unless triggered by Supervisor)
        if not getattr(payload, "by_supervisor", False):
            # 1. Check Daily Break Quota for this agent
            if brk_quota_min > 0 and (user_id_str or ext_str):
                q_conds = []
                if user_id_str:
                    q_conds.append(AgentBreakLog.user_id == user_id_str)
                if ext_str:
                    q_conds.append(AgentBreakLog.extension == ext_str)
                stmt_quota = select(AgentBreakLog).where(
                    AgentBreakLog.start_time >= today_start_utc,
                    AgentBreakLog.break_name == brk_name,
                    or_(*q_conds)
                )
                res_quota = await db.execute(stmt_quota)
                quota_logs = res_quota.scalars().all()
                used_sec = 0
                for ql in quota_logs:
                    if ql.end_time:
                        used_sec += int(ql.duration_seconds or max(0, (ql.end_time - ql.start_time).total_seconds()))
                    else:
                        used_sec += max(0, int((now_utc - ql.start_time.replace(tzinfo=None)).total_seconds()))
                if used_sec >= brk_quota_min * 60:
                    used_min = round(used_sec / 60, 1)
                    raise HTTPException(
                        status_code=400,
                        detail=f"'{brk_name}' için günlük mola kotanız ({brk_quota_min} dk) dolmuştur (Bugün kullanılan: {used_min} dk)."
                    )

            # 2. Check Queue Max Concurrent Breaks
            try:
                res_q = await db.execute(select(PBXQueue))
                db_queues = res_q.scalars().all()
                queues_list = [{c.name: getattr(q, c.name) for c in q.__table__.columns} for q in db_queues]
            except Exception:
                queues_list = settings.get("queues", [])

            if not queues_list:
                queues_list = settings.get("queues", [])

            stmt_all_active_brk = select(AgentBreakLog).where(
                AgentBreakLog.start_time >= today_start_utc,
                AgentBreakLog.end_time.is_(None)
            )
            res_all_active = await db.execute(stmt_all_active_brk)
            active_brk_rows = [
                r for r in res_all_active.scalars().all()
                if not str(r.break_name or "").startswith("__")
            ]

            for q in queues_list:
                max_conc = int(q.get("max_concurrent_breaks") or 0)
                if max_conc <= 0:
                    continue
                members = q.get("queueMembers") or q.get("members") or []
                member_exts = set()
                for m in members:
                    if isinstance(m, dict):
                        m_ext = str(m.get("extension") or m.get("id") or "").strip()
                    else:
                        m_ext = str(m).strip()
                    if m_ext:
                        member_exts.add(m_ext)

                my_keys = {k for k in (ext_str, user_id_str) if k}
                if not (my_keys & member_exts):
                    continue

                # Count other members of this queue currently on break
                other_on_break = set()
                for m_ext in member_exts:
                    if m_ext in my_keys:
                        continue
                    st_mem = active_agent_status.get(m_ext)
                    if st_mem and st_mem.get("is_logged_in") and st_mem.get("status") == "break":
                        other_on_break.add(m_ext)
                        continue
                    for r in active_brk_rows:
                        if str(r.extension or "").strip() == m_ext or str(r.user_id or "").strip() == m_ext:
                            other_on_break.add(m_ext)
                            break

                if len(other_on_break) >= max_conc:
                    q_title = q.get("name") or q.get("extension") or "Kuyruk"
                    raise HTTPException(
                        status_code=400,
                        detail=f"'{q_title}' kuyruğunda aynı anda en fazla {max_conc} temsilci molaya çıkabilir. Şu an mola kontenjanı dolu."
                    )

        brk_payload = {
            **brk_payload,
            "max_duration_minutes": brk_max_min,
            "daily_quota_minutes": brk_quota_min,
            "start_time_utc": now_utc.isoformat() + "Z",
            "elapsed_seconds": 0
        }

    new_state = update_agent_state(
        is_logged_in=payload.is_logged_in,
        status=payload.status,
        current_break=brk_payload,
        user_id=user_id_str or payload.user_id,
        extension=ext_str
    )

    if ext_str:
        if payload.status == "online" and payload.is_logged_in:
            reset_agent_missed_calls(ext_str)
            asyncio.create_task(sync_asterisk_queue_pause(ext_str, False, reason="AgentAvailable"))
        elif payload.status == "break":
            b_reason = str((brk_payload or {}).get("name") or "Break")
            asyncio.create_task(sync_asterisk_queue_pause(ext_str, True, reason=b_reason))

    try:
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
        elif (payload.status == "offline" or not payload.is_logged_in) and (user_id_str or ext_str):
            db.add(AgentBreakLog(
                user_id=user_id_str,
                extension=ext_str,
                break_name="__LOGOUT__",
                start_time=now_utc,
                end_time=now_utc,
                duration_seconds=0
            ))
        elif payload.status == "online" and payload.is_logged_in and not ended_any_break and conditions:
            stmt_latest = select(AgentBreakLog).where(
                or_(*conditions)
            ).order_by(AgentBreakLog.start_time.desc(), AgentBreakLog.id.desc()).limit(1)
            res_latest = await db.execute(stmt_latest)
            latest_log = res_latest.scalars().first()
            if not latest_log or str(latest_log.break_name or "") != "__LOGIN__":
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



class AgentAssistRequestSchema(BaseModel):
    query: Optional[str] = ""
    call_id: Optional[str] = None


@app.post("/api/agent/assist")
async def real_time_agent_assist_endpoint(
    payload: AgentAssistRequestSchema,
    user_info: dict = Depends(get_user_info),
    db: AsyncSession = Depends(get_db)
):
    from backend.database.models import DocumentChunk, Rule, CannedResponse, Transcript
    from sqlalchemy import select, or_

    target_tenant = user_info.get("tenant_id") or "tenant-default"
    query_str = (payload.query or "").strip()

    # If no explicit query is passed, pull the latest customer transcript utterances from the active call
    if not query_str and payload.call_id:
        try:
            stmt_tr = select(Transcript).where(
                Transcript.call_id == payload.call_id,
                Transcript.speaker == "customer"
            ).order_by(Transcript.timestamp.desc()).limit(2)
            res_tr = await db.execute(stmt_tr)
            tr_rows = res_tr.scalars().all()
            if tr_rows:
                query_str = " ".join([r.text for r in reversed(tr_rows) if r.text]).strip()
        except Exception:
            pass

    keywords = [
        w.lower() for w in query_str.replace("?", " ").replace(".", " ").replace(",", " ").split()
        if len(w.strip()) >= 3
    ]

    suggestions = []
    try:
        # 1. Search FAQ Rules
        if target_tenant in ["all", "global", "tenant-default", "default"]:
            stmt_rules = select(Rule).where(Rule.is_active == True)
        else:
            stmt_rules = select(Rule).where(Rule.is_active == True, Rule.tenant_id == target_tenant)
        res_rules = await db.execute(stmt_rules)
        all_rules = res_rules.scalars().all()
        for r in all_rules:
            trig = (r.trigger_keyword or "").strip()
            resp = (r.response_text or "").strip()
            if not resp:
                continue
            score = 0
            combined = f"{trig} {resp}".lower()
            if keywords:
                for kw in keywords:
                    if kw in combined:
                        score += 3 if kw in trig.lower() else 1
            else:
                score = 1
            if score > 0:
                suggestions.append({
                    "id": f"rule-{r.id}",
                    "source": trig or "SSS Kuralı",
                    "type": "faq",
                    "content": resp,
                    "score": score
                })

        # 2. Search RAG Knowledge Base Chunks
        if target_tenant in ["all", "global", "tenant-default", "default"]:
            stmt_chunks = select(DocumentChunk).limit(80)
        else:
            stmt_chunks = select(DocumentChunk).where(DocumentChunk.tenant_id == target_tenant).limit(80)
        res_chunks = await db.execute(stmt_chunks)
        all_chunks = res_chunks.scalars().all()
        for ch in all_chunks:
            txt = (ch.content or "").strip()
            if not txt:
                continue
            score = 0
            txt_lower = txt.lower()
            if keywords:
                for kw in keywords:
                    if kw in txt_lower:
                        score += 2
            else:
                score = 1
            if score > 0:
                snippet = txt[:320] + ("..." if len(txt) > 320 else "")
                suggestions.append({
                    "id": f"kb-{ch.id}",
                    "source": ch.filename or "Bilgi Bankası",
                    "type": "kb",
                    "content": snippet,
                    "score": score
                })

        # 3. Search Canned Responses (Hazır Yanıtlar)
        stmt_canned = select(CannedResponse).limit(30)
        res_canned = await db.execute(stmt_canned)
        for cr in res_canned.scalars().all():
            title_s = (cr.title or "").strip()
            content_s = (cr.content or "").strip()
            if not content_s:
                continue
            score = 0
            comb_c = f"{title_s} {cr.shortcut or ''} {content_s}".lower()
            if keywords:
                for kw in keywords:
                    if kw in comb_c:
                        score += 2
            else:
                score = 1
            if score > 0:
                suggestions.append({
                    "id": f"canned-{cr.id}",
                    "source": f"/{cr.shortcut} — {title_s}" if cr.shortcut else title_s,
                    "type": "canned",
                    "content": content_s,
                    "score": score
                })
    except Exception as e_assist:
        print(f"[Agent Assist Error]: {e_assist}")

    suggestions.sort(key=lambda x: x.get("score", 0), reverse=True)
    return {
        "status": "success",
        "query_used": query_str,
        "suggestions": suggestions[:6]
    }


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
    default_plan = DEFAULT_SETTINGS["pbx"]["numbering_plan"]
    saved_plan = pbx_settings.get("numbering_plan") or {}
    merged = dict(default_plan)
    for k, v in saved_plan.items():
        if v is not None:
            merged[k] = v
    if not isinstance(merged.get("call_pickup"), dict):
        merged["call_pickup"] = dict(default_plan["call_pickup"])
    if not isinstance(merged.get("call_forwarding"), dict):
        merged["call_forwarding"] = dict(default_plan["call_forwarding"])
    else:
        for fk, fv in default_plan["call_forwarding"].items():
            if not merged["call_forwarding"].get(fk):
                merged["call_forwarding"][fk] = fv
    if not isinstance(merged.get("call_monitoring"), dict):
        merged["call_monitoring"] = dict(default_plan["call_monitoring"])
    else:
        for mk, mv in default_plan["call_monitoring"].items():
            if not merged["call_monitoring"].get(mk):
                merged["call_monitoring"][mk] = mv
    return merged

@app.post("/api/settings/numbering-plan")
async def save_numbering_plan(payload: NumberingPlanSchema, background_tasks: BackgroundTasks):
    if "pbx" not in settings_db:
        settings_db["pbx"] = {}
    settings_db["pbx"]["numbering_plan"] = payload.model_dump()
    save_settings(settings_db)
    try:
        regenerate_extensions_custom_conf(background_tasks)
    except Exception as e_ext:
        print(f"[Numbering Plan] Dialplan reload warning: {e_ext}")
    add_system_log("PBX", "INFO", "Numara planı ve çağrı yönlendirme prefix kodları güncellendi.")
    return {"status": "success", "message": "Numara planı ve yönlendirme kodları başarıyla kaydedildi."}

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
    two_factor_method: Optional[str] = None
    two_factor_secret: Optional[str] = None
    two_factor_enrolled: Optional[bool] = None
    password_expiry_enabled: Optional[bool] = None
    password_expiry_months: Optional[int] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    call_panel_prefs: Optional[dict] = None

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

    if payload.call_panel_prefs is not None:
        user["call_panel_prefs"] = payload.call_panel_prefs

    if payload.auto_logout_enabled is not None:
        user["auto_logout_enabled"] = payload.auto_logout_enabled
    if payload.auto_logout_duration is not None:
        user["auto_logout_duration"] = payload.auto_logout_duration
    if payload.two_factor_enabled is not None:
        user["two_factor_enabled"] = payload.two_factor_enabled
    if payload.two_factor_method is not None:
        user["two_factor_method"] = payload.two_factor_method
    if payload.two_factor_secret is not None:
        user["two_factor_secret"] = payload.two_factor_secret
    if payload.two_factor_enrolled is not None:
        user["two_factor_enrolled"] = payload.two_factor_enrolled

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
                if payload.two_factor_enabled is not None:
                    db_u.two_factor_enabled = bool(user.get("two_factor_enabled", False))
                if payload.two_factor_method is not None:
                    db_u.two_factor_method = user.get("two_factor_method", "google_auth")
                if payload.two_factor_secret is not None:
                    db_u.two_factor_secret = user.get("two_factor_secret")
                if payload.two_factor_enrolled is not None:
                    db_u.two_factor_enrolled = bool(user.get("two_factor_enrolled", False))
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

def _convert_and_sync_announcement_wav(src_filepath: str, ann_id: str) -> str:
    """Converts an uploaded or TTS announcement audio file into 8000Hz mono 16-bit PCM WAV for Asterisk and syncs to monitor directories."""
    import os
    import shutil
    import subprocess

    os.makedirs("uploads/announcements", exist_ok=True)
    wav_filename = f"{ann_id}.wav"
    wav_filepath = os.path.join("uploads/announcements", wav_filename)
    tmp_wav = os.path.join("uploads/announcements", f"{ann_id}_tmp8k.wav")

    converted = False
    for cmd in [
        ["ffmpeg", "-y", "-i", src_filepath, "-ar", "8000", "-ac", "1", "-c:a", "pcm_s16le", tmp_wav],
        ["sox", src_filepath, "-r", "8000", "-c", "1", "-b", "16", tmp_wav],
    ]:
        try:
            res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=4.0)
            if res.returncode == 0 and os.path.exists(tmp_wav) and os.path.getsize(tmp_wav) > 44:
                shutil.move(tmp_wav, wav_filepath)
                converted = True
                break
        except Exception:
            pass
    if os.path.exists(tmp_wav):
        try:
            os.remove(tmp_wav)
        except Exception:
            pass

    if not converted and src_filepath != wav_filepath and os.path.exists(src_filepath):
        try:
            shutil.copy2(src_filepath, wav_filepath)
        except Exception:
            pass

    if os.path.exists(wav_filepath):
        target_dirs = [os.path.join(ASTERISK_CONFIG_DIR, "sounds_tr"), "recordings"]
        if os.path.exists("/var/spool/asterisk") or os.path.exists("/etc/asterisk"):
            target_dirs.append("/var/spool/asterisk/monitor")
        for d in target_dirs:
            try:
                os.makedirs(d, exist_ok=True)
                dst = os.path.join(d, wav_filename)
                shutil.copy2(wav_filepath, dst)
                os.chmod(dst, 0o644)
            except Exception as e_sync:
                print(f"[Announcement WAV Sync Warning] ({d}): {e_sync}")
    return wav_filepath


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
    filename = f"{ann_id}{ext}" if file else f"{ann_id}.wav"
    filepath = os.path.join("uploads/announcements", filename)
    
    if file:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        _convert_and_sync_announcement_wav(filepath, ann_id)
            
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
    text = str(payload.get("text") or "").strip()
    name = (payload.get("name") or "TTS Anons").strip()
    ann_type = payload.get("type") if payload.get("type") in ["announcement", "moh"] else "announcement"
    voice = payload.get("voice") or "tr-TR-EmelNeural"
    existing_id = str(payload.get("id") or payload.get("announcement_id") or "").strip()
    
    if not text:
        raise HTTPException(status_code=400, detail="Metin boş olamaz.")
        
    os.makedirs("uploads/announcements", exist_ok=True)
    if "announcements" not in settings_db:
        settings_db["announcements"] = []

    existing_ann = None
    if existing_id:
        existing_ann = next((a for a in settings_db["announcements"] if str(a.get("id")) == existing_id), None)

    ann_id = existing_ann["id"] if existing_ann else str(uuid.uuid4())
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

    _convert_and_sync_announcement_wav(filepath, ann_id)
            
    now_ts = datetime.datetime.now().timestamp()
    if existing_ann:
        existing_ann["name"] = name
        existing_ann["filename"] = filename
        existing_ann["original_filename"] = orig_fname
        existing_ann["type"] = ann_type
        existing_ann["text"] = text
        existing_ann["voice"] = voice
        existing_ann["updated_at"] = now_ts
        ann = existing_ann
    else:
        ann = {
            "id": ann_id,
            "name": name,
            "filename": filename,
            "original_filename": orig_fname,
            "type": ann_type,
            "tenant_id": target_tenant,
            "text": text,
            "voice": voice,
            "created_at": now_ts,
            "updated_at": now_ts
        }
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

def _expand_subscriber_groups_in_allowed_users(allowed_list: list) -> list:
    if not isinstance(allowed_list, list):
        return []
    result = list(allowed_list)
    all_groups = settings_db.get("subscriber_groups", [])
    all_users = settings_db.get("users", [])
    for item in list(allowed_list):
        s_item = str(item or "")
        if s_item.startswith("group_"):
            gid = s_item.replace("group_", "", 1)
            grp = next((g for g in all_groups if str(g.get("id")) == gid), None)
            if grp:
                for ext_or_id in (grp.get("extensions") or grp.get("members") or []):
                    matched_user = next(
                        (u for u in all_users if str(u.get("id")) == str(ext_or_id) or str(u.get("extension")) == str(ext_or_id)),
                        None
                    )
                    uid_to_add = matched_user.get("id") if matched_user else ext_or_id
                    if uid_to_add is not None and not any(str(x) == str(uid_to_add) for x in result):
                        result.append(uid_to_add)
    return result

@app.post("/api/settings/outbound_rules")
async def save_outbound_rule(request: Request, user_info: dict = Depends(get_user_info)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    payload = await request.json()
    payload["tenant_id"] = target_tenant
    if "allowed_users" in payload:
        payload["allowed_users"] = _expand_subscriber_groups_in_allowed_users(payload.get("allowed_users", []))
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
    try:
        regenerate_extensions_custom_conf()
    except Exception:
        pass
    return {"status": "success", "outbound_rules": settings_db["outbound_rules"]}

@app.delete("/api/settings/outbound_rules/{rule_id}")
async def delete_outbound_rule(rule_id: str):
    if "outbound_rules" not in settings_db:
        return {"status": "error", "message": "Kayıt bulunamadı."}
        
    settings_db["outbound_rules"] = [r for r in settings_db["outbound_rules"] if r.get("id") != rule_id]
    save_settings(settings_db)
    try:
        regenerate_extensions_custom_conf()
    except Exception:
        pass
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
    if "allowed_users" in payload:
        payload["allowed_users"] = _expand_subscriber_groups_in_allowed_users(payload.get("allowed_users", []))
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
    if "extensions" in data:
        data["extensions"] = _expand_subscriber_groups_in_allowed_users(data.get("extensions", []))
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
    caller_str = str(caller or "").strip()
    callee_str = str(callee or "").strip()
    is_bl_caller, _ = await is_phone_or_value_blacklisted(caller_str)
    is_bl_callee, _ = await is_phone_or_value_blacklisted(callee_str)
    if is_bl_caller or is_bl_callee:
        print(f"[Abuse Shield] Internal subscriber call blocked via Blacklist: {caller_str} -> {callee_str}")
        return Response(content="DENY", media_type="text/plain")

    groups = settings_db.get("subscriber_groups", [])
    users_list = settings_db.get("users", [])
    uid_to_ext = {}
    for u in users_list:
        uid = str(u.get("id") or "").strip()
        uext = str(u.get("extension") or "").strip()
        if uid and uext:
            uid_to_ext[uid] = uext

    caller_groups = []
    callee_groups = []

    for g in groups:
        raw_exts = g.get("extensions", []) or []
        resolved_exts = set()
        for item in raw_exts:
            s_item = str(item).strip()
            resolved_exts.add(s_item)
            if s_item in uid_to_ext:
                resolved_exts.add(uid_to_ext[s_item])
        if caller_str in resolved_exts:
            caller_groups.append(g)
        if callee_str in resolved_exts:
            callee_groups.append(g)

    if not caller_groups or not callee_groups:
        return Response(content="ALLOW", media_type="text/plain")

    caller_gids = set(str(g.get("id")) for g in caller_groups)
    callee_gids = set(str(g.get("id")) for g in callee_groups)

    if caller_gids.intersection(callee_gids):
        return Response(content="ALLOW", media_type="text/plain")

    has_any_acl_restriction = False
    for g in caller_groups:
        outbound = [str(x) for x in (g.get("allowed_outbound_groups") or []) if str(x).strip()]
        if outbound:
            has_any_acl_restriction = True
            if set(outbound).intersection(callee_gids):
                return Response(content="ALLOW", media_type="text/plain")

    for g in callee_groups:
        inbound = [str(x) for x in (g.get("allowed_inbound_groups") or []) if str(x).strip()]
        if inbound:
            has_any_acl_restriction = True
            if set(inbound).intersection(caller_gids):
                return Response(content="ALLOW", media_type="text/plain")

    if not has_any_acl_restriction:
        return Response(content="ALLOW", media_type="text/plain")

    return Response(content="DENY", media_type="text/plain")


@app.get("/api/acl/check_outbound_call")
async def check_outbound_call(caller: str = "", callee: str = "", channel: str = "", via: str = ""):
    from fastapi import Response
    caller_str = str(caller or "").strip()
    callee_str = str(callee or "").strip()
    via_upper = str(via or "").upper()

    # 0. Giden Arama Kuralı (Outbound Rule) prefix çözümlemesi (ör: 99805071796372 -> 05071796372)
    transform_info = _match_and_transform_outbound_number(callee_str, caller_ext=caller_str)
    acl_callee_str = transform_info.get("acl_number") or callee_str

    # 0.1 Kara Liste (Blacklist) kontrolü
    is_bl_caller, bl_reason_c = await is_phone_or_value_blacklisted(caller_str)
    is_bl_callee, bl_reason_d = await is_phone_or_value_blacklisted(acl_callee_str)
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
    is_blocked, reason = is_suspicious_or_fraud_outbound_number(acl_callee_str, allow_international=allow_international)
    if is_blocked:
        print(f"[SIP Security Shield] Dış arama engellendi! Arayan={caller_str}, Aranan={callee_str} (ACL={acl_callee_str}), Sebep={reason}, Via={via}")
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
                if bool(user_dict.get("voicemail_active", False)) or (active_prof_id != "available" and raw_prof_target):
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

        # Trigger per-queue Auto-Pause evaluation if agent did not answer or rejected the call on Step 1
        if int(step) == 1 and dialstatus in ["NOANSWER", "BUSY"]:
            try:
                from backend.services.agent_presence import handle_agent_missed_call_for_auto_pause
                asyncio.create_task(handle_agent_missed_call_for_auto_pause(ext_str))
            except Exception as e_ap:
                print(f"[Forwarding Resolver AutoPause Trigger Warning]: {e_ap}")

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

        # Rule 1.9: Check if agent is currently on Break (Manual or Auto-Pause) during BEFORE_DIAL
        if dialstatus == "BEFORE_DIAL":
            try:
                from backend.services.agent_presence import get_agent_state
                ag_st = get_agent_state(user_id=str(user_dict.get("id") or ""), extension=ext_str)
                if ag_st and ag_st.get("is_logged_in") and ag_st.get("status") == "break":
                    brk_target = f_busy or prof_target or (gsm_num if mobile_enabled and gsm_num else "HANGUP")
                    print(f"[Forwarding Resolver] Extension {ext_str} is on BREAK -> Action: {brk_target}")
                    return Response(content=f"ALLOW:{brk_target}:{no_ans_timeout}", media_type="text/plain")
            except Exception:
                pass

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


class CancelForwardingSchema(BaseModel):
    extension: str
    rule_type: Optional[str] = "all"  # "all", "always", "busy", "no_answer"


async def _sync_user_forwarding_state(
    ext_str: str,
    updates: Dict[str, Any],
    db: AsyncSession,
    source_label: str = "Masa Telefonu"
) -> bool:
    """
    Updates forwarding_always, forwarding_busy, forwarding_no_answer in BOTH
    PostgreSQL (SystemUser) and settings_db['users'] (settings.json) so Desk Phone
    feature codes and Web UI are 100% identical and bidirectional.
    """
    from sqlalchemy.orm.attributes import flag_modified
    ext_clean = str(ext_str or "").strip()
    if not ext_clean:
        return False

    found_any = False

    # 1. Update in PostgreSQL SystemUser
    try:
        stmt = select(SystemUser).where(SystemUser.extension == ext_clean)
        res = await db.execute(stmt)
        db_user = res.scalars().first()
        if db_user:
            for col_key, col_val in updates.items():
                if hasattr(db_user, col_key):
                    setattr(db_user, col_key, col_val)
                    try:
                        flag_modified(db_user, col_key)
                    except Exception:
                        pass
            await db.commit()
            found_any = True
    except Exception as e_db:
        print(f"[Sync Forwarding DB Warning]: {e_db}")
        try:
            await db.rollback()
        except Exception:
            pass

    # 2. Update in settings_db["users"] (memory + disk settings.json)
    all_users = settings_db.get("users", [])
    for u in all_users:
        if str(u.get("extension") or "").strip() == ext_clean:
            for col_key, col_val in updates.items():
                u[col_key] = col_val
            found_any = True
    if found_any:
        save_settings(settings_db)

    return found_any


@app.get("/api/subscriber/resolve_feature_code")
@app.get("/api/subscriber/dial_feature_code")
async def resolve_subscriber_feature_code(
    caller: str = "",
    exten: str = "",
    channel: str = "",
    db: AsyncSession = Depends(get_db)
):
    """
    Handles Call Forwarding activation and cancellation codes dialed from a registered
    SIP/PJSIP desk phone or softphone. Updates the user's forwarding settings identically
    to the Web UI so changes immediately appear in Kullanıcılar & Profil Ayarları.
    Returns 'ACTIVATED', 'CANCELLED', or 'INVALID'.
    """
    try:
        import urllib.parse
        raw_caller = urllib.parse.unquote(caller or "").strip()
        raw_exten = urllib.parse.unquote(exten or "").strip().replace("%23", "#")
        raw_channel = urllib.parse.unquote(channel or "").strip()

        # Extract extension from channel (e.g. PJSIP/1000-0000001a -> 1000) as reliable fallback
        chan_ext = ""
        if "/" in raw_channel:
            after_slash = raw_channel.split("/", 1)[1]
            chan_ext = after_slash.split("-", 1)[0].split("@", 1)[0].strip()

        # Gather all known extensions from DB and settings_db
        known_exts = set()
        for u in settings_db.get("users", []):
            if u.get("extension"):
                known_exts.add(str(u.get("extension")).strip())
        try:
            res_all = await db.execute(select(SystemUser.extension))
            for r_ext in res_all.scalars().all():
                if r_ext:
                    known_exts.add(str(r_ext).strip())
        except Exception:
            pass

        caller_ext = raw_caller if raw_caller in known_exts else (chan_ext if chan_ext in known_exts else (raw_caller or chan_ext))
        if not caller_ext:
            print(f"[Feature Code] Caller extension could not be resolved: caller={raw_caller}, chan={raw_channel}")
            return Response(content="INVALID", media_type="text/plain")

        # Read configured prefixes from Numbering Plan
        pbx_cfg = settings_db.get("pbx", {}) if isinstance(settings_db.get("pbx"), dict) else {}
        num_plan = pbx_cfg.get("numbering_plan", {}) if isinstance(pbx_cfg.get("numbering_plan"), dict) else {}
        fwd_cfg = num_plan.get("call_forwarding", {}) if isinstance(num_plan.get("call_forwarding"), dict) else {}

        p_always = str(fwd_cfg.get("always") or "*21*").strip() or "*21*"
        p_busy = str(fwd_cfg.get("busy") or "*67*").strip() or "*67*"
        p_noans = str(fwd_cfg.get("no_answer") or "*61*").strip() or "*61*"
        p_cancel = str(fwd_cfg.get("cancel") or "#21#").strip() or "#21#"

        # 0. Check if dialed string matches Call Monitoring (ChanSpy) prefixes (*551*, *552*, *553*)
        mon_cfg = num_plan.get("call_monitoring", {}) if isinstance(num_plan.get("call_monitoring"), dict) else {}
        mon_listen_pfx = str(mon_cfg.get("listen") or "*551*").strip() or "*551*"
        mon_whisper_pfx = str(mon_cfg.get("whisper") or "*552*").strip() or "*552*"
        mon_barge_pfx = str(mon_cfg.get("barge") or "*553*").strip() or "*553*"
        for mon_pfx, mon_mode in [
            (mon_listen_pfx, "listen"),
            (mon_whisper_pfx, "whisper"),
            (mon_barge_pfx, "barge"),
        ]:
            pfx_core = mon_pfx.rstrip("*")
            if raw_exten.startswith(mon_pfx) or (len(pfx_core) >= 3 and raw_exten.startswith(pfx_core)):
                spy_res = await _resolve_chanspy_internal(
                    caller=caller_ext,
                    exten=raw_exten,
                    mode=mon_mode,
                    channel=raw_channel,
                    db=db
                )
                if spy_res.startswith("ALLOW:"):
                    return Response(content=f"CHANSPY:{spy_res[6:]}", media_type="text/plain")
                return Response(content="INVALID", media_type="text/plain")

        print(f"[Feature Code] Desk Phone Dialed: caller_ext={caller_ext}, dialed={raw_exten} (Plan: always={p_always}, busy={p_busy}, no_answer={p_noans}, cancel={p_cancel})")

        # Fetch existing user forwarding settings to preserve timeout/targets when appropriate
        existing_noans_timeout = 30
        for u in settings_db.get("users", []):
            if str(u.get("extension") or "").strip() == caller_ext:
                na = u.get("forwarding_no_answer")
                if isinstance(na, dict) and na.get("timeout"):
                    try:
                        existing_noans_timeout = int(na.get("timeout"))
                    except Exception:
                        pass
                break

        # Helper to build deactivated rule object
        def _deactivated_rule(is_noans: bool = False):
            base = {"active": False, "type": "internal", "target": ""}
            if is_noans:
                base["timeout"] = existing_noans_timeout
            return base

        # 1. Check if dialed string matches Cancel Code (e.g. #21#, #21, *73, etc.)
        cancel_variants = {
            p_cancel,
            p_cancel.rstrip("#") if len(p_cancel.rstrip("#")) >= 2 else p_cancel,
            "#21#", "#21", "*73", "#002#", "#002"
        }
        if raw_exten in cancel_variants or (p_cancel and raw_exten.startswith(p_cancel)):
            updates = {
                "forwarding_always": _deactivated_rule(False),
                "forwarding_busy": _deactivated_rule(False),
                "forwarding_no_answer": _deactivated_rule(True),
            }
            await _sync_user_forwarding_state(caller_ext, updates, db, source_label="Masa Telefonu")
            add_system_log("CALL_FORWARD", "INFO", f"Dahili {caller_ext} masa telefonundan ({raw_exten}) tüm çağrı yönlendirmelerini iptal etti.")
            print(f"[Feature Code] Extension {caller_ext} -> ALL FORWARDING CANCELLED via {raw_exten}")
            return Response(content="CANCELLED", media_type="text/plain")

        # Also check rule-specific cancel codes (e.g. dialing just *21* without target, or #67#, #61#)
        for pfx, col_name, rule_label, is_na in [
            (p_always, "forwarding_always", "Her Zaman Yönlendirme", False),
            (p_busy, "forwarding_busy", "Meşgulde Yönlendirme", False),
            (p_noans, "forwarding_no_answer", "Zaman Aşımında Yönlendirme", True),
        ]:
            core_digits = pfx.strip("*#")
            rule_cancel_variants = {pfx, pfx.rstrip("*#")}
            if core_digits:
                rule_cancel_variants.update({f"#{core_digits}#", f"#{core_digits}", f"*{core_digits}#"})
            if raw_exten in rule_cancel_variants:
                updates = {col_name: _deactivated_rule(is_na)}
                await _sync_user_forwarding_state(caller_ext, updates, db, source_label="Masa Telefonu")
                add_system_log("CALL_FORWARD", "INFO", f"Dahili {caller_ext} masa telefonundan ({raw_exten}) {rule_label} kuralını iptal etti.")
                print(f"[Feature Code] Extension {caller_ext} -> {col_name} CANCELLED via {raw_exten}")
                return Response(content="CANCELLED", media_type="text/plain")

        # 2. Check Activation Prefixes (Always, Busy, No Answer)
        prefix_rules = [
            (p_always, "forwarding_always", "Her Zaman", False),
            (p_busy, "forwarding_busy", "Meşgul Durumda", False),
            (p_noans, "forwarding_no_answer", "Zaman Aşımında (Cevapsız)", True),
        ]
        # Sort by prefix length descending so longer prefix matches first
        prefix_rules.sort(key=lambda x: len(x[0]), reverse=True)

        matched_col = None
        matched_label = ""
        matched_is_na = False
        remainder = ""

        for pfx, col_name, lbl, is_na in prefix_rules:
            if raw_exten.startswith(pfx):
                matched_col = col_name
                matched_label = lbl
                matched_is_na = is_na
                remainder = raw_exten[len(pfx):]
                break
            stripped_pfx = pfx.rstrip("*")
            if stripped_pfx and len(stripped_pfx) >= 2 and raw_exten.startswith(stripped_pfx):
                matched_col = col_name
                matched_label = lbl
                matched_is_na = is_na
                remainder = raw_exten[len(stripped_pfx):]
                break

        if not matched_col:
            print(f"[Feature Code] Unrecognized feature code dialed by {caller_ext}: {raw_exten}")
            return Response(content="INVALID", media_type="text/plain")

        # Clean target number from remainder (strip leading * and trailing #/*)
        clean_rem = remainder.lstrip("*").rstrip("#*").strip()
        if not clean_rem:
            # Dialed prefix with no target -> treat as cancel for that rule
            updates = {matched_col: _deactivated_rule(matched_is_na)}
            await _sync_user_forwarding_state(caller_ext, updates, db, source_label="Masa Telefonu")
            return Response(content="CANCELLED", media_type="text/plain")

        custom_timeout = existing_noans_timeout
        if matched_is_na and "*" in clean_rem:
            parts = clean_rem.split("*", 1)
            target_raw = parts[0].strip()
            if parts[1].strip().isdigit():
                custom_timeout = max(5, min(120, int(parts[1].strip())))
        else:
            target_raw = clean_rem

        target_num = re.sub(r"[^\d+]", "", target_raw)
        if len(target_num) < 2:
            return Response(content="INVALID", media_type="text/plain")

        target_type = "internal" if (target_num in known_exts or len(target_num) < 6) else "external"
        rule_obj = {
            "active": True,
            "type": target_type,
            "target": target_num
        }
        if matched_is_na:
            rule_obj["timeout"] = custom_timeout

        await _sync_user_forwarding_state(caller_ext, {matched_col: rule_obj}, db, source_label="Masa Telefonu")
        add_system_log(
            "CALL_FORWARD",
            "INFO",
            f"Dahili {caller_ext} masa telefonundan ({raw_exten}) '{matched_label}' yönlendirmesini '{target_num}' ({'Dahili' if target_type == 'internal' else 'Dış Numara'}) hedefine aktif etti."
        )
        print(f"[Feature Code] Extension {caller_ext} -> {matched_col} ACTIVATED to {target_num} ({target_type})")
        return Response(content="ACTIVATED", media_type="text/plain")

    except Exception as e_feat:
        print(f"[Feature Code Error]: {e_feat}")
        return Response(content="INVALID", media_type="text/plain")


@app.post("/api/subscriber/cancel_forwarding")
async def cancel_subscriber_forwarding_endpoint(
    payload: CancelForwardingSchema,
    db: AsyncSession = Depends(get_db)
):
    """
    Allows cancelling one or all forwarding rules for an extension directly from the Web UI.
    """
    ext_str = str(payload.extension or "").strip()
    if not ext_str:
        raise HTTPException(status_code=400, detail="Dahili numarası belirtilmedi.")

    rule_type = (payload.rule_type or "all").strip().lower()
    updates = {}
    if rule_type in ("all", "always", "forwarding_always"):
        updates["forwarding_always"] = {"active": False, "type": "internal", "target": ""}
    if rule_type in ("all", "busy", "forwarding_busy"):
        updates["forwarding_busy"] = {"active": False, "type": "internal", "target": ""}
    if rule_type in ("all", "no_answer", "forwarding_no_answer"):
        updates["forwarding_no_answer"] = {"active": False, "type": "internal", "target": "", "timeout": 30}

    ok = await _sync_user_forwarding_state(ext_str, updates, db, source_label="Web Arayüzü")
    if not ok:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    add_system_log("CALL_FORWARD", "INFO", f"Dahili {ext_str} için yönlendirme kuralı ({rule_type}) web arayüzünden iptal edildi.")
    return {"status": "success", "extension": ext_str, "cancelled": rule_type, "updates": updates}


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
async def _sync_rules_to_settings(db: AsyncSession):
    try:
        stmt = select(Rule).order_by(Rule.id.asc())
        res = await db.execute(stmt)
        all_db_rules = res.scalars().all()
        serialized = [
            {
                "id": r.id,
                "tenant_id": getattr(r, "tenant_id", "tenant-default") or "tenant-default",
                "rule_type": r.rule_type,
                "trigger_keyword": r.trigger_keyword,
                "response_text": r.response_text,
                "action_to_trigger": r.action_to_trigger,
                "is_active": bool(r.is_active) if r.is_active is not None else True
            }
            for r in all_db_rules
        ]
        settings_db["rules"] = serialized
        save_settings(settings_db)
        return serialized
    except Exception as e:
        print(f"[Rules Sync Warning]: {e}")
        return settings_db.get("rules", [])

@app.get("/api/rules")
async def list_rules(db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(Rule).order_by(Rule.id.asc())
        result = await db.execute(stmt)
        db_rules = result.scalars().all()
        if not db_rules and settings_db.get("rules"):
            for sr in settings_db.get("rules", []):
                new_r = Rule(
                    rule_type=sr.get("rule_type", "faq"),
                    trigger_keyword=sr.get("trigger_keyword"),
                    response_text=sr.get("response_text"),
                    action_to_trigger=sr.get("action_to_trigger"),
                    is_active=sr.get("is_active", True)
                )
                db.add(new_r)
            await db.commit()
            result = await db.execute(select(Rule).order_by(Rule.id.asc()))
            db_rules = result.scalars().all()
        await _sync_rules_to_settings(db)
        return db_rules
    except Exception as e:
        print(f"[Rules GET Fallback]: {e}")
        return settings_db.get("rules", [])

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
    await _sync_rules_to_settings(db)
    return db_rule

@app.put("/api/rules/{rule_id}")
async def update_rule(rule_id: int, rule: RuleCreateSchema, db: AsyncSession = Depends(get_db)):
    stmt = select(Rule).where(Rule.id == rule_id)
    res = await db.execute(stmt)
    db_rule = res.scalar_one_or_none()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    db_rule.rule_type = rule.rule_type
    db_rule.trigger_keyword = rule.trigger_keyword
    db_rule.response_text = rule.response_text
    db_rule.action_to_trigger = rule.action_to_trigger
    db_rule.is_active = rule.is_active
    await db.commit()
    await db.refresh(db_rule)
    await _sync_rules_to_settings(db)
    return db_rule

@app.delete("/api/rules/{rule_id}")
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    stmt = delete(Rule).where(Rule.id == rule_id)
    await db.execute(stmt)
    await db.commit()
    await _sync_rules_to_settings(db)
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

_ELEVENLABS_QUOTA_CACHE = {"ts": 0.0, "key": "", "data": None}

async def fetch_elevenlabs_live_subscription(api_key: str) -> Optional[dict]:
    if not api_key or not api_key.strip():
        return None
    import time
    now_ts = time.time()
    if (
        _ELEVENLABS_QUOTA_CACHE["key"] == api_key.strip()
        and (now_ts - _ELEVENLABS_QUOTA_CACHE["ts"]) < 60.0
        and _ELEVENLABS_QUOTA_CACHE["data"] is not None
    ):
        return _ELEVENLABS_QUOTA_CACHE["data"]
    try:
        import httpx
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                "https://api.elevenlabs.io/v1/user/subscription",
                headers={"xi-api-key": api_key.strip()}
            )
            if resp.status_code == 200:
                d = resp.json()
                sub_info = {
                    "tier": d.get("tier", "starter"),
                    "character_count": int(d.get("character_count", 0) or 0),
                    "character_limit": int(d.get("character_limit", 0) or 0),
                    "status": d.get("status", "active"),
                    "next_reset_unix": d.get("next_character_count_reset_unix")
                }
                _ELEVENLABS_QUOTA_CACHE["ts"] = now_ts
                _ELEVENLABS_QUOTA_CACHE["key"] = api_key.strip()
                _ELEVENLABS_QUOTA_CACHE["data"] = sub_info
                return sub_info
    except Exception as e:
        print(f"[ElevenLabs Live Subscription Check Warning]: {e}")
    return None

def _parse_iso_utc(ts_str: Optional[str]) -> Optional[datetime.datetime]:
    if not ts_str or not isinstance(ts_str, str):
        return None
    try:
        clean = ts_str.replace("Z", "").strip()
        dt = datetime.datetime.fromisoformat(clean)
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None

async def compute_live_api_budgets(db: AsyncSession, target_tenant: str = "tenant-default") -> dict:
    from backend.database.models import DocumentChunk
    raw_budgets = settings_db.get("api_budgets", {})
    default_budgets = DEFAULT_SETTINGS["api_budgets"]
    
    service_keys = ["google", "elevenlabs", "openai", "anthropic", "groq", "deepgram", "whatsapp"]
    merged_budgets = {}
    for k in service_keys:
        base_def = default_budgets.get(k, {})
        saved = raw_budgets.get(k, {}) if isinstance(raw_budgets.get(k), dict) else {}
        user_cfg = bool(saved.get("user_configured", False))
        # Ignore legacy unconfigured default numbers (50.0, 25.0, 20.0) if user hasn't explicitly configured
        raw_loaded = float(saved.get("loaded_credit", 0.0) or 0.0)
        if not user_cfg and not saved.get("last_updated") and raw_loaded in (50.0, 25.0, 20.0):
            raw_loaded = 0.0

        merged_budgets[k] = {
            "loaded_credit": raw_loaded,
            "initial_spent": float(saved.get("initial_spent", 0.0) or 0.0),
            "alert_threshold": int(saved.get("alert_threshold", base_def.get("alert_threshold", 80)) or 80),
            "user_configured": user_cfg,
            "last_topup_at": saved.get("last_topup_at", None),
            "last_topup_display": saved.get("last_topup_display", None),
            "last_updated": saved.get("last_updated", None)
        }

    # Resolve API Keys & Channels configuration
    tenant_keys = settings_db.get("tenant_ai_providers", {}).get(target_tenant)
    if not tenant_keys:
        tenant_keys = settings_db.get("ai_providers", DEFAULT_SETTINGS["ai_providers"])
    channels_cfg = settings_db.get("channels", DEFAULT_SETTINGS["channels"])
    
    google_key_val = (tenant_keys.get("google_api_key") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    elevenlabs_key_val = (tenant_keys.get("elevenlabs_api_key") or os.getenv("ELEVENLABS_API_KEY") or "").strip()
    openai_key_val = (tenant_keys.get("openai_api_key") or os.getenv("OPENAI_API_KEY") or "").strip()
    anthropic_key_val = (tenant_keys.get("anthropic_api_key") or os.getenv("ANTHROPIC_API_KEY") or "").strip()
    groq_key_val = (tenant_keys.get("groq_api_key") or os.getenv("GROQ_API_KEY") or "").strip()
    deepgram_key_val = (os.getenv("DEEPGRAM_API_KEY") or "").strip()

    google_key_present = bool(google_key_val)
    elevenlabs_key_present = bool(elevenlabs_key_val)
    openai_key_present = bool(openai_key_val)
    anthropic_key_present = bool(anthropic_key_val)
    groq_key_present = bool(groq_key_val)
    deepgram_key_present = bool(deepgram_key_val)
    whatsapp_configured = bool((channels_cfg.get("whatsapp_token") or "").strip()) or bool(channels_cfg.get("whatsapp_accounts"))

    # Query ElevenLabs live subscription quota if key is configured
    elevenlabs_live_sub = await fetch_elevenlabs_live_subscription(elevenlabs_key_val) if elevenlabs_key_present else None

    # Inspect configured AI Agents
    all_agents = settings_db.get("ai_agents", DEFAULT_SETTINGS["ai_agents"])
    if not is_global_tenant(target_tenant):
        if is_default_tenant(target_tenant):
            agents = [a for a in all_agents if not a.get("tenant_id") or a.get("tenant_id") in ["tenant-default", "default"]]
        else:
            agents = [a for a in all_agents if a.get("tenant_id") == target_tenant]
    else:
        agents = all_agents

    agent_usage_map = {k: [] for k in service_keys}
    agent_by_name_or_id = {}
    for ag in agents:
        ag_name = ag.get("name") or ag.get("id") or "AI Temsilci"
        agent_by_name_or_id[ag_name.lower()] = ag
        if ag.get("id"):
            agent_by_name_or_id[str(ag.get("id")).lower()] = ag
        llm_p = (ag.get("llm_provider") or ag.get("provider") or "google").lower()
        stt_p = (ag.get("stt_provider") or "google").lower()
        tts_p = (ag.get("tts_provider") or ("elevenlabs" if ag.get("elevenlabs_voice_id") else "google")).lower()
        roles_per_p = {}
        for role_label, prov in [("LLM", llm_p), ("STT", stt_p), ("TTS", tts_p)]:
            if prov in service_keys:
                roles_per_p.setdefault(prov, []).append(role_label)
        for prov, r_list in roles_per_p.items():
            agent_usage_map[prov].append(f"{ag_name} ({', '.join(r_list)})")

    def _new_stat_bucket():
        return {
            "call_count": 0,
            "audio_seconds": 0.0,
            "audio_minutes": 0.0,
            "transcript_turns": 0,
            "customer_chars": 0,
            "ai_chars": 0,
            "total_chars": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "estimated_tokens": 0,
            "chat_sessions": 0,
            "chat_messages": 0,
            "qa_evaluations": 0,
            "rag_chunks": 0,
            "today_cost": 0.0,
            "period_cost": 0.0,
            "all_time_cost": 0.0,
            "all_time_calls": 0,
            "all_time_tokens": 0,
            "all_time_chars": 0,
        }

    stats = {k: _new_stat_bucket() for k in service_keys}
    topup_dts = {k: _parse_iso_utc(merged_budgets[k].get("last_topup_at")) for k in service_keys}

    now_utc = datetime.datetime.utcnow()
    today_start = now_utc - datetime.timedelta(hours=24)
    oldest_activity = now_utc

    try:
        # 1. Query Calls and Transcripts
        if is_global_tenant(target_tenant):
            calls_stmt = select(Call)
        elif is_default_tenant(target_tenant):
            calls_stmt = select(Call).where(or_(Call.tenant_id == None, Call.tenant_id.in_(["tenant-default", "default"])))
        else:
            calls_stmt = select(Call).where(Call.tenant_id == target_tenant)

        calls_res = await db.execute(calls_stmt)
        calls_list = calls_res.scalars().all()

        call_ids = [c.id for c in calls_list if c.id]
        transcripts_by_call = {}
        if call_ids:
            tr_stmt = select(Transcript).where(Transcript.call_id.in_(call_ids[:5000]))
            tr_res = await db.execute(tr_stmt)
            for tr in tr_res.scalars().all():
                transcripts_by_call.setdefault(tr.call_id, []).append(tr)

        for c in calls_list:
            trs = transcripts_by_call.get(c.id, [])
            ai_trs = [t for t in trs if t.speaker == "ai" and (t.text or "").strip()]
            cust_trs = [t for t in trs if t.speaker == "customer" and (t.text or "").strip()]

            # CRITICAL RULE: Only count calls where AI actually spoke (ai_trs > 0) or generated an AI summary!
            # Human-to-human calls, unanswered calls, or direct transfers without AI speech DO NOT consume AI tokens.
            summary_chars = len(c.summary or "") + len(c.qa_report or "")
            has_qa = c.qa_score is not None or bool(c.summary)
            if len(ai_trs) == 0 and not has_qa:
                continue

            call_ts = c.start_time or (trs[0].timestamp if trs else now_utc)
            if call_ts and call_ts < oldest_activity:
                oldest_activity = call_ts
            is_today = bool(call_ts and call_ts >= today_start)

            cust_chars = sum(len(t.text or "") for t in cust_trs)
            ai_chars = sum(len(t.text or "") for t in ai_trs)
            ai_turns = len(ai_trs)
            cust_turns = len(cust_trs)

            # Accurate speech duration based on actual spoken transcript length (~14 chars/sec in Turkish)
            # Capped by actual call duration if start_time and end_time are present
            estimated_speech_sec = (cust_chars + ai_chars) / 14.0
            if c.start_time and c.end_time and c.end_time > c.start_time:
                raw_wall_sec = (c.end_time - c.start_time).total_seconds()
                # Prevent stuck/zombie calls from inflating minutes
                speech_sec = min(raw_wall_sec, max(estimated_speech_sec * 1.35, 3.0)) if ai_turns > 0 else 0.0
            else:
                speech_sec = max(estimated_speech_sec, 2.0) if ai_turns > 0 else 0.0

            # Resolve AI Agent that handled this call
            ag_obj = None
            if c.agent_name:
                ag_obj = agent_by_name_or_id.get(c.agent_name.strip().lower())
            if not ag_obj and agents:
                ag_obj = agents[0]

            llm_p = (ag_obj.get("llm_provider") or ag_obj.get("provider") or "google").lower() if ag_obj else "google"
            stt_p = (ag_obj.get("stt_provider") or "google").lower() if ag_obj else "google"
            tts_p = (ag_obj.get("tts_provider") or ("elevenlabs" if (ag_obj and ag_obj.get("elevenlabs_voice_id")) else "google")).lower() if ag_obj else "google"

            # Verify provider fallback: if a provider key is not present, AudioSocket falls back to Google Gemini
            if tts_p == "elevenlabs" and not elevenlabs_key_present:
                tts_p = "google"
            if llm_p == "openai" and not openai_key_present:
                llm_p = "google"
            if llm_p == "anthropic" and not anthropic_key_present:
                llm_p = "google"
            if llm_p == "groq" and not groq_key_present:
                llm_p = "google"
            if stt_p == "deepgram" and not deepgram_key_present:
                stt_p = "google"

            # Token calculation for this call (~3.5 chars per token + compact system instruction per session)
            in_tok = int(cust_chars / 3.5) + (320 if ai_turns > 0 else 0) + int(summary_chars / 3.5)
            out_tok = int(ai_chars / 3.5) + (120 if has_qa else 0)
            call_tokens = in_tok + out_tok

            # 1) Google Gemini Cost (Official Gemini 2.0/2.5 Flash rates: $0.10/1M in, $0.40/1M out, ~$0.002/min audio)
            if llm_p == "google" or stt_p == "google" or has_qa:
                g_cost = (
                    (in_tok / 1_000_000.0) * 0.10
                    + (out_tok / 1_000_000.0) * 0.40
                    + (speech_sec / 60.0) * 0.0022
                )
                stats["google"]["all_time_cost"] += g_cost
                stats["google"]["all_time_calls"] += (1 if ai_turns > 0 else 0)
                stats["google"]["all_time_tokens"] += call_tokens
                stats["google"]["all_time_chars"] += (cust_chars + ai_chars + summary_chars)

                after_topup = (topup_dts["google"] is None) or (call_ts >= topup_dts["google"])
                if after_topup:
                    if ai_turns > 0:
                        stats["google"]["call_count"] += 1
                        stats["google"]["audio_seconds"] += speech_sec
                    stats["google"]["customer_chars"] += cust_chars
                    stats["google"]["ai_chars"] += (ai_chars if tts_p == "google" else 0)
                    stats["google"]["total_chars"] += (cust_chars + ai_chars + summary_chars)
                    stats["google"]["input_tokens"] += in_tok
                    stats["google"]["output_tokens"] += out_tok
                    stats["google"]["estimated_tokens"] += call_tokens
                    stats["google"]["transcript_turns"] += (cust_turns + ai_turns)
                    if has_qa:
                        stats["google"]["qa_evaluations"] += 1
                    stats["google"]["period_cost"] += g_cost
                if is_today:
                    stats["google"]["today_cost"] += g_cost

            # 2) ElevenLabs TTS Cost (ONLY actual ai_chars spoken when ElevenLabs TTS was active)
            if (tts_p == "elevenlabs" or llm_p == "elevenlabs") and ai_chars > 0:
                # Official ElevenLabs starter/creator rate: ~$0.15 - $0.18 per 1,000 characters
                el_cost = (ai_chars / 1000.0) * 0.165
                stats["elevenlabs"]["all_time_cost"] += el_cost
                stats["elevenlabs"]["all_time_calls"] += 1
                stats["elevenlabs"]["all_time_chars"] += ai_chars

                after_topup = (topup_dts["elevenlabs"] is None) or (call_ts >= topup_dts["elevenlabs"])
                if after_topup:
                    stats["elevenlabs"]["call_count"] += 1
                    stats["elevenlabs"]["audio_seconds"] += speech_sec
                    stats["elevenlabs"]["ai_chars"] += ai_chars
                    stats["elevenlabs"]["total_chars"] += ai_chars
                    stats["elevenlabs"]["transcript_turns"] += ai_turns
                    stats["elevenlabs"]["period_cost"] += el_cost
                if is_today:
                    stats["elevenlabs"]["today_cost"] += el_cost

            # 3) OpenAI Cost
            if llm_p == "openai" or stt_p == "openai" or tts_p == "openai":
                oa_cost = (in_tok / 1_000_000.0) * 0.15 + (out_tok / 1_000_000.0) * 0.60
                if stt_p == "openai":
                    oa_cost += (speech_sec / 60.0) * 0.006
                stats["openai"]["all_time_cost"] += oa_cost
                stats["openai"]["all_time_calls"] += 1
                stats["openai"]["all_time_tokens"] += call_tokens
                after_topup = (topup_dts["openai"] is None) or (call_ts >= topup_dts["openai"])
                if after_topup:
                    stats["openai"]["call_count"] += 1
                    stats["openai"]["audio_seconds"] += speech_sec
                    stats["openai"]["total_chars"] += (cust_chars + ai_chars)
                    stats["openai"]["estimated_tokens"] += call_tokens
                    stats["openai"]["period_cost"] += oa_cost
                if is_today:
                    stats["openai"]["today_cost"] += oa_cost

            # 4) Anthropic Claude Cost
            if llm_p == "anthropic":
                an_cost = (in_tok / 1_000_000.0) * 0.80 + (out_tok / 1_000_000.0) * 4.00
                stats["anthropic"]["all_time_cost"] += an_cost
                stats["anthropic"]["all_time_calls"] += 1
                stats["anthropic"]["all_time_tokens"] += call_tokens
                after_topup = (topup_dts["anthropic"] is None) or (call_ts >= topup_dts["anthropic"])
                if after_topup:
                    stats["anthropic"]["call_count"] += 1
                    stats["anthropic"]["audio_seconds"] += speech_sec
                    stats["anthropic"]["total_chars"] += (cust_chars + ai_chars)
                    stats["anthropic"]["estimated_tokens"] += call_tokens
                    stats["anthropic"]["period_cost"] += an_cost
                if is_today:
                    stats["anthropic"]["today_cost"] += an_cost

            # 5) Groq LPU Cost
            if llm_p == "groq":
                gr_cost = (in_tok / 1_000_000.0) * 0.59 + (out_tok / 1_000_000.0) * 0.79
                stats["groq"]["all_time_cost"] += gr_cost
                stats["groq"]["all_time_calls"] += 1
                stats["groq"]["all_time_tokens"] += call_tokens
                after_topup = (topup_dts["groq"] is None) or (call_ts >= topup_dts["groq"])
                if after_topup:
                    stats["groq"]["call_count"] += 1
                    stats["groq"]["audio_seconds"] += speech_sec
                    stats["groq"]["total_chars"] += (cust_chars + ai_chars)
                    stats["groq"]["estimated_tokens"] += call_tokens
                    stats["groq"]["period_cost"] += gr_cost
                if is_today:
                    stats["groq"]["today_cost"] += gr_cost

            # 6) Deepgram STT Cost
            if stt_p == "deepgram":
                dg_cost = (speech_sec / 60.0) * 0.0043
                stats["deepgram"]["all_time_cost"] += dg_cost
                stats["deepgram"]["all_time_calls"] += 1
                after_topup = (topup_dts["deepgram"] is None) or (call_ts >= topup_dts["deepgram"])
                if after_topup:
                    stats["deepgram"]["call_count"] += 1
                    stats["deepgram"]["audio_seconds"] += speech_sec
                    stats["deepgram"]["customer_chars"] += cust_chars
                    stats["deepgram"]["total_chars"] += cust_chars
                    stats["deepgram"]["period_cost"] += dg_cost
                if is_today:
                    stats["deepgram"]["today_cost"] += dg_cost

        # 2. Query Chat Sessions & Messages (Omnichannel & WhatsApp)
        if is_global_tenant(target_tenant):
            chat_stmt = select(ChatSession)
        elif is_default_tenant(target_tenant):
            chat_stmt = select(ChatSession).where(or_(ChatSession.tenant_id == None, ChatSession.tenant_id.in_(["tenant-default", "default"])))
        else:
            chat_stmt = select(ChatSession).where(ChatSession.tenant_id == target_tenant)

        chat_res = await db.execute(chat_stmt)
        chat_sessions = chat_res.scalars().all()
        session_ids = [s.id for s in chat_sessions if s.id]
        
        wa_session_ids = set(s.id for s in chat_sessions if (s.channel or "").lower() == "whatsapp")

        if session_ids:
            msg_stmt = select(ChatMessage).where(ChatMessage.session_id.in_(session_ids[:5000]))
            msg_res = await db.execute(msg_stmt)
            wa_sessions_in_period = set()
            g_sessions_in_period = set()
            for m in msg_res.scalars().all():
                m_chars = len(m.text or "")
                m_ts = m.timestamp or now_utc
                is_msg_today = bool(m_ts >= today_start)
                if m.session_id in wa_session_ids:
                    after_wa_topup = (topup_dts["whatsapp"] is None) or (m_ts >= topup_dts["whatsapp"])
                    if after_wa_topup:
                        wa_sessions_in_period.add(m.session_id)
                        stats["whatsapp"]["chat_messages"] += 1
                        stats["whatsapp"]["total_chars"] += m_chars
                if m.sender == "ai":
                    # Gemini Flash text reply cost (~250 input tokens + output tokens)
                    msg_in_tok = 250
                    msg_out_tok = int(m_chars / 3.5)
                    msg_tot_tok = msg_in_tok + msg_out_tok
                    ai_msg_cost = (msg_in_tok / 1_000_000.0) * 0.10 + (msg_out_tok / 1_000_000.0) * 0.40
                    stats["google"]["all_time_cost"] += ai_msg_cost
                    stats["google"]["all_time_tokens"] += msg_tot_tok
                    after_g_topup = (topup_dts["google"] is None) or (m_ts >= topup_dts["google"])
                    if after_g_topup:
                        g_sessions_in_period.add(m.session_id)
                        stats["google"]["chat_messages"] += 1
                        stats["google"]["total_chars"] += m_chars
                        stats["google"]["estimated_tokens"] += msg_tot_tok
                        stats["google"]["period_cost"] += ai_msg_cost
                    if is_msg_today:
                        stats["google"]["today_cost"] += ai_msg_cost
            stats["whatsapp"]["chat_sessions"] = len(wa_sessions_in_period)
            stats["google"]["chat_sessions"] = len(g_sessions_in_period)

        # 3. Query RAG Document Chunks count (informational only; does not add recurring cost)
        if is_global_tenant(target_tenant):
            rag_stmt = select(func.count(DocumentChunk.id))
        elif is_default_tenant(target_tenant):
            rag_stmt = select(func.count(DocumentChunk.id)).where(or_(DocumentChunk.tenant_id == None, DocumentChunk.tenant_id.in_(["tenant-default", "default"])))
        else:
            rag_stmt = select(func.count(DocumentChunk.id)).where(DocumentChunk.tenant_id == target_tenant)
        rag_res = await db.execute(rag_stmt)
        stats["google"]["rag_chunks"] = rag_res.scalar() or 0
    except Exception as e:
        print(f"[API Budgets Live Calculation Warning]: {e}")

    active_days = max(1.0, min(30.0, (now_utc - oldest_activity).total_seconds() / 86400.0))

    configured_map = {
        "google": google_key_present or len(agent_usage_map["google"]) > 0 or stats["google"]["all_time_calls"] > 0,
        "elevenlabs": elevenlabs_key_present or len(agent_usage_map["elevenlabs"]) > 0 or stats["elevenlabs"]["all_time_calls"] > 0,
        "openai": openai_key_present or len(agent_usage_map["openai"]) > 0 or stats["openai"]["all_time_calls"] > 0,
        "anthropic": anthropic_key_present or len(agent_usage_map["anthropic"]) > 0 or stats["anthropic"]["all_time_calls"] > 0,
        "groq": groq_key_present or len(agent_usage_map["groq"]) > 0 or stats["groq"]["all_time_calls"] > 0,
        "deepgram": deepgram_key_present or len(agent_usage_map["deepgram"]) > 0 or stats["deepgram"]["all_time_calls"] > 0,
        "whatsapp": whatsapp_configured or stats["whatsapp"]["chat_sessions"] > 0 or stats["whatsapp"]["chat_messages"] > 0,
    }

    key_defined_map = {
        "google": google_key_present,
        "elevenlabs": elevenlabs_key_present,
        "openai": openai_key_present,
        "anthropic": anthropic_key_present,
        "groq": groq_key_present,
        "deepgram": deepgram_key_present,
        "whatsapp": whatsapp_configured,
    }

    result = {}
    for k in service_keys:
        st = stats[k]
        b = merged_budgets[k]
        st["audio_minutes"] = round(st["audio_seconds"] / 60.0, 2)
        
        period_auto_cost = round(st["period_cost"], 6)
        all_time_cost = round(st["all_time_cost"], 6)
        initial_spent = round(b.get("initial_spent", 0.0), 6)

        # Effective spent since last topup = initial_spent (if user synced existing spend) + period_auto_cost (usage strictly after last_topup_at)
        effective_spent = max(0.0, round(initial_spent + period_auto_cost, 6))

        loaded = round(b["loaded_credit"], 2)
        remaining = max(0.0, round(loaded - effective_spent, 6)) if loaded > 0 else 0.0
        usage_pct = round((effective_spent / loaded) * 100.0, 2) if loaded > 0 else 0.0

        # If ElevenLabs live subscription quota is available, also compute character quota %
        live_quota_info = None
        if k == "elevenlabs" and elevenlabs_live_sub:
            char_used = elevenlabs_live_sub["character_count"]
            char_limit = elevenlabs_live_sub["character_limit"]
            char_rem = max(0, char_limit - char_used)
            char_pct = round((char_used / char_limit) * 100.0, 1) if char_limit > 0 else 0.0
            live_quota_info = {
                "provider": "elevenlabs",
                "tier": elevenlabs_live_sub["tier"],
                "used": char_used,
                "limit": char_limit,
                "remaining": char_rem,
                "pct": char_pct,
                "unit": "Karakter"
            }
            if loaded <= 0 and char_limit > 0:
                usage_pct = char_pct

        # Daily burn rate based on period days (if topup set) or active_days
        if topup_dts[k]:
            period_days = max(1.0, (now_utc - topup_dts[k]).total_seconds() / 86400.0)
            daily_burn = round(max(st["today_cost"], effective_spent / period_days), 6) if effective_spent > 0 else 0.0
        else:
            daily_burn = round(max(st["today_cost"], effective_spent / active_days), 6) if effective_spent > 0 else 0.0

        est_days_left = int(remaining / daily_burn) if (daily_burn > 0.00001 and loaded > 0) else (999 if loaded > 0 and effective_spent == 0 else 0)

        # Build human-readable service usage breakdown (for current period since last top-up)
        breakdown = []
        if k == "google":
            breakdown = [
                {"label": "Yükleme Sonrası AI Çağrısı", "value": f"{st['call_count']} Çağrı ({st['audio_minutes']} dk konuşma)"},
                {"label": "Harcanan Token (Giriş + Çıkış)", "value": f"{st['estimated_tokens']:,} Token"},
                {"label": "Omnichannel AI Yanıtları", "value": f"{st['chat_messages']} Mesaj"},
                {"label": "QA Kalite & Özet Analizi", "value": f"{st['qa_evaluations']} Analiz"},
                {"label": "Tüm Zamanlar Toplam Tüketim", "value": f"${all_time_cost:.4f} ({st['all_time_calls']} Çağrı / {st['all_time_tokens']:,} Token)"}
            ]
        elif k == "elevenlabs":
            if live_quota_info:
                breakdown = [
                    {"label": "Canlı ElevenLabs Paket Kotası", "value": f"{live_quota_info['used']:,} / {live_quota_info['limit']:,} Karakter (%{live_quota_info['pct']})"},
                    {"label": "Kalan Karakter Hakkı (Canlı API)", "value": f"{live_quota_info['remaining']:,} Karakter ({live_quota_info['tier'].upper()})"},
                    {"label": "Yükleme Sonrası Sentezlenen", "value": f"{st['total_chars']:,} Karakter ({st['call_count']} Çağrı)"},
                    {"label": "Tüm Zamanlar Sentezlenen", "value": f"{st['all_time_chars']:,} Karakter (${all_time_cost:.4f})"}
                ]
            else:
                breakdown = [
                    {"label": "Yükleme Sonrası Sentezlenen", "value": f"{st['total_chars']:,} Karakter"},
                    {"label": "Sesli AI Görüşme Süresi", "value": f"{st['audio_minutes']} dk ({st['call_count']} Çağrı)"},
                    {"label": "Tahmini Kalan Karakter", "value": f"~{int((remaining / 0.165) * 1000):,} Karakter" if loaded > 0 else "Ücret Yüklenmedi"},
                    {"label": "Tüm Zamanlar Tüketim", "value": f"{st['all_time_chars']:,} Karakter (${all_time_cost:.4f})"}
                ]
        elif k == "whatsapp":
            breakdown = [
                {"label": "WhatsApp Konuşma Oturumu", "value": f"{st['chat_sessions']} Oturum"},
                {"label": "Toplam Gönderilen/Alınan", "value": f"{st['chat_messages']} Mesaj"},
                {"label": "24 Saat Servis Penceresi Yanıtları", "value": "$0.0000 (Meta Ücretsiz Servis Yanıtı)"}
            ]
        elif k == "deepgram":
            breakdown = [
                {"label": "Nova-2 STT Ses Süresi", "value": f"{st['audio_minutes']} dk ({st['call_count']} Çağrı)"},
                {"label": "Çözümlenen Konuşma", "value": f"{st['customer_chars']:,} Karakter"},
                {"label": "Tüm Zamanlar Tüketim", "value": f"${all_time_cost:.4f} ({st['all_time_calls']} Çağrı)"}
            ]
        else:
            breakdown = [
                {"label": "Yükleme Sonrası Görüşme", "value": f"{st['call_count']} Çağrı ({st['audio_minutes']} dk)"},
                {"label": "Harcanan Token", "value": f"{st['estimated_tokens']:,} Token"},
                {"label": "İşlenen Metin Hacmi", "value": f"{st['total_chars']:,} Karakter"},
                {"label": "Tüm Zamanlar Tüketim", "value": f"${all_time_cost:.4f} ({st['all_time_tokens']:,} Token)"}
            ]

        result[k] = {
            "loaded_credit": loaded,
            "spent_credit": round(effective_spent, 4),
            "spent_credit_exact": effective_spent,
            "period_auto_cost": period_auto_cost,
            "all_time_cost": all_time_cost,
            "remaining_credit": round(remaining, 4),
            "usage_pct": min(100.0, round(usage_pct, 1)),
            "raw_usage_pct": round(usage_pct, 2),
            "alert_threshold": b["alert_threshold"],
            "user_configured": b["user_configured"],
            "last_topup_at": b["last_topup_at"],
            "last_topup_display": b["last_topup_display"],
            "configured": configured_map[k],
            "api_key_defined": key_defined_map[k],
            "active_agents": agent_usage_map[k],
            "daily_burn_rate": daily_burn,
            "estimated_days_left": est_days_left,
            "last_updated": b.get("last_updated"),
            "live_quota": live_quota_info,
            "metrics": st,
            "breakdown": breakdown
        }

    return result

@app.get("/api/settings/api-budgets")
async def get_api_budgets(user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    return await compute_live_api_budgets(db, target_tenant)

class ServiceBudgetActionSchema(BaseModel):
    provider: str
    action: str  # "new_topup", "add_credit", "set_budget", "reset_spent"
    loaded_credit: Optional[float] = None
    add_amount: Optional[float] = None
    spent_credit: Optional[float] = None
    alert_threshold: Optional[int] = None
    reset_period: Optional[bool] = True

@app.post("/api/settings/api-budgets/service")
async def update_single_service_budget(
    payload: ServiceBudgetActionSchema,
    user_info: dict = Depends(get_user_info),
    db: AsyncSession = Depends(get_db)
):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    prov = payload.provider.lower().strip()
    
    current_budgets = settings_db.get("api_budgets", {})
    if not isinstance(current_budgets, dict):
        current_budgets = {}
    
    for k, v in DEFAULT_SETTINGS["api_budgets"].items():
        if k not in current_budgets or not isinstance(current_budgets[k], dict):
            current_budgets[k] = dict(v)
    if prov not in current_budgets:
        current_budgets[prov] = {"loaded_credit": 0.0, "spent_credit": 0.0, "initial_spent": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None}

    now_utc_iso = datetime.datetime.utcnow().isoformat()
    now_str = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")

    if payload.action in ("add_credit", "new_topup"):
        amt = max(0.0, float(payload.add_amount or payload.loaded_credit or 0.0))
        if payload.reset_period or payload.action == "new_topup" or not current_budgets[prov].get("user_configured"):
            # Start a fresh tracking period from this top-up moment!
            current_budgets[prov]["loaded_credit"] = round(amt, 2)
            current_budgets[prov]["initial_spent"] = round(max(0.0, float(payload.spent_credit or 0.0)), 6)
            current_budgets[prov]["last_topup_at"] = now_utc_iso
            current_budgets[prov]["last_topup_display"] = now_str
        else:
            # Add onto existing loaded package without resetting the top-up timestamp
            prev_loaded = float(current_budgets[prov].get("loaded_credit", 0.0) or 0.0)
            current_budgets[prov]["loaded_credit"] = round(prev_loaded + amt, 2)
            if not current_budgets[prov].get("last_topup_at"):
                current_budgets[prov]["last_topup_at"] = now_utc_iso
                current_budgets[prov]["last_topup_display"] = now_str
        current_budgets[prov]["user_configured"] = True

    elif payload.action == "set_budget":
        if payload.loaded_credit is not None:
            current_budgets[prov]["loaded_credit"] = round(max(0.0, float(payload.loaded_credit)), 2)
        if payload.alert_threshold is not None:
            current_budgets[prov]["alert_threshold"] = max(10, min(100, int(payload.alert_threshold)))
        if payload.reset_period:
            # Reset tracking anchor to right now with the user's specified current spent amount
            current_budgets[prov]["last_topup_at"] = now_utc_iso
            current_budgets[prov]["last_topup_display"] = now_str
            current_budgets[prov]["initial_spent"] = round(max(0.0, float(payload.spent_credit or 0.0)), 6)
        elif payload.spent_credit is not None:
            live_data = await compute_live_api_budgets(db, target_tenant)
            period_auto = live_data.get(prov, {}).get("period_auto_cost", 0.0)
            desired_spent = max(0.0, float(payload.spent_credit))
            current_budgets[prov]["initial_spent"] = round(desired_spent - period_auto, 6)
        if not current_budgets[prov].get("last_topup_at"):
            current_budgets[prov]["last_topup_at"] = now_utc_iso
            current_budgets[prov]["last_topup_display"] = now_str
        current_budgets[prov]["user_configured"] = True

    elif payload.action == "reset_spent":
        current_budgets[prov]["last_topup_at"] = now_utc_iso
        current_budgets[prov]["last_topup_display"] = now_str
        current_budgets[prov]["initial_spent"] = 0.0
        current_budgets[prov]["spent_credit"] = 0.0
        current_budgets[prov]["user_configured"] = True

    current_budgets[prov]["last_updated"] = now_str
    settings_db["api_budgets"] = current_budgets
    save_settings(settings_db)
    add_system_log("API_BUDGET", "INFO", f"{prov.upper()} API bütçesi ve yükleme dönemi güncellendi ({payload.action}).")
    return await compute_live_api_budgets(db, target_tenant)

@app.post("/api/settings/api-budgets")
async def save_api_budgets(
    payload: Dict[str, Any] = Body(...),
    user_info: dict = Depends(get_user_info),
    db: AsyncSession = Depends(get_db)
):
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    current_budgets = settings_db.get("api_budgets", {})
    if not isinstance(current_budgets, dict):
        current_budgets = {}

    for k, v in DEFAULT_SETTINGS["api_budgets"].items():
        if k not in current_budgets or not isinstance(current_budgets[k], dict):
            current_budgets[k] = dict(v)

    now_utc_iso = datetime.datetime.utcnow().isoformat()
    now_str = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    for provider, data in payload.items():
        if isinstance(data, dict):
            if provider not in current_budgets or not isinstance(current_budgets[provider], dict):
                current_budgets[provider] = {"loaded_credit": 0.0, "spent_credit": 0.0, "initial_spent": 0.0, "alert_threshold": 80, "user_configured": False, "last_topup_at": None}
            if "loaded_credit" in data and data["loaded_credit"] is not None:
                current_budgets[provider]["loaded_credit"] = round(float(data["loaded_credit"]), 2)
                current_budgets[provider]["user_configured"] = True
                if not current_budgets[provider].get("last_topup_at"):
                    current_budgets[provider]["last_topup_at"] = now_utc_iso
                    current_budgets[provider]["last_topup_display"] = now_str
            if "alert_threshold" in data and data["alert_threshold"] is not None:
                current_budgets[provider]["alert_threshold"] = int(data["alert_threshold"])
            current_budgets[provider]["last_updated"] = now_str

    settings_db["api_budgets"] = current_budgets
    save_settings(settings_db)
    return await compute_live_api_budgets(db, target_tenant)

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
                    notify_missed_calls=q.notify_missed_calls,
                    smart_callback_enabled=getattr(q, "smart_callback_enabled", False),
                    smart_callback_max_wait_seconds=getattr(q, "smart_callback_max_wait_seconds", 60),
                    smart_callback_queue_threshold=getattr(q, "smart_callback_queue_threshold", 3),
                    smart_callback_max_retries=getattr(q, "smart_callback_max_retries", 3),
                    smart_callback_retry_interval=getattr(q, "smart_callback_retry_interval", 60),
                    smart_callback_priority_level=getattr(q, "smart_callback_priority_level", "high"),
                    smart_callback_outbound_trunk_id=getattr(q, "smart_callback_outbound_trunk_id", 1),
                    smart_callback_missed_call_auto=getattr(q, "smart_callback_missed_call_auto", True),
                    survey_enabled=getattr(q, "survey_enabled", False),
                    survey_scale=getattr(q, "survey_scale", "1-5"),
                    survey_question_announcement=getattr(q, "survey_question_announcement", ""),
                    survey_thank_you_announcement=getattr(q, "survey_thank_you_announcement", ""),
                    survey_thank_you_text=getattr(q, "survey_thank_you_text", ""),
                    survey_thank_you_voice=getattr(q, "survey_thank_you_voice", "tr-TR-EmelNeural"),
                    survey_questions=getattr(q, "survey_questions", []),
                    survey_timeout_sec=getattr(q, "survey_timeout_sec", 10),
                    survey_low_score_threshold=getattr(q, "survey_low_score_threshold", 2),
                    auto_pause_missed_enabled=getattr(q, "auto_pause_missed_enabled", False),
                    auto_pause_missed_count=getattr(q, "auto_pause_missed_count", 1),
                    auto_pause_disconnect_enabled=getattr(q, "auto_pause_disconnect_enabled", False),
                    auto_pause_disconnect_grace_sec=getattr(q, "auto_pause_disconnect_grace_sec", 15),
                    auto_pause_reconnect_mode=getattr(q, "auto_pause_reconnect_mode", "manual"),
                    auto_pause_notify_user=getattr(q, "auto_pause_notify_user", True),
                    auto_pause_notify_channels=getattr(q, "auto_pause_notify_channels", "both")
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

def resolve_user_name_by_ext_or_id(ext_or_id: str, users_override=None) -> str:
    val = str(ext_or_id or "").strip()
    if not val:
        return ""
    users_list = users_override if users_override is not None else settings_db.get("users", [])
    for u in users_list:
        u_ext = str((u.get("extension") if isinstance(u, dict) else getattr(u, "extension", "")) or "").strip()
        u_id = str((u.get("id") if isinstance(u, dict) else getattr(u, "id", "")) or "").strip()
        u_email = str((u.get("email") if isinstance(u, dict) else getattr(u, "email", "")) or "").strip()
        u_full = str((u.get("full_name") if isinstance(u, dict) else getattr(u, "full_name", "")) or (u.get("name") if isinstance(u, dict) else getattr(u, "name", "")) or "").strip()
        if val in (u_ext, u_id, u_email) and val != "":
            return u_full or f"Dahili {u_ext}"
    return ""


def resolve_call_agent_name_snapshot(caller: str, callee: str, status: str = "", hangup_source: str = "", users_override=None) -> str:
    c_caller = str(caller or "").strip()
    c_callee = str(callee or "").strip()
    h_src = str(hangup_source or "").strip()

    if h_src.startswith("transfer:"):
        tgt_ext = h_src.split("transfer:", 1)[1].strip()
        t_name = resolve_user_name_by_ext_or_id(tgt_ext, users_override=users_override)
        if t_name:
            return t_name

    u_caller = resolve_user_name_by_ext_or_id(c_caller, users_override=users_override)
    if u_caller:
        return u_caller
    u_callee = resolve_user_name_by_ext_or_id(c_callee, users_override=users_override)
    if u_callee:
        return u_callee

    ai_list = settings_db.get("ai_agents", [])
    for a in ai_list:
        a_ext = str(a.get("extension") or "").strip()
        a_id = str(a.get("id") or "").strip()
        a_name = str(a.get("name") or "").strip()
        if (a_ext and a_ext in (c_caller, c_callee)) or (a_id and a_id in (c_caller, c_callee)) or (a_name and a_name in (c_caller, c_callee)):
            return a_name

    if len(c_caller) >= 10 or c_caller.startswith("+") or c_caller.lower() == "ai":
        try:
            from backend.audiosocket_server import evaluate_call_flow_action
            cf_eval = evaluate_call_flow_action(c_callee)
            if cf_eval.get("action") == "extension" and cf_eval.get("target"):
                cf_u_name = resolve_user_name_by_ext_or_id(cf_eval.get("target"), users_override=users_override)
                if cf_u_name:
                    return cf_u_name
        except Exception:
            pass
        if ai_list and ai_list[0].get("name"):
            return str(ai_list[0].get("name")).strip()
        return "AI Asistan"

    return ""


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
            resolved_agent_name = resolve_call_agent_name_snapshot(caller, did)
            try:
                if caller:
                    res_u = await session.execute(select(SystemUser).where(or_(SystemUser.extension == str(caller), SystemUser.email == str(caller))))
                    user_found = res_u.scalars().first()
                    if user_found:
                        if getattr(user_found, "tenant_id", None):
                            call_tenant = user_found.tenant_id
                        if getattr(user_found, "full_name", None):
                            resolved_agent_name = user_found.full_name
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
                        if resolved_agent_name and not existing_bl_call.agent_name:
                            existing_bl_call.agent_name = resolved_agent_name
                    else:
                        new_call = Call(
                            id=call_id,
                            caller_number=caller or "Bilinmeyen",
                            callee_number=did or "s",
                            status="blocked",
                            tenant_id=call_tenant,
                            start_time=datetime.datetime.utcnow(),
                            end_time=datetime.datetime.utcnow(),
                            hangup_source=f"blacklist:{bl_reason}",
                            agent_name=resolved_agent_name or None
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
                        if resolved_agent_name and not existing_lim_call.agent_name:
                            existing_lim_call.agent_name = resolved_agent_name
                    else:
                        new_call = Call(
                            id=call_id,
                            caller_number=caller or "Bilinmeyen",
                            callee_number=did or "s",
                            status="rejected_limit",
                            tenant_id=call_tenant,
                            start_time=datetime.datetime.utcnow(),
                            end_time=datetime.datetime.utcnow(),
                            agent_name=resolved_agent_name or None
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

            if caller and did:
                try:
                    stmt_dup = select(Call).where(
                        Call.id != call_id,
                        Call.caller_number == caller,
                        Call.callee_number == did,
                        Call.recording_path.is_(None),
                        Call.start_time >= datetime.datetime.utcnow() - datetime.timedelta(seconds=30)
                    )
                    res_dup = await session.execute(stmt_dup)
                    for dup_c in res_dup.scalars().all():
                        await session.delete(dup_c)
                except Exception:
                    pass

            db_call = await session.get(Call, call_id)
            if not db_call:
                new_call = Call(
                    id=call_id,
                    caller_number=caller or "Bilinmeyen",
                    callee_number=did or "s",
                    status="in_progress",
                    tenant_id=call_tenant,
                    start_time=datetime.datetime.utcnow(),
                    agent_name=resolved_agent_name or None
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
                if resolved_agent_name and not db_call.agent_name:
                    db_call.agent_name = resolved_agent_name
                await session.commit()

            if did and (str(did).startswith("*8") or str(did).startswith("**")):
                # Directed/group pickup leg: do not overwrite or create a separate Call row for **ext
                set_live_extension_call_state(caller, "busy")
                target_ring_ext = str(did)[2:].strip() if str(did).startswith("**") else ""
                if target_ring_ext:
                    set_live_extension_call_state(target_ring_ext, None)
            else:
                set_live_extension_call_state(caller, "busy")
                set_live_extension_call_state(did, "ringing", caller_number=str(caller or ""), call_id=str(call_id or ""))

            print(f"[Asterisk Dialplan] Call registered successfully: {call_id} (Caller: {caller}, DID: {did}, Agent: {resolved_agent_name}, Tenant: {call_tenant})")
            if did and (str(did).startswith("*8") or str(did).startswith("**")):
                pickup_target = "Grup Çağrı Toplama (*8)" if str(did).startswith("*8") else f"Hedefli Çağrı Toplama ({did})"
                session.add(AgentBreakLog(
                    user_id=str(caller or ""),
                    extension=str(caller or ""),
                    agent_name=resolve_user_name_by_ext_or_id(caller) or None,
                    break_name=f"__ACTION__:call_pickup:{pickup_target}",
                    start_time=datetime.datetime.utcnow(),
                    end_time=datetime.datetime.utcnow(),
                    duration_seconds=0
                ))
                await session.commit()
    except Exception as e:
        print(f"[Register Call Endpoint Error]: {e}")
    return Response(content="ALLOW", media_type="text/plain")


live_extension_call_state = {}


def set_live_extension_call_state(ext_val: str, state: Optional[str], caller_number: str = "", call_id: str = ""):
    ext_s = str(ext_val or "").strip()
    if not ext_s or len(ext_s) > 6 or ext_s in ("s", "h") or ext_s.startswith("*"):
        return
    if not state:
        live_extension_call_state.pop(ext_s, None)
    else:
        prev = live_extension_call_state.get(ext_s) or {}
        live_extension_call_state[ext_s] = {
            "state": state,
            "caller_number": str(caller_number or prev.get("caller_number") or "").strip(),
            "call_id": str(call_id or prev.get("call_id") or "").strip(),
            "updated_at": datetime.datetime.utcnow()
        }


def get_live_user_call_state(ext_val: str, is_reg: bool) -> str:
    """
    Returns 'busy' (Kırmızı - Meşgul), 'ringing' (Turuncu - Çalıyor),
    'online' (Yeşil - Aktif/Müsait), or 'offline' (Gri - Aktif Değil).
    """
    ext_s = str(ext_val or "").strip()
    now_utc = datetime.datetime.utcnow()
    if ext_s:
        info = live_extension_call_state.get(ext_s)
        if info:
            st = info.get("state")
            upd = info.get("updated_at") or now_utc
            age_sec = (now_utc - upd).total_seconds()
            if st == "ringing" and age_sec <= 65:
                return "ringing"
            elif st == "busy" and age_sec <= 3600:
                return "busy"
            else:
                live_extension_call_state.pop(ext_s, None)

        try:
            from backend.services.ami_manager import get_extension_call_state
            ami_st = get_extension_call_state(ext_s)
            if ami_st in ("busy", "ringing"):
                return ami_st
        except Exception:
            pass

    return "online" if is_reg else "offline"


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
            set_live_extension_call_state(db_call.caller_number, None)
            set_live_extension_call_state(db_call.callee_number, None)
            hangup_src_val = str(db_call.hangup_source or "").strip()
            if hangup_src_val.startswith("pickup:"):
                picker_ext_val = hangup_src_val.split(":", 1)[1].strip()
                set_live_extension_call_state(picker_ext_val, None)

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
            elif hangup_src_val.startswith("pickup:"):
                resolved_status = "completed"
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


@app.post("/api/calls/webrtc-log")
async def log_webrtc_call_endpoint(payload: dict = Body(...), user_info: dict = Depends(get_user_info)):
    try:
        call_id = str(payload.get("call_id") or payload.get("sip_call_id") or "").strip()
        caller = str(payload.get("caller") or "").strip()
        callee = str(payload.get("callee") or "").strip()
        status = str(payload.get("status") or "in_progress").strip().lower()
        event_type = str(payload.get("event") or payload.get("action") or "start").strip().lower()
        duration = int(payload.get("duration") or 0)

        if not caller or not callee:
            return {"status": "ignored", "reason": "missing_numbers"}

        now_utc = datetime.datetime.utcnow()
        recent_cutoff = now_utc - datetime.timedelta(seconds=120)

        # Handle directed/group pickup (**1001 or *8) without creating a duplicate **1001 Call row
        if callee.startswith("**") or callee.startswith("*8"):
            target_ring_ext = callee[2:].strip() if callee.startswith("**") else ""
            if event_type in ("start", "ringing", "answer"):
                set_live_extension_call_state(caller, "busy")
                if target_ring_ext:
                    set_live_extension_call_state(target_ring_ext, None)
            elif event_type == "end":
                set_live_extension_call_state(caller, None)
                async with AsyncSessionLocal() as session:
                    stmt_pk = (
                        select(Call)
                        .where(
                            Call.hangup_source == f"pickup:{caller}",
                            Call.start_time >= now_utc - datetime.timedelta(minutes=30)
                        )
                        .order_by(Call.start_time.desc())
                    )
                    res_pk = await session.execute(stmt_pk)
                    pk_call = res_pk.scalars().first()
                    if pk_call:
                        pk_call.end_time = now_utc
                        pk_call.status = "completed"
                        await session.commit()
            return {"status": "pickup_handled"}

        if event_type in ("start", "ringing"):
            set_live_extension_call_state(caller, "busy")
            set_live_extension_call_state(callee, "ringing", caller_number=caller, call_id=call_id)
        elif event_type == "answer":
            set_live_extension_call_state(caller, "busy")
            set_live_extension_call_state(callee, "busy")
        elif event_type == "end":
            set_live_extension_call_state(caller, None)
            set_live_extension_call_state(callee, None)

        if not call_id:
            call_id = str(uuid.uuid4())

        async with AsyncSessionLocal() as session:
            stmt_recent = select(Call).where(
                Call.caller_number == caller,
                Call.callee_number == callee,
                Call.start_time >= now_utc - datetime.timedelta(minutes=60)
            ).order_by(Call.start_time.desc())
            res_recent = await session.execute(stmt_recent)
            recent_matches = res_recent.scalars().all()

            real_calls = [c for c in recent_matches if not str(c.id or "").startswith("webphone-")]
            webphone_dups = [c for c in recent_matches if str(c.id or "").startswith("webphone-")]

            db_call = None
            if real_calls:
                db_call = real_calls[0]
                for wd in webphone_dups:
                    if wd.start_time and db_call.start_time and abs((wd.start_time - db_call.start_time).total_seconds()) <= 30:
                        await session.delete(wd)
            elif call_id:
                db_call = await session.get(Call, call_id)
                if not db_call and recent_matches:
                    db_call = recent_matches[0]

            call_tenant = user_info.get("tenant_id") or "tenant-default"
            if call_tenant in ("all", "global"):
                call_tenant = "tenant-default"
            resolved_agent_name = resolve_call_agent_name_snapshot(caller, callee)
            try:
                res_u = await session.execute(select(SystemUser).where(SystemUser.extension == caller))
                u_found = res_u.scalars().first()
                if u_found:
                    if getattr(u_found, "tenant_id", None):
                        call_tenant = u_found.tenant_id
                    if getattr(u_found, "full_name", None):
                        resolved_agent_name = u_found.full_name
            except Exception:
                pass

            if not db_call:
                if event_type in ("start", "ringing", "answer"):
                    # Let Asterisk dialplan (/api/calls/register) create the single authoritative Call record
                    await session.commit()
                    return {"status": "deferred_to_asterisk", "call_id": call_id}
                db_call = Call(
                    id=call_id,
                    caller_number=caller,
                    callee_number=callee,
                    status="completed" if (event_type == "end" and duration > 0) else ("in_progress" if status == "ringing" else status),
                    tenant_id=call_tenant,
                    start_time=now_utc - datetime.timedelta(seconds=max(0, duration)) if event_type == "end" else now_utc,
                    end_time=now_utc if event_type == "end" else None,
                    agent_name=resolved_agent_name or None,
                    summary="Dahili Görüşme" if (len(caller) <= 5 and len(callee) <= 5) else None
                )
                session.add(db_call)
            else:
                if resolved_agent_name and not db_call.agent_name:
                    db_call.agent_name = resolved_agent_name
                if event_type == "answer":
                    db_call.status = "in_progress"
                elif event_type == "end":
                    if not db_call.end_time:
                        db_call.end_time = now_utc
                    if str(db_call.hangup_source or "").startswith("pickup:"):
                        db_call.status = "completed"
                    elif duration > 0 or status == "completed":
                        db_call.status = "completed"
                    elif db_call.status not in ("completed", "transferred", "blocked"):
                        db_call.status = status if status not in ("in_progress", "ringing") else "no_answer"
                    if not db_call.summary and len(caller) <= 5 and len(callee) <= 5:
                        db_call.summary = "Dahili Görüşme"

            await session.commit()
            return {"status": "success", "call_id": db_call.id, "call_status": db_call.status}
    except Exception as e_wlog:
        print(f"[WebRTC Call Log Error]: {e_wlog}")
        return {"status": "error", "message": str(e_wlog)}


def _get_user_group_peers_map(user_ext: str, user_id: str, all_users: list) -> dict:
    """
    Returns {peer_extension: group_name} for all extensions in the same
    subscriber_groups, call_pickup_groups, or queues as user_ext / user_id.
    Falls back to same-tenant internal extensions if no explicit groups match.
    """
    ext_s = str(user_ext or "").strip()
    uid_s = str(user_id or "").strip()
    peer_map = {}

    # Map user_id <-> extension
    id_to_ext = {}
    ext_to_id = {}
    user_tenant = "tenant-default"
    for u in all_users:
        u_e = str(u.get("extension") or "").strip()
        u_i = str(u.get("id") or "").strip()
        if u_e and u_i:
            id_to_ext[u_i] = u_e
            ext_to_id[u_e] = u_i
        if (ext_s and u_e == ext_s) or (uid_s and u_i == uid_s):
            if not ext_s and u_e:
                ext_s = u_e
            if not uid_s and u_i:
                uid_s = u_i
            user_tenant = u.get("tenant_id") or "tenant-default"

    def resolve_member_exts(raw_members: list) -> list:
        expanded = _expand_subscriber_groups_in_allowed_users(raw_members or [])
        exts = []
        for m in expanded:
            if isinstance(m, dict):
                m_val = str(m.get("extension") or m.get("id") or "").strip()
            else:
                m_val = str(m or "").strip()
            if not m_val:
                continue
            if m_val in id_to_ext:
                exts.append(id_to_ext[m_val])
            elif m_val in ext_to_id or (len(m_val) <= 5 and m_val.isdigit()):
                exts.append(m_val)
        return exts

    # 1. Subscriber Groups (Abone Grupları)
    for sg in settings_db.get("subscriber_groups", []):
        m_exts = resolve_member_exts(sg.get("extensions") or sg.get("members") or [])
        if ext_s in m_exts:
            g_name = str(sg.get("name") or "Abone Grubu").strip()
            for pe in m_exts:
                if pe != ext_s:
                    peer_map[pe] = g_name

    # 2. Call Pickup Groups (Çağrı Toplama Grupları)
    for pg in settings_db.get("call_pickup_groups", []):
        m_exts = resolve_member_exts(pg.get("extensions") or pg.get("members") or [])
        if ext_s in m_exts:
            g_name = str(pg.get("name") or "Çağrı Toplama Grubu").strip()
            for pe in m_exts:
                if pe != ext_s and pe not in peer_map:
                    peer_map[pe] = g_name

    # 3. Queues (Çağrı Kuyrukları)
    for q in settings_db.get("queues", []):
        m_exts = resolve_member_exts(q.get("queueMembers") or q.get("members") or [])
        if ext_s in m_exts:
            g_name = str(q.get("name") or "Kuyruk Grubu").strip()
            for pe in m_exts:
                if pe != ext_s and pe not in peer_map:
                    peer_map[pe] = g_name

    # 4. Fallback: if user has no explicit group memberships, include same-tenant extensions
    if not peer_map:
        for u in all_users:
            u_e = str(u.get("extension") or "").strip()
            u_t = u.get("tenant_id") or "tenant-default"
            if u_e and u_e != ext_s and u_t == user_tenant:
                peer_map[u_e] = "Abone Grubu"

    return peer_map


@app.get("/api/agent/group-ringing")
async def get_agent_group_ringing(
    extension: Optional[str] = None,
    user_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    ext_s = str(extension or "").strip()
    uid_s = str(user_id or "").strip()
    if not ext_s and not uid_s:
        return {"ringing_calls": []}

    all_users = list(settings_db.get("users", []))
    try:
        res_su = await db.execute(select(SystemUser))
        for su in res_su.scalars().all():
            su_ext = str(su.extension or "").strip()
            if su_ext and not any(str(u.get("extension") or "").strip() == su_ext for u in all_users):
                all_users.append({
                    "id": su.id,
                    "extension": su_ext,
                    "full_name": su.full_name,
                    "tenant_id": getattr(su, "tenant_id", "tenant-default")
                })
            if not ext_s and uid_s and str(su.id) == uid_s:
                ext_s = su_ext
    except Exception:
        pass

    peer_map = _get_user_group_peers_map(ext_s, uid_s, all_users)
    if not peer_map:
        return {"ringing_calls": []}

    now_utc = datetime.datetime.utcnow()
    ringing_calls = []

    from backend.services.ami_manager import get_extension_ringing_info

    for peer_ext, group_name in peer_map.items():
        if peer_ext == ext_s:
            continue

        is_ringing = False
        caller_num = ""
        call_id_val = ""

        info = live_extension_call_state.get(peer_ext)
        if info and info.get("state") == "ringing":
            upd = info.get("updated_at") or now_utc
            if (now_utc - upd).total_seconds() <= 60:
                is_ringing = True
                caller_num = str(info.get("caller_number") or "").strip()
                call_id_val = str(info.get("call_id") or "").strip()

        if not is_ringing:
            ami_ring = get_extension_ringing_info(peer_ext)
            if ami_ring:
                is_ringing = True
                caller_num = str(ami_ring.get("caller_number") or "").strip()

        if not is_ringing:
            continue

        # Look up active Call in DB if caller_num or call_id is missing
        if not caller_num or not call_id_val:
            try:
                stmt_c = (
                    select(Call)
                    .where(
                        Call.callee_number == peer_ext,
                        Call.status == "in_progress",
                        Call.start_time >= now_utc - datetime.timedelta(seconds=90)
                    )
                    .order_by(Call.start_time.desc())
                )
                res_c = await db.execute(stmt_c)
                act_c = res_c.scalars().first()
                if act_c:
                    if not caller_num:
                        caller_num = str(act_c.caller_number or "").strip()
                    if not call_id_val:
                        call_id_val = str(act_c.id or "").strip()
            except Exception:
                pass

        # Do not alert the agent if the agent themselves is the caller who dialed peer_ext
        if caller_num and caller_num == ext_s:
            continue

        ringing_name = resolve_user_name_by_ext_or_id(peer_ext) or f"Dahili {peer_ext}"
        caller_name = ""
        if caller_num:
            caller_name = resolve_user_name_by_ext_or_id(caller_num) or ""
            if not caller_name:
                try:
                    caller_name = await resolve_contact_name_by_phone(caller_num, db) or ""
                except Exception:
                    pass

        ringing_calls.append({
            "call_id": call_id_val or f"ring-{peer_ext}",
            "ringing_extension": peer_ext,
            "ringing_name": ringing_name,
            "caller_number": caller_num or "Bilinmeyen",
            "caller_name": caller_name,
            "group_name": group_name or "Grubunda Çağrı Var"
        })

    return {"ringing_calls": ringing_calls}


async def _record_call_pickup_in_db(picker_ext: str, ringing_ext: str, caller_num: str = "", call_id: str = ""):
    picker_s = str(picker_ext or "").strip()
    ringing_s = str(ringing_ext or "").strip()
    caller_s = str(caller_num or "").strip()
    cid_s = str(call_id or "").strip()

    if not picker_s or not ringing_s:
        return None

    set_live_extension_call_state(ringing_s, None)
    set_live_extension_call_state(picker_s, "busy")

    picker_name = resolve_user_name_by_ext_or_id(picker_s) or f"Dahili {picker_s}"
    ringing_name = resolve_user_name_by_ext_or_id(ringing_s) or f"Dahili {ringing_s}"
    now_utc = datetime.datetime.utcnow()

    async with AsyncSessionLocal() as session:
        db_call = None
        if cid_s and not cid_s.startswith("ring-"):
            db_call = await session.get(Call, cid_s)

        if not db_call:
            stmt = (
                select(Call)
                .where(
                    Call.callee_number == ringing_s,
                    Call.start_time >= now_utc - datetime.timedelta(seconds=120)
                )
                .order_by(Call.start_time.desc())
            )
            res = await session.execute(stmt)
            db_call = res.scalars().first()

        if not db_call:
            new_id = cid_s if (cid_s and not cid_s.startswith("ring-")) else str(uuid.uuid4())
            db_call = Call(
                id=new_id,
                caller_number=caller_s or "Bilinmeyen",
                callee_number=ringing_s,
                status="completed",
                tenant_id="tenant-default",
                start_time=now_utc,
                hangup_source=f"pickup:{picker_s}",
                agent_name=f"{picker_name} ({picker_s})",
                summary=f"Çağrı Çekme (Pickup): Arayan {caller_s or 'Bilinmeyen'} -> Aranan {ringing_s} ({ringing_name}) | Pickup ile Çeken: {picker_s} ({picker_name})"
            )
            session.add(db_call)
        else:
            if caller_s and (not db_call.caller_number or db_call.caller_number == "Bilinmeyen"):
                db_call.caller_number = caller_s
            else:
                caller_s = db_call.caller_number
            db_call.callee_number = ringing_s
            db_call.hangup_source = f"pickup:{picker_s}"
            db_call.status = "completed"
            db_call.agent_name = f"{picker_name} ({picker_s})"
            db_call.summary = f"Çağrı Çekme (Pickup): Arayan {caller_s or 'Bilinmeyen'} -> Aranan {ringing_s} ({ringing_name}) | Pickup ile Çeken: {picker_s} ({picker_name})"

        session.add(AgentBreakLog(
            user_id=picker_s,
            extension=picker_s,
            agent_name=picker_name,
            break_name=f"__ACTION__:call_pickup:{caller_s or 'Bilinmeyen'}->{ringing_s}->{picker_s}:{picker_name}",
            start_time=now_utc,
            end_time=now_utc,
            duration_seconds=0
        ))
        await session.commit()
        return db_call.id


@app.get("/api/webrtc/resolve_pickup_channel")
async def webrtc_resolve_pickup_channel(target_ext: str = "", picker_ext: str = ""):
    target_s = str(target_ext or "").strip()
    picker_s = str(picker_ext or "").strip()
    if not target_s:
        return Response(content="NONE", media_type="text/plain")

    info = live_extension_call_state.get(target_s) or {}
    caller_num = str(info.get("caller_number") or "").strip()
    call_id_val = str(info.get("call_id") or "").strip()

    from backend.services.ami_manager import find_ringing_channel_for_extension
    ch_name = await find_ringing_channel_for_extension(target_s)

    if picker_s:
        try:
            await _record_call_pickup_in_db(picker_s, target_s, caller_num=caller_num, call_id=call_id_val)
        except Exception as e_pk:
            print(f"[Resolve Pickup DB Error]: {e_pk}")

    return Response(content=ch_name if ch_name else "NONE", media_type="text/plain")


@app.post("/api/webrtc/pickup-call")
async def webrtc_pickup_call_endpoint(payload: dict = Body(...)):
    picker_extension = str(payload.get("picker_extension") or "").strip()
    ringing_extension = str(payload.get("ringing_extension") or "").strip()
    caller_number = str(payload.get("caller_number") or "").strip()
    call_id = str(payload.get("call_id") or "").strip()

    if not picker_extension or not ringing_extension:
        raise HTTPException(status_code=400, detail="Eksik çağrı çekme parametreleri.")

    recorded_id = await _record_call_pickup_in_db(
        picker_extension,
        ringing_extension,
        caller_num=caller_number,
        call_id=call_id
    )
    picker_name = resolve_user_name_by_ext_or_id(picker_extension) or f"Dahili {picker_extension}"
    return {
        "status": "success",
        "call_id": recorded_id,
        "picked_up_by_ext": picker_extension,
        "picked_up_by_name": picker_name
    }


@app.post("/api/webrtc/blind-transfer")
async def webrtc_blind_transfer_endpoint(payload: dict = Body(...)):
    agent_extension = str(payload.get("agent_extension") or "").strip()
    target = str(payload.get("target") or "").strip()
    remote_number = str(payload.get("remote_number") or "").strip()
    if not agent_extension or not target:
        raise HTTPException(status_code=400, detail="Eksik transfer parametreleri.")

    from backend.services.ami_manager import blind_transfer_agent_call
    ok = await blind_transfer_agent_call(agent_extension, target, remote_number=remote_number)

    set_live_extension_call_state(agent_extension, None)
    set_live_extension_call_state(target, "ringing", caller_number=remote_number)

    try:
        async with AsyncSessionLocal() as session:
            session.add(AgentBreakLog(
                user_id=agent_extension,
                extension=agent_extension,
                agent_name=resolve_user_name_by_ext_or_id(agent_extension) or None,
                break_name=f"__ACTION__:call_blind_transfer:{remote_number or 'Çağrı'} -> Hedef {target}",
                start_time=datetime.datetime.utcnow(),
                end_time=datetime.datetime.utcnow(),
                duration_seconds=0
            ))
            await session.commit()
    except Exception as e_tr:
        print(f"[WebRTC Blind Transfer Log Error]: {e_tr}")

    return {"status": "success" if ok else "fallback_refer", "transferred_via_ami": bool(ok)}


@app.post("/api/webrtc/attended-transfer")
async def webrtc_attended_transfer_endpoint(payload: dict = Body(...)):
    agent_extension = str(payload.get("agent_extension") or "").strip()
    remote_1 = str(payload.get("remote_number_1") or "").strip()
    remote_2 = str(payload.get("remote_number_2") or "").strip()
    if not agent_extension or (not remote_1 and not remote_2):
        raise HTTPException(status_code=400, detail="Eksik kontrollü transfer parametreleri.")

    from backend.services.ami_manager import attended_transfer_agent_calls
    ok = await attended_transfer_agent_calls(agent_extension, remote_1, remote_2)

    set_live_extension_call_state(agent_extension, None)
    if remote_1 and len(remote_1) <= 5:
        set_live_extension_call_state(remote_1, "busy")
    if remote_2 and len(remote_2) <= 5:
        set_live_extension_call_state(remote_2, "busy")

    try:
        async with AsyncSessionLocal() as session:
            session.add(AgentBreakLog(
                user_id=agent_extension,
                extension=agent_extension,
                agent_name=resolve_user_name_by_ext_or_id(agent_extension) or None,
                break_name=f"__ACTION__:call_attended_transfer:{remote_1 or 'Hat 1'} <-> {remote_2 or 'Hat 2'}",
                start_time=datetime.datetime.utcnow(),
                end_time=datetime.datetime.utcnow(),
                duration_seconds=0
            ))
            await session.commit()
    except Exception as e_tr:
        print(f"[WebRTC Attended Transfer Log Error]: {e_tr}")

    return {"status": "success" if ok else "fallback_refer", "transferred_via_ami": bool(ok)}


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
        stmt = stmt.where(
            or_(
                Call.caller_number == extension,
                Call.callee_number == extension,
                Call.hangup_source == f"pickup:{extension}"
            )
        )
        
    if call_id:
        stmt = stmt.where(Call.id.ilike(f"%{call_id}%"))
        
    stmt = stmt.order_by(Call.start_time.desc())
    result = await db.execute(stmt)
    raw_calls_list = result.scalars().all()

    if raw_calls_list:
        real_calls_by_pair = {}
        for c in raw_calls_list:
            cid_s = str(c.id or "")
            if not cid_s.startswith("webphone-"):
                pair_k = (str(c.caller_number or "").strip(), str(c.callee_number or "").strip())
                real_calls_by_pair.setdefault(pair_k, []).append(c)

        filtered_calls = []
        deleted_any_dup = False
        for c in raw_calls_list:
            cid_s = str(c.id or "")
            if cid_s.startswith("webphone-") and c.start_time:
                pair_k = (str(c.caller_number or "").strip(), str(c.callee_number or "").strip())
                matching_reals = real_calls_by_pair.get(pair_k, [])
                if any(rc.start_time and abs((rc.start_time - c.start_time).total_seconds()) <= 30 for rc in matching_reals):
                    try:
                        await db.delete(c)
                        deleted_any_dup = True
                    except Exception:
                        pass
                    continue
            filtered_calls.append(c)
        if deleted_any_dup:
            try:
                await db.commit()
            except Exception:
                pass
        calls_list = filtered_calls
    else:
        calls_list = []

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

                is_picked_up = hangup_src.startswith("pickup:")
                picked_up_by_ext = hangup_src.split(":", 1)[1].strip() if is_picked_up else ""
                picked_up_by_name = resolve_user_name_by_ext_or_id(picked_up_by_ext) if picked_up_by_ext else ""
                original_callee_name = resolve_user_name_by_ext_or_id(callee_str) if callee_str else ""

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
                        (log_ext and log_ext in (caller_str, callee_str, picked_up_by_ext))
                        or (log_uid and log_uid in (caller_str, callee_str, picked_up_by_ext))
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
                    elif act_key == "call_pickup" and not is_picked_up:
                        is_picked_up = True
                        picked_up_by_ext = log_ext or picked_up_by_ext
                        picked_up_by_name = log.agent_name or resolve_user_name_by_ext_or_id(picked_up_by_ext) or ""
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
                c.is_picked_up = is_picked_up
                c.picked_up_by_ext = picked_up_by_ext
                c.picked_up_by_name = picked_up_by_name
                c.original_callee = callee_str
                c.original_callee_name = original_callee_name

                if not getattr(c, "agent_name", None):
                    resolved_ag = resolve_call_agent_name_snapshot(caller_str, callee_str, c.status, hangup_src)
                    if resolved_ag:
                        c.agent_name = resolved_ag
                        any_agent_backfilled = True

            if locals().get("any_agent_backfilled"):
                try:
                    await db.commit()
                except Exception:
                    pass
        except Exception as enrich_err:
            print(f"[List Calls Enrich Warning]: {enrich_err}")

    return calls_list

@app.get("/api/calls/active")
async def get_active_calls(user_info: dict = Depends(get_user_info)):
    from backend.services.ami_manager import active_channels, call_id_to_asterisk_id, channel_states
    from backend.database.models import Call
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    now_utc = datetime.datetime.utcnow()

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
    seen_channels = set()
    for call in calls:
        ast_id = call_id_to_asterisk_id.get(call.id, call.id)
        ch_name = active_channels.get(ast_id) or active_channels.get(call.id)
        is_recent = False
        if call.start_time:
            age_sec = (now_utc - call.start_time.replace(tzinfo=None)).total_seconds()
            if 0 <= age_sec < 600:
                is_recent = True
        if not ch_name and is_recent:
            # Try matching from channel_states by caller or callee
            c_num = str(call.caller_number or "").strip()
            callee_num = str(call.callee_number or "").strip()
            for uid, st in list(channel_states.items()):
                if not isinstance(st, dict):
                    continue
                st_ch = str(st.get("channel") or "")
                st_caller = str(st.get("caller_num") or "")
                st_exten = str(st.get("exten") or "")
                if (c_num and (c_num in st_caller or c_num in st_ch)) or (callee_num and (callee_num == st_exten or f"PJSIP/{callee_num}-" in st_ch)):
                    ch_name = st_ch
                    break
        if ch_name or is_recent:
            if ch_name:
                seen_channels.add(ch_name)
            active_list.append({
                "id": call.id,
                "caller_number": call.caller_number,
                "caller_name": contact_map.get(call.caller_number) or resolve_contact_name_by_phone(contacts, call.caller_number),
                "callee_number": call.callee_number,
                "start_time": call.start_time.isoformat() if call.start_time else None,
                "channel": ch_name or "AudioSocket/AI",
                "agent_topic": call.agent_topic,
                "agent_notes": call.agent_notes,
                "handled_by": getattr(call, "handled_by", "ai") or "ai"
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

async def _auto_transcribe_call_recording(call_id: str, db: AsyncSession) -> list:
    """
    If a call has no rows in `transcripts` yet (e.g. human-to-human Webphone/SIP call)
    but has a `.wav` recording file on disk, automatically transcribes & diarizes
    the audio (with bilingual [[ORIG:XX]] tagging when foreign speech is detected),
    saves the turns to PostgreSQL `transcripts`, and returns them.
    """
    try:
        filename = f"{call_id}.wav"
        candidates = [
            os.path.join(RECORDINGS_DIR, filename),
            os.path.join("/var/spool/asterisk/monitor", filename),
            os.path.join("/mnt/nas/ai-recordings", filename),
        ]
        wav_path = None
        for p in candidates:
            if os.path.exists(p) and os.path.getsize(p) > 800:
                wav_path = p
                break
        if not wav_path:
            return []

        with open(wav_path, "rb") as f:
            audio_bytes = f.read()
        if not audio_bytes or len(audio_bytes) < 800:
            return []

        db_call = await db.get(Call, call_id)
        base_time = (db_call.start_time if db_call and db_call.start_time else datetime.datetime.utcnow())

        extracted_turns = []

        # 1. Primary: Gemini Multimodal Audio Diarization + Bilingual Translation
        try:
            keys = _resolve_translator_ai_keys({})
            gemini_key = keys.get("gemini_key") or os.getenv("GEMINI_API_KEY", "")
        except Exception:
            gemini_key = os.getenv("GEMINI_API_KEY", "")

        if gemini_key and len(audio_bytes) <= 18 * 1024 * 1024:
            raw_b64 = base64.b64encode(audio_bytes).decode("ascii")
            prompt_text = (
                "You are an expert call center transcription and translation engine. "
                "Listen to this phone call recording and transcribe the conversation turn by turn in chronological order. "
                "Identify each speaker as either \"customer\" (the external party/customer) or \"human\" (the call center agent/representative). "
                "IMPORTANT BILINGUAL RULE:\n"
                "- If a speaker talks in Turkish, set `text` to the exact Turkish speech, `original_foreign` to \"\", and `lang` to \"TR\".\n"
                "- If a speaker talks in a foreign language (e.g. English, German, Russian, Arabic, French), translate their speech accurately into Turkish in `text`, put their exact original foreign sentence in `original_foreign`, and put the 2-letter uppercase language code (e.g. \"EN\", \"DE\", \"RU\", \"AR\", \"FR\") in `lang`.\n"
                "- Ignore pure silence, dial tones, or unintelligible static.\n"
                "Return ONLY valid JSON in this exact format:\n"
                "{\"turns\": [{\"speaker\": \"customer\", \"text\": \"...\", \"original_foreign\": \"\", \"lang\": \"TR\"}, {\"speaker\": \"human\", \"text\": \"...\", \"original_foreign\": \"\", \"lang\": \"TR\"}]}"
            )
            for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
                try:
                    g_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    req_body = {
                        "contents": [
                            {
                                "parts": [
                                    {"text": prompt_text},
                                    {"inline_data": {"mime_type": "audio/wav", "data": raw_b64}}
                                ]
                            }
                        ],
                        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
                    }
                    async with httpx.AsyncClient(timeout=25.0) as client:
                        resp = await client.post(g_url, json=req_body)
                        if resp.status_code == 200:
                            r_json = resp.json()
                            cand_text = (
                                r_json.get("candidates", [{}])[0]
                                .get("content", {})
                                .get("parts", [{}])[0]
                                .get("text", "")
                            )
                            if cand_text:
                                cleaned = cand_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                                parsed = json.loads(cleaned)
                                turns_list = parsed.get("turns") if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])
                                if isinstance(turns_list, list) and turns_list:
                                    for idx, item in enumerate(turns_list):
                                        if not isinstance(item, dict):
                                            continue
                                        spk = str(item.get("speaker") or "customer").strip().lower()
                                        if spk not in ("customer", "human", "ai", "agent"):
                                            spk = "customer" if idx % 2 == 0 else "human"
                                        if spk == "agent":
                                            spk = "human"
                                        tr_txt = str(item.get("text") or "").strip()
                                        orig_for = str(item.get("original_foreign") or "").strip()
                                        lang_code = str(item.get("lang") or "TR").strip().upper()
                                        if not tr_txt and not orig_for:
                                            continue
                                        if orig_for and tr_txt and orig_for.lower() != tr_txt.lower() and lang_code != "TR":
                                            final_txt = f"{tr_txt}\n[[ORIG:{lang_code}]] {orig_for}"
                                        else:
                                            final_txt = tr_txt or orig_for
                                        extracted_turns.append((spk, final_txt))
                                    break
                except Exception as g_err:
                    print(f"[AutoTranscribe Gemini ({model_name}) Warning]: {g_err}")

        # 2. Fallback: Built-in Keyless Google Chromium Speech API v2 over 10-second WAV chunks
        if not extracted_turns:
            try:
                import struct
                sample_rate = 8000
                if audio_bytes[:4] == b"RIFF" and b"WAVE" in audio_bytes[:16]:
                    try:
                        sample_rate = struct.unpack("<I", audio_bytes[24:28])[0]
                        if sample_rate < 8000 or sample_rate > 48000:
                            sample_rate = 8000
                    except Exception:
                        sample_rate = 8000
                    data_idx = audio_bytes.find(b"data")
                    pcm_all = audio_bytes[data_idx + 8:] if data_idx != -1 else audio_bytes[44:]
                else:
                    pcm_all = audio_bytes[44:]

                bytes_per_sec = sample_rate * 2  # 16-bit mono
                chunk_bytes_len = bytes_per_sec * 10  # 10s chunks
                max_chunks = 12  # up to 2 minutes

                for c_idx in range(min(max_chunks, max(1, (len(pcm_all) + chunk_bytes_len - 1) // chunk_bytes_len))):
                    chunk_pcm = pcm_all[c_idx * chunk_bytes_len : (c_idx + 1) * chunk_bytes_len]
                    if len(chunk_pcm) < 1600:
                        continue
                    # Build minimal 44-byte WAV header for chunk
                    data_size = len(chunk_pcm)
                    wav_hdr = struct.pack(
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
                    chunk_wav = wav_hdr + chunk_pcm
                    tr_res, en_res = await asyncio.gather(
                        _keyless_chromium_stt_from_audio(chunk_wav, "audio/wav", "tr"),
                        _keyless_chromium_stt_from_audio(chunk_wav, "audio/wav", "en"),
                    )
                    tr_res = (tr_res or "").strip()
                    en_res = (en_res or "").strip()
                    if not tr_res and not en_res:
                        continue

                    spk = "customer" if len(extracted_turns) % 2 == 0 else "human"
                    # Determine if English recognition is stronger/clearer foreign speech
                    en_words = set(re.findall(r"[a-zA-Z]+", en_res.lower()))
                    common_en = {"the", "hello", "hi", "how", "are", "you", "can", "please", "help", "want", "need", "my", "is", "what", "where", "when", "yes", "no", "thank", "thanks", "good", "morning", "hotel", "room", "reservation", "price", "call", "speak", "english"}
                    if en_res and (not tr_res or len(en_words.intersection(common_en)) >= 2):
                        tr_trans = await _fallback_google_text_translate(en_res, "en", "tr")
                        if tr_trans and tr_trans.strip().lower() != en_res.lower():
                            extracted_turns.append((spk, f"{tr_trans.strip()}\n[[ORIG:EN]] {en_res}"))
                        else:
                            extracted_turns.append((spk, en_res))
                    else:
                        extracted_turns.append((spk, tr_res))
            except Exception as fb_err:
                print(f"[AutoTranscribe Chromium Fallback Warning]: {fb_err}")

        if not extracted_turns:
            return []

        saved_rows = []
        for idx, (spk, txt) in enumerate(extracted_turns):
            turn_ts = base_time + datetime.timedelta(seconds=idx * 4)
            tr_obj = Transcript(
                call_id=call_id,
                speaker=spk,
                text=txt,
                timestamp=turn_ts
            )
            db.add(tr_obj)
            saved_rows.append(tr_obj)

        await db.commit()
        for r in saved_rows:
            try:
                await db.refresh(r)
            except Exception:
                pass
        return saved_rows
    except Exception as auto_err:
        print(f"[AutoTranscribe Call Recording Error ({call_id})]: {auto_err}")
        return []


@app.get("/api/calls/{call_id}/transcripts")
@app.get("/api/calls/{call_id}/transcript")
async def get_call_transcripts(call_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Transcript).where(Transcript.call_id == call_id).order_by(Transcript.timestamp.asc())
    result = await db.execute(stmt)
    transcripts = result.scalars().all()

    if not transcripts:
        # First check if a sibling Call row (e.g. WebRTC session ID vs Asterisk CALL_UUID for the same live call)
        # already has live-recorded transcripts in PostgreSQL, so we never re-transcribe a call that was already transcribed live.
        try:
            call_res = await db.execute(select(Call).where(Call.id == call_id).limit(1))
            db_call = call_res.scalar_one_or_none()
            if db_call and db_call.start_time:
                win_start = db_call.start_time - datetime.timedelta(seconds=240)
                win_end = db_call.start_time + datetime.timedelta(seconds=240)
                sib_stmt = (
                    select(Call.id)
                    .where(
                        and_(
                            Call.id != call_id,
                            Call.start_time >= win_start,
                            Call.start_time <= win_end
                        )
                    )
                    .order_by(Call.start_time.desc())
                )
                sib_res = await db.execute(sib_stmt)
                sibling_ids = [r for r in sib_res.scalars().all() if r]
                for sib_id in sibling_ids:
                    tr_sib_res = await db.execute(
                        select(Transcript).where(Transcript.call_id == sib_id).order_by(Transcript.timestamp.asc())
                    )
                    sib_transcripts = tr_sib_res.scalars().all()
                    if sib_transcripts:
                        copied_rows = []
                        for st in sib_transcripts:
                            new_tr = Transcript(
                                call_id=call_id,
                                speaker=st.speaker,
                                text=st.text,
                                timestamp=st.timestamp
                            )
                            db.add(new_tr)
                            copied_rows.append(new_tr)
                        await db.commit()
                        transcripts = copied_rows
                        break
        except Exception as sib_err:
            print(f"[Transcript Sibling Lookup Warning ({call_id})]: {sib_err}")

    if not transcripts:
        transcripts = await _auto_transcribe_call_recording(call_id, db)

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
@app.websocket("/api/ws/transcripts/{call_id}")
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

def check_user_monitor_permission(user_id_or_ext: str, mode: str = "listen") -> bool:
    """
    Checks if a user (by id, extension, username, or email) has role permission
    to perform call monitoring:
      - 'listen'  (Fısıldama / Sessiz Dinleme): call_monitor:listen, ai_whisper:read/write/access
      - 'whisper' (Sufle Verme):                call_monitor:whisper, ai_whisper:write/access
      - 'barge'   (Araya Girme):                call_monitor:barge, ai_whisper:write/access
    """
    ident = str(user_id_or_ext or "").strip()
    if not ident or ident.lower() == "admin":
        return True

    users_list = settings_db.get("users", [])
    matched_user = None
    for u in users_list:
        if (
            str(u.get("id") or "").strip() == ident
            or str(u.get("extension") or "").strip() == ident
            or str(u.get("username") or "").strip().lower() == ident.lower()
            or str(u.get("email") or "").strip().lower() == ident.lower()
        ):
            matched_user = u
            break

    if not matched_user:
        try:
            from backend.database.config import SyncSessionLocal
            with SyncSessionLocal() as s_u:
                q_u = s_u.query(SystemUser).filter(
                    or_(
                        SystemUser.extension == ident,
                        SystemUser.email == ident
                    )
                ).first()
                if q_u:
                    matched_user = {
                        "id": q_u.id,
                        "extension": q_u.extension,
                        "role": q_u.role
                    }
        except Exception:
            pass

    if not matched_user:
        return False

    role_code = str(matched_user.get("role") or "agent").strip().lower()
    if role_code == "admin":
        return True

    roles_list = settings_db.get("roles", [])
    role_obj = next((r for r in roles_list if str(r.get("role_code") or "").strip().lower() == role_code), None)
    if not role_obj:
        return role_code == "supervisor"

    perms = set(str(p).strip() for p in (role_obj.get("permissions") or []))
    norm_mode = str(mode or "listen").strip().lower()

    # Check if explicit call_monitor:* permissions exist on this role
    has_any_explicit_cm = any(p.startswith("call_monitor:") for p in perms)
    if norm_mode in ("barge", "araya_gir"):
        if "call_monitor:barge" in perms:
            return True
        if not has_any_explicit_cm and ("ai_whisper:write" in perms or "ai_whisper:access" in perms):
            return True
        return False
    elif norm_mode in ("whisper", "sufle"):
        if "call_monitor:whisper" in perms:
            return True
        if not has_any_explicit_cm and ("ai_whisper:write" in perms or "ai_whisper:access" in perms):
            return True
        return False
    else:
        if "call_monitor:listen" in perms:
            return True
        if not has_any_explicit_cm and ("ai_whisper:read" in perms or "ai_whisper:write" in perms or "ai_whisper:access" in perms):
            return True
        return False


def resolve_supervisor_extension(user_id_or_ext: str = None, fallback_ext: str = "1000") -> str:
    ident = str(user_id_or_ext or "").strip()
    users_list = settings_db.get("users", [])
    if ident:
        for u in users_list:
            if (
                str(u.get("id") or "").strip() == ident
                or str(u.get("extension") or "").strip() == ident
                or str(u.get("username") or "").strip().lower() == ident.lower()
                or str(u.get("email") or "").strip().lower() == ident.lower()
            ):
                ext = str(u.get("extension") or "").strip()
                if ext:
                    return ext
    if fallback_ext and fallback_ext not in ("200", "undefined", "null", ""):
        return str(fallback_ext).strip()
    # If fallback_ext is "200", check if any active user actually has 200; otherwise pick first admin/supervisor extension or 1000
    if any(str(u.get("extension") or "").strip() == "200" for u in users_list if u.get("is_active", True) is not False):
        return "200"
    for u in users_list:
        if u.get("is_active", True) is not False and u.get("extension"):
            return str(u.get("extension")).strip()
    return "1000"


async def _resolve_chanspy_internal(caller: str, exten: str, mode: str, channel: str, db: AsyncSession) -> str:
    import urllib.parse
    from backend.services.ami_manager import resolve_active_channel_for_spy

    raw_caller = urllib.parse.unquote(caller or "").strip()
    raw_exten = urllib.parse.unquote(exten or "").strip().replace("%23", "#")
    raw_channel = urllib.parse.unquote(channel or "").strip()

    chan_ext = ""
    if "/" in raw_channel:
        after_slash = raw_channel.split("/", 1)[1]
        chan_ext = after_slash.split("-", 1)[0].split("@", 1)[0].strip()

    caller_ext = raw_caller or chan_ext
    if not caller_ext:
        return "DENY:NO_CALLER:NONE"

    pbx_cfg = settings_db.get("pbx", {}) if isinstance(settings_db.get("pbx"), dict) else {}
    num_plan = pbx_cfg.get("numbering_plan", {}) if isinstance(pbx_cfg.get("numbering_plan"), dict) else {}
    mon_cfg = num_plan.get("call_monitoring", {}) if isinstance(num_plan.get("call_monitoring"), dict) else {}

    p_listen = str(mon_cfg.get("listen") or "*551*").strip() or "*551*"
    p_whisper = str(mon_cfg.get("whisper") or "*552*").strip() or "*552*"
    p_barge = str(mon_cfg.get("barge") or "*553*").strip() or "*553*"

    resolved_mode = str(mode or "").strip().lower()
    target_ext = ""

    for pfx, m_key in [(p_listen, "listen"), (p_whisper, "whisper"), (p_barge, "barge")]:
        pfx_no_star = pfx.rstrip("*") if pfx.endswith("*") and len(pfx.rstrip("*")) >= 2 else pfx
        if raw_exten.startswith(pfx):
            if not resolved_mode:
                resolved_mode = m_key
            target_ext = raw_exten[len(pfx):].strip("*#")
            break
        elif raw_exten.startswith(pfx_no_star):
            if not resolved_mode:
                resolved_mode = m_key
            target_ext = raw_exten[len(pfx_no_star):].strip("*#")
            break

    if not resolved_mode:
        resolved_mode = "listen"

    # Check Role Permission for caller_ext
    if not check_user_monitor_permission(caller_ext, mode=resolved_mode):
        print(f"[ChanSpy Desk Phone] Permission DENIED for caller={caller_ext}, mode={resolved_mode}, dialed={raw_exten}")
        add_system_log("SECURITY", "WARNING", f"Yetkisiz Çağrı Dinleme/Araya Girme Girişimi Engellendi: Dahili {caller_ext} -> {raw_exten} ({resolved_mode})")
        return "DENY:UNAUTHORIZED:NONE"

    # Check if there is an ongoing Call in DB matching target_ext (or any ongoing AI call if target_ext is empty/ai/0/200)
    matched_call_id = None
    matched_caller_num = None
    try:
        stmt_c = select(Call).where(Call.status.in_(["ongoing", "in_progress"])).order_by(Call.start_time.desc())
        res_c = await db.execute(stmt_c)
        ongoing_calls = res_c.scalars().all()
        for oc in ongoing_calls:
            if not target_ext or target_ext in ("0", "200", "ai"):
                matched_call_id = oc.id
                matched_caller_num = oc.caller_number
                break
            if str(oc.caller_number) == target_ext or str(oc.callee_number) == target_ext:
                matched_call_id = oc.id
                matched_caller_num = oc.caller_number
                break
    except Exception:
        pass

    spy_channel = await resolve_active_channel_for_spy(
        call_id=matched_call_id,
        target_extension=target_ext or "ai",
        caller_number=matched_caller_num,
        mode=resolved_mode
    )
    if not spy_channel:
        print(f"[ChanSpy Desk Phone] No active channel found for caller={caller_ext}, target={target_ext}, dialed={raw_exten}")
        return "DENY:NO_ACTIVE_CALL:NONE"

    # Do not allow spying on own channel
    if caller_ext and (spy_channel.lower().startswith(f"pjsip/{caller_ext.lower()}-") or spy_channel == raw_channel):
        return "DENY:SELF_CHANNEL:NONE"

    if resolved_mode == "barge":
        flags = "qBE"
        act_lbl = "Araya Girme (Barge-In)"
    elif resolved_mode == "whisper":
        flags = "qwE"
        act_lbl = "Sufle Verme (Whisper)"
    else:
        flags = "qE"
        act_lbl = "Canlı Dinleme / Fısıldama"

    try:
        db.add(AgentBreakLog(
            user_id=str(caller_ext),
            extension=str(caller_ext),
            break_name=f"__ACTION__:call_{resolved_mode}:{act_lbl} (Masa Tel -> {target_ext or spy_channel})",
            start_time=datetime.datetime.utcnow(),
            end_time=datetime.datetime.utcnow(),
            duration_seconds=0
        ))
        await db.commit()
    except Exception:
        pass

    add_system_log("PBX", "INFO", f"Dahili {caller_ext} masa telefonundan {act_lbl} başlattı -> Hedef: {target_ext or spy_channel}")
    print(f"[ChanSpy Desk Phone] ALLOW: caller={caller_ext} -> channel={spy_channel}, flags={flags}")
    return f"ALLOW:{spy_channel}:{flags}"


@app.get("/api/calls/resolve_chanspy")
async def resolve_chanspy_endpoint(
    caller: str = "",
    exten: str = "",
    mode: str = "",
    channel: str = "",
    db: AsyncSession = Depends(get_db)
):
    from fastapi import Response
    res_str = await _resolve_chanspy_internal(caller=caller, exten=exten, mode=mode, channel=channel, db=db)
    return Response(content=res_str, media_type="text/plain")


class CallMonitorPayload(BaseModel):
    call_id: Optional[str] = None
    agent_ext: Optional[str] = None
    target_ext: Optional[str] = None
    caller_number: Optional[str] = None
    mode: Optional[str] = "listen"
    user_id: Optional[str] = None


@app.post("/api/calls/{call_id}/spy")
@app.post("/api/calls/monitor")
async def spy_active_call(
    request: Request,
    call_id: str = "active",
    agent_ext: str = "200",
    mode: str = "listen",
    target_ext: str = "",
    caller_number: str = "",
    user_id: str = "",
    db: AsyncSession = Depends(get_db)
):
    from backend.services.ami_manager import spy_on_call

    body_data = {}
    try:
        body_data = await request.json()
        if not isinstance(body_data, dict):
            body_data = {}
    except Exception:
        body_data = {}

    eff_call_id = str(body_data.get("call_id") or call_id or "").strip()
    if eff_call_id in ("active", "none", "null", "undefined"):
        eff_call_id = ""
    eff_mode = str(body_data.get("mode") or mode or "listen").strip().lower()
    eff_target_ext = str(body_data.get("target_ext") or target_ext or "").strip()
    eff_caller_num = str(body_data.get("caller_number") or caller_number or "").strip()
    eff_user_id = str(
        body_data.get("user_id")
        or user_id
        or request.headers.get("X-User-ID")
        or request.headers.get("x-user-id")
        or ""
    ).strip()
    raw_agent_ext = str(body_data.get("agent_ext") or agent_ext or "").strip()

    # Verify Role Permission
    perm_subject = eff_user_id or raw_agent_ext
    if perm_subject and not check_user_monitor_permission(perm_subject, mode=eff_mode):
        raise HTTPException(
            status_code=403,
            detail="Bu işlem (Dinleme / Sufle / Araya Girme) için rol yetkiniz bulunmamaktadır."
        )

    resolved_sup_ext = resolve_supervisor_extension(eff_user_id or raw_agent_ext, fallback_ext=raw_agent_ext)

    # If call_id is provided, enrich target_ext / caller_number from DB Call record if missing
    if eff_call_id and (not eff_caller_num or not eff_target_ext):
        try:
            db_call = await db.get(Call, eff_call_id)
            if db_call:
                if not eff_caller_num and db_call.caller_number:
                    eff_caller_num = str(db_call.caller_number)
                if not eff_target_ext and db_call.callee_number:
                    eff_target_ext = str(db_call.callee_number)
        except Exception:
            pass

    success = await spy_on_call(
        call_id=eff_call_id,
        agent_extension=resolved_sup_ext,
        mode=eff_mode,
        target_extension=eff_target_ext,
        caller_number=eff_caller_num
    )
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Aktif çağrı kanalı bulunamadı veya dahili ({resolved_sup_ext}) telefonunuza bağlanılamadı."
        )

    mode_tr_map = {
        "listen": ("call_spy", "Fısıldama / Canlı Dinleme"),
        "whisper": ("call_whisper", "Sufle Verme (Koçluk)"),
        "barge": ("call_barge", "Araya Girme (Üçlü Konferans)")
    }
    act_code, act_label = mode_tr_map.get(eff_mode, ("call_spy", "Canlı Dinleme"))
    target_desc = eff_target_ext or eff_caller_num or (eff_call_id[:8] if eff_call_id else "Aktif Çağrı")

    try:
        db.add(AgentBreakLog(
            user_id=str(eff_user_id or resolved_sup_ext),
            extension=str(resolved_sup_ext),
            break_name=f"__ACTION__:{act_code}:{act_label} ({target_desc})",
            start_time=datetime.datetime.utcnow(),
            end_time=datetime.datetime.utcnow(),
            duration_seconds=0
        ))
        await db.commit()
    except Exception:
        pass

    add_system_log("PBX", "INFO", f"Dahili {resolved_sup_ext} web panelinden {act_label} başlattı -> Hedef: {target_desc}")
    return {
        "status": "success",
        "mode": eff_mode,
        "supervisor_extension": resolved_sup_ext,
        "message": f"{act_label} başlatıldı (Dahili: {resolved_sup_ext} -> Hedef: {target_desc})"
    }

class WhisperPayload(BaseModel):
    text: str

@app.post("/api/calls/{call_id}/whisper")
async def whisper_to_call(call_id: str, payload: WhisperPayload, request: Request = None):
    import json
    # Check if whisper feature is enabled in system settings
    if not settings_db.get("pbx", {}).get("auto_whisper_enabled", True):
        raise HTTPException(status_code=400, detail="Fısıldama özelliği sistem genelinde devre dışı bırakılmıştır.")

    if request is not None:
        uid_hdr = request.headers.get("X-User-ID") or request.headers.get("x-user-id") or ""
        if uid_hdr and not check_user_monitor_permission(uid_hdr, mode="whisper"):
            raise HTTPException(status_code=403, detail="Sufle / Fısıldama göndermek için rol yetkiniz bulunmamaktadır.")
        
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
        return {"status": "success", "message": "Fısıldama / Sufle başarıyla iletildi."}
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

        # Missed / Unanswered calls today
        missed_stmt = select(func.count(Call.id)).where(
            Call.start_time >= today_start_utc,
            Call.status.in_(["no_answer", "missed", "failed", "busy", "cancelled"])
        )
        missed_res = await session.execute(missed_stmt)
        missed_calls_count = missed_res.scalar() or 0

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
                max(0, (c.end_time - c.start_time).total_seconds())
                for c in completed_calls if c.end_time and c.start_time
            ]
            avg_hold_time = round(sum(durations) / len(durations)) if durations else 0
        else:
            avg_hold_time = 0

        # Active Calls Count
        active_calls_stmt = select(func.count(Call.id)).where(Call.status.in_(["in_progress", "ongoing"]))
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
            "missedCallsCount": missed_calls_count,
            "totalTodayCalls": total_today_calls,
            "avgHoldTime": avg_hold_time,
            "serviceLevel": round(service_level, 1),
            "recentLogs": recent_logs
        }

@app.get("/api/wallboard/layout")
async def get_user_wallboard_layout(
    user_id: Optional[str] = None,
    user_info: dict = Depends(get_user_info)
):
    tenant_id = user_info.get("tenant_id") or "tenant-default"
    uid = str(user_id or user_info.get("user_id") or "admin").strip() or "admin"
    layouts = settings_db.get("wallboard_layouts")
    if not isinstance(layouts, dict):
        layouts = {}
    key = f"{tenant_id}:{uid}"
    saved = layouts.get(key) or layouts.get(uid) or None
    return {"status": "success", "layout": saved}

@app.post("/api/wallboard/layout")
async def save_user_wallboard_layout(
    payload: dict,
    user_info: dict = Depends(get_user_info)
):
    tenant_id = user_info.get("tenant_id") or "tenant-default"
    uid = str(payload.get("user_id") or user_info.get("user_id") or "admin").strip() or "admin"
    layout_data = payload.get("layout")
    if not isinstance(layout_data, dict):
        raise HTTPException(status_code=400, detail="Geçersiz layout verisi.")
    if not isinstance(settings_db.get("wallboard_layouts"), dict):
        settings_db["wallboard_layouts"] = {}
    key = f"{tenant_id}:{uid}"
    settings_db["wallboard_layouts"][key] = layout_data
    settings_db["wallboard_layouts"][uid] = layout_data
    save_settings(settings_db)
    return {"status": "success", "layout": layout_data}

@app.get("/api/reports/agents")
async def get_reports_agents():
    from backend.database.models import SystemUser, Call, AgentBreakLog
    from backend.services.ami_manager import active_channels, channel_states
    from backend.services.agent_presence import active_agent_status, update_agent_state
    import datetime

    now_utc = datetime.datetime.utcnow()
    today_start_utc = (now_utc + datetime.timedelta(hours=3)).replace(hour=0, minute=0, second=0, microsecond=0) - datetime.timedelta(hours=3)
    settings = load_settings()
    breaks_cfg = settings.get("breaks", [])

    async with AsyncSessionLocal() as session:
        stmt = select(SystemUser)
        result = await session.execute(stmt)
        users = result.scalars().all()

        # Fetch ongoing calls from DB to correlate call_id & caller_number
        stmt_ongoing = select(Call).where(Call.status.in_(["ongoing", "in_progress"])).order_by(Call.start_time.desc())
        res_ongoing = await session.execute(stmt_ongoing)
        ongoing_calls = res_ongoing.scalars().all()

        # Fetch today's calls to compute per-agent daily call counts
        stmt_today = select(Call).where(Call.start_time >= today_start_utc)
        res_today = await session.execute(stmt_today)
        today_calls = res_today.scalars().all()

        # Fetch today's agent session/break logs to restore login/break state accurately
        stmt_brk = select(AgentBreakLog).where(
            AgentBreakLog.start_time >= today_start_utc
        ).order_by(AgentBreakLog.start_time.desc(), AgentBreakLog.id.desc())
        res_brk = await session.execute(stmt_brk)
        today_break_logs = res_brk.scalars().all()

        ext_call_counts = {}
        for tc in today_calls:
            c_from = str(tc.caller_number or "").strip()
            c_to = str(tc.callee_number or "").strip()
            if c_from:
                ext_call_counts[c_from] = ext_call_counts.get(c_from, 0) + 1
            if c_to and c_to != c_from:
                ext_call_counts[c_to] = ext_call_counts.get(c_to, 0) + 1

        agents_state = {}
        for u in users:
            if not u.extension:
                continue

            u_ext_str = str(u.extension).strip()
            u_id_str = str(u.id)

            is_in_call = False
            caller_number = None
            matched_call_id = None
            call_duration = 0

            # 1. Check channel_states (dict) and active_channels (str or dict)
            pjsip_pfx = f"pjsip/{u_ext_str.lower()}-"
            sip_pfx = f"sip/{u_ext_str.lower()}-"

            for uid, info in list(channel_states.items()):
                if isinstance(info, dict):
                    ch_s = str(info.get("channel") or "").lower()
                    c_num = str(info.get("caller") or "").strip()
                    e_num = str(info.get("exten") or "").strip()
                    if ch_s.startswith(pjsip_pfx) or ch_s.startswith(sip_pfx) or c_num == u_ext_str or e_num == u_ext_str:
                        is_in_call = True
                        caller_number = e_num if c_num == u_ext_str else c_num
                        break

            if not is_in_call:
                for uid, ch_val in list(active_channels.items()):
                    if isinstance(ch_val, dict):
                        c_num = str(ch_val.get("caller_num") or ch_val.get("caller") or "").strip()
                        e_num = str(ch_val.get("exten") or "").strip()
                        if c_num == u_ext_str or e_num == u_ext_str:
                            is_in_call = True
                            caller_number = e_num if c_num == u_ext_str else c_num
                            break
                    elif isinstance(ch_val, str):
                        if ch_val.lower().startswith(pjsip_pfx) or ch_val.lower().startswith(sip_pfx):
                            is_in_call = True
                            break

            # 2. Match with ongoing Call records in DB
            call_since_utc = None
            for oc in ongoing_calls:
                oc_caller = str(oc.caller_number or "").strip()
                oc_callee = str(oc.callee_number or "").strip()
                if oc_caller == u_ext_str or oc_callee == u_ext_str:
                    is_in_call = True
                    matched_call_id = oc.id
                    if oc.start_time:
                        dt_call = oc.start_time.replace(tzinfo=None)
                        call_since_utc = dt_call.isoformat() + "Z"
                        call_duration = max(0, int((now_utc - dt_call).total_seconds()))
                    if not caller_number:
                        caller_number = oc_callee if oc_caller == u_ext_str else oc_caller
                    break

            user_logs = [
                b for b in today_break_logs
                if str(b.user_id or "").strip() in (u_id_str, u_ext_str)
                or str(b.extension or "").strip() in (u_id_str, u_ext_str)
            ]
            active_brk_log = next(
                (b for b in user_logs if b.end_time is None and not str(b.break_name or "").startswith("__")),
                None
            )

            agent_sess = (
                active_agent_status.get(u.id) or
                active_agent_status.get(u_id_str) or
                active_agent_status.get(u_ext_str) or
                {}
            )

            if agent_sess and agent_sess.get("status_since_utc"):
                is_logged_in = bool(agent_sess.get("is_logged_in", False))
                session_status = agent_sess.get("status", "offline")
            elif active_brk_log:
                is_logged_in = True
                session_status = "break"
            elif user_logs and str(user_logs[0].break_name or "") != "__LOGOUT__":
                is_logged_in = True
                session_status = "online"
                restored_dt = (user_logs[0].end_time or user_logs[0].start_time).replace(tzinfo=None)
                agent_sess = update_agent_state(
                    is_logged_in=True,
                    status="online",
                    current_break=None,
                    user_id=u_id_str,
                    extension=u_ext_str,
                    status_since_utc=restored_dt.isoformat() + "Z"
                )
            else:
                is_logged_in = False
                session_status = "offline"

            status = "Çevrimdışı"
            break_type = None
            break_id = None
            break_color = None
            break_max_min = 0
            is_auto_brk = False
            status_duration = 0
            status_since_utc = None

            if is_logged_in:
                if is_in_call:
                    status = "Görüşmede"
                    status_duration = call_duration
                    status_since_utc = call_since_utc or (now_utc - datetime.timedelta(seconds=call_duration)).isoformat() + "Z"
                elif session_status == "break" or active_brk_log:
                    status = "Molada"
                    curr_b = agent_sess.get("current_break") or {}
                    break_type = (active_brk_log.break_name if active_brk_log else None) or curr_b.get("name") or "Mola"
                    break_id = curr_b.get("id")
                    from backend.services.agent_presence import is_auto_break_name, AUTO_BREAK_DEFAULT_COLOR
                    is_auto_brk = bool(curr_b.get("is_auto_break") or is_auto_break_name(break_type))
                    break_color = curr_b.get("color") or (AUTO_BREAK_DEFAULT_COLOR if is_auto_brk else "#eab308")
                    break_max_min = int(curr_b.get("max_duration_minutes") or 0)
                    for b_cfg in breaks_cfg:
                        if str(b_cfg.get("name", "")).strip().lower() == str(break_type).strip().lower():
                            if not break_id:
                                break_id = b_cfg.get("id")
                            if not curr_b.get("color") and b_cfg.get("color"):
                                break_color = b_cfg.get("color")
                            if not break_max_min:
                                break_max_min = int(b_cfg.get("max_duration_minutes") or 0)
                            break

                    if active_brk_log and active_brk_log.start_time:
                        dt_s = active_brk_log.start_time.replace(tzinfo=None)
                        status_since_utc = dt_s.isoformat() + "Z"
                        status_duration = max(0, int((now_utc - dt_s).total_seconds()))
                    else:
                        b_start_str = curr_b.get("start_time_utc") or agent_sess.get("status_since_utc")
                        if b_start_str:
                            try:
                                dt_s = datetime.datetime.fromisoformat(str(b_start_str).replace("Z", ""))
                                status_since_utc = dt_s.isoformat() + "Z"
                                status_duration = max(0, int((now_utc - dt_s).total_seconds()))
                            except Exception:
                                status_duration = 0
                elif session_status == "acw":
                    status = "ACW / İşlemde"
                    sess_since = agent_sess.get("status_since_utc")
                    if sess_since:
                        try:
                            dt_acw = datetime.datetime.fromisoformat(str(sess_since).replace("Z", ""))
                            status_since_utc = dt_acw.isoformat() + "Z"
                            status_duration = max(0, int((now_utc - dt_acw).total_seconds()))
                        except Exception:
                            status_since_utc = now_utc.isoformat() + "Z"
                            status_duration = 0
                    else:
                        status_since_utc = now_utc.isoformat() + "Z"
                        status_duration = 0
                else:
                    status = "Müsait"
                    avail_candidates = []
                    sess_since = agent_sess.get("status_since_utc")
                    if sess_since:
                        try:
                            avail_candidates.append(datetime.datetime.fromisoformat(str(sess_since).replace("Z", "")))
                        except Exception:
                            pass
                    if user_logs:
                        dt_log = (user_logs[0].end_time or user_logs[0].start_time)
                        if dt_log:
                            avail_candidates.append(dt_log.replace(tzinfo=None))
                    for tc in today_calls:
                        tc_caller = str(tc.caller_number or "").strip()
                        tc_callee = str(tc.callee_number or "").strip()
                        if (tc_caller == u_ext_str or tc_callee == u_ext_str) and tc.end_time:
                            avail_candidates.append(tc.end_time.replace(tzinfo=None))

                    if avail_candidates:
                        dt_avail = max(avail_candidates)
                        status_since_utc = dt_avail.isoformat() + "Z"
                        status_duration = max(0, int((now_utc - dt_avail).total_seconds()))
                    else:
                        status_since_utc = now_utc.isoformat() + "Z"
                        status_duration = 0

            ag_info = {
                "id": u_id_str,
                "name": u.full_name,
                "role": u.role,
                "extension": u.extension,
                "is_logged_in": bool(is_logged_in),
                "status": status,
                "breakId": break_id,
                "breakType": break_type,
                "breakColor": break_color,
                "breakMaxMinutes": break_max_min,
                "isAutoBreak": is_auto_brk,
                "caller": caller_number,
                "call_id": matched_call_id,
                "duration": status_duration,
                "status_since_utc": status_since_utc,
                "callsToday": ext_call_counts.get(u_ext_str, 0)
            }
            agents_state[u.id] = ag_info
            agents_state[u_id_str] = ag_info
            agents_state[u_ext_str] = ag_info

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

@app.put("/api/blacklist/{item_id}")
async def update_blacklist_item(item_id: int, payload: BlacklistItemSchema):
    val = payload.value.strip()
    if not val:
        raise HTTPException(status_code=400, detail="Değer boş olamaz.")

    label = "Telefon numarası" if payload.type == "phone" else "E-posta adresi"
    val_digits = re.sub(r"\D", "", val)
    val_last10 = val_digits[-10:] if (payload.type == "phone" and len(val_digits) >= 10) else None
    new_reason = payload.reason.strip() if payload.reason else "Manuel Engelleme"

    current_list = settings_db.setdefault("blacklist", [])
    old_val = None
    for b in current_list:
        b_id = b.get("id") if isinstance(b, dict) else getattr(b, "id", None)
        b_val = (b.get("value") if isinstance(b, dict) else getattr(b, "value", "")).strip()
        if str(b_id) == str(item_id):
            old_val = b_val
            continue
        if b_val.lower() == val.lower():
            raise HTTPException(status_code=400, detail=f"Bu {label.lower()} ({val}) zaten kara listede mevcut.")
        if val_last10:
            b_digits = re.sub(r"\D", "", b_val)
            if len(b_digits) >= 10 and b_digits[-10:] == val_last10:
                raise HTTPException(status_code=400, detail=f"Bu {label.lower()} ({val}) zaten kara listede mevcut ({b_val}).")

    updated_item = {
        "id": item_id,
        "type": payload.type,
        "value": val,
        "reason": new_reason,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(BlacklistItem)
            res = await session.execute(stmt)
            existing_items = res.scalars().all()
            target_db_item = None
            for ex in existing_items:
                if str(ex.id) == str(item_id):
                    target_db_item = ex
                    if not old_val and ex.value:
                        old_val = ex.value.strip()
                    continue
                ex_val = (ex.value or "").strip()
                if ex_val.lower() == val.lower():
                    raise HTTPException(status_code=400, detail=f"Bu {label.lower()} ({val}) zaten kara listede mevcut.")
                if val_last10:
                    ex_digits = re.sub(r"\D", "", ex_val)
                    if len(ex_digits) >= 10 and ex_digits[-10:] == val_last10:
                        raise HTTPException(status_code=400, detail=f"Bu {label.lower()} ({val}) zaten kara listede mevcut ({ex_val}).")

            if target_db_item:
                target_db_item.type = payload.type
                target_db_item.value = val
                target_db_item.reason = new_reason
                await session.commit()
                await session.refresh(target_db_item)
                updated_item["id"] = target_db_item.id
                if target_db_item.timestamp:
                    updated_item["timestamp"] = target_db_item.timestamp.isoformat()
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Update Blacklist DB Warning]: {e}")

    found_in_mem = False
    new_mem_list = []
    for b in current_list:
        b_id = b.get("id") if isinstance(b, dict) else getattr(b, "id", None)
        b_val = (b.get("value") if isinstance(b, dict) else getattr(b, "value", "")).strip()
        if str(b_id) == str(item_id) or (old_val and b_val.lower() == old_val.lower()):
            if not found_in_mem:
                new_mem_list.append(updated_item)
                found_in_mem = True
        else:
            new_mem_list.append(b)
    if not found_in_mem:
        new_mem_list.insert(0, updated_item)

    settings_db["blacklist"] = new_mem_list
    save_settings(settings_db)
    add_system_log("ABUSE_SHIELD", "INFO", f"Kara Liste Kaydı Güncellendi: {old_val or item_id} -> {val} ({new_reason})")
    return updated_item

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

@app.put("/api/block-words/{word_id}")
async def update_block_word(word_id: int, payload: BlockWordSchema):
    word_val = payload.word.strip().lower()
    if not word_val:
        raise HTTPException(status_code=400, detail="Kelime boş olamaz.")

    current_words = settings_db.setdefault("block_words", [])
    for w in current_words:
        w_id = w.get("id") if isinstance(w, dict) else getattr(w, "id", None)
        if str(w_id) != str(word_id) and (w.get("word") if isinstance(w, dict) else getattr(w, "word", "")).lower() == word_val:
            raise HTTPException(status_code=400, detail="Bu kelime zaten yasaklı listesinde.")

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(BlockWord).where(BlockWord.word == word_val)
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing and str(existing.id) != str(word_id):
                raise HTTPException(status_code=400, detail="Bu kelime zaten yasaklı listesinde.")

            item = await session.get(BlockWord, word_id)
            if item:
                item.word = word_val
                await session.commit()
                await session.refresh(item)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Update Block Word DB Warning]: {e}")

    for w in current_words:
        w_id = w.get("id") if isinstance(w, dict) else getattr(w, "id", None)
        if str(w_id) == str(word_id):
            if isinstance(w, dict):
                w["word"] = word_val
            else:
                setattr(w, "word", word_val)
    settings_db["block_words"] = current_words
    save_settings(settings_db)
    add_system_log("ABUSE_SHIELD", "INFO", f"Yasaklı Kelime Güncellendi: ID {word_id} -> '{word_val}'")
    return {"id": word_id, "word": word_val}

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
    if isinstance(contacts, str) and isinstance(phone_info, (list, tuple, set)):
        contacts, phone_info = phone_info, contacts
    if not phone_info or not contacts or isinstance(contacts, str):
        return None
    clean_target = re.sub(r"\D", "", str(phone_info))
    if not clean_target:
        return None

    for c in contacts:
        if isinstance(c, dict):
            c_phone = c.get("phone_number") or c.get("phone") or ""
            c_name = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip() or c.get("name", "")
        else:
            c_phone = getattr(c, "phone_number", None) or ""
            c_name = f"{getattr(c, 'first_name', '') or ''} {getattr(c, 'last_name', '') or ''}".strip()
        if c_phone:
            if str(c_phone).strip() == str(phone_info).strip():
                return c_name
            c_clean = re.sub(r"\D", "", str(c_phone))
            if c_clean and c_clean == clean_target:
                return c_name
            if len(c_clean) >= 10 and len(clean_target) >= 10:
                if c_clean[-10:] == clean_target[-10:]:
                    return c_name
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
async def get_agent_stats(extension: str = None, user_id: str = None, db: AsyncSession = Depends(get_db)):
    from backend.database.models import Call, AgentBreakLog
    from sqlalchemy import select, or_

    # Calculate 00:00:00 of the current day in local TR time (UTC+3)
    # TR local 00:00:00 corresponds to UTC 21:00:00 of the previous calendar day
    now_utc = datetime.datetime.utcnow()
    now_tr = now_utc + datetime.timedelta(hours=3)
    today_tr_midnight = now_tr.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_tr_midnight - datetime.timedelta(hours=3)

    ext_str = str(extension).strip() if extension else None
    uid_str = str(user_id).strip() if user_id else None
    target_exts = set()
    target_user_ids = set()

    for val in (ext_str, uid_str):
        if val and val not in ("undefined", "null", "none", "0", ""):
            target_exts.add(val)
            target_user_ids.add(val)

    if target_exts or target_user_ids:
        settings = load_settings()
        for u in settings.get("users", []):
            u_id = str(u.get("id", "")).strip()
            u_ext = str(u.get("extension", "")).strip()
            if u_id in target_user_ids or u_ext in target_exts or u_id in target_exts or u_ext in target_user_ids:
                if u_ext:
                    target_exts.add(u_ext)
                if u_id:
                    target_user_ids.add(u_id)

        try:
            stmt_u = select(SystemUser)
            res_u = await db.execute(stmt_u)
            for su in res_u.scalars().all():
                su_id = str(su.id)
                su_ext = str(su.extension or "").strip()
                if su_id in target_user_ids or su_ext in target_exts or su_id in target_exts or su_ext in target_user_ids:
                    if su_ext:
                        target_exts.add(su_ext)
                    if su_id:
                        target_user_ids.add(su_id)
        except Exception:
            pass

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
    ).order_by(AgentBreakLog.start_time.desc())
    res_breaks = await db.execute(stmt_breaks)
    today_breaks = res_breaks.scalars().all()

    break_dict = {}
    break_count_dict = {}
    break_active_set = set()
    break_logs_list = []
    total_break_seconds = 0.0
    active_break_info = None

    settings_all = load_settings()
    break_colors = {
        str(b.get("name", "")).strip().lower(): (b.get("color") or "#f59e0b")
        for b in settings_all.get("breaks", [])
    }

    for b_log in today_breaks:
        if str(b_log.break_name or "").startswith("__"):
            continue
        if target_user_ids or target_exts:
            b_uid = str(b_log.user_id or "").strip()
            b_ext = str(b_log.extension or "").strip()
            if (b_uid or b_ext) and (b_uid not in target_user_ids and b_ext not in target_exts and b_uid not in target_exts and b_ext not in target_user_ids):
                continue

        eff_start = max(b_log.start_time, today_start_utc)
        eff_end = b_log.end_time if b_log.end_time else now_utc

        if eff_end >= eff_start:
            sec = max(0.0, (eff_end - eff_start).total_seconds())
            b_name = b_log.break_name or "Mola"
            break_dict[b_name] = break_dict.get(b_name, 0.0) + sec
            break_count_dict[b_name] = break_count_dict.get(b_name, 0) + 1
            total_break_seconds += sec

            start_tr = b_log.start_time + datetime.timedelta(hours=3)
            end_tr = (b_log.end_time + datetime.timedelta(hours=3)) if b_log.end_time else None
            is_act = b_log.end_time is None
            if is_act:
                break_active_set.add(b_name)
                if active_break_info is None:
                    active_break_info = {
                        "name": b_name,
                        "color": break_colors.get(b_name.lower(), "#f59e0b"),
                        "start_time": start_tr.strftime("%H:%M:%S"),
                        "start_time_utc": b_log.start_time.isoformat() + "Z",
                        "elapsed_seconds": int(round(sec))
                    }

            break_logs_list.append({
                "id": b_log.id,
                "break_name": b_name,
                "color": break_colors.get(b_name.lower(), "#f59e0b"),
                "start_time": start_tr.strftime("%H:%M:%S"),
                "end_time": end_tr.strftime("%H:%M:%S") if end_tr else None,
                "start_time_utc": b_log.start_time.isoformat() + "Z",
                "duration_seconds": int(round(sec)),
                "is_active": is_act
            })

    break_details = []
    total_break_minutes = int(round(total_break_seconds / 60.0))
    if total_break_seconds > 0 and total_break_minutes == 0:
        total_break_minutes = 1

    for b_name, sec in break_dict.items():
        mins = int(round(sec / 60.0))
        if sec > 0 and mins == 0:
            mins = 1
        break_details.append({
            "name": b_name,
            "color": break_colors.get(b_name.lower(), "#f59e0b"),
            "minutes": mins,
            "seconds": int(round(sec)),
            "count": break_count_dict.get(b_name, 1),
            "is_active": b_name in break_active_set
        })

    return {
        "inbound": inbound_count,
        "outbound": outbound_count,
        "missed": missed_count,
        "break_minutes": total_break_minutes,
        "break_seconds": int(round(total_break_seconds)),
        "active_break": active_break_info,
        "break_details": break_details,
        "break_logs": break_logs_list
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

    # Discover historical agent names on extensions (e.g. when extension 1000 was renamed from 'Anıl' to 'Mehmet')
    existing_ext_names = {(str(a.get("extension") or "").strip(), str(a.get("name") or "").strip().lower()) for a in agents_list}
    ext_to_base_agent = {str(a.get("extension") or "").strip(): a for a in agents_list if not a.get("is_ai") and a.get("extension")}
    uid_to_base_agent = {str(a.get("id") or "").strip(): a for a in agents_list if not a.get("is_ai") and a.get("id")}

    for call in window_calls:
        c_ag_name = str(getattr(call, "agent_name", "") or "").strip()
        if not c_ag_name:
            continue
        c_caller = str(call.caller_number or "").strip()
        c_callee = str(call.callee_number or "").strip()
        matched_ext = None
        if c_caller in ext_to_base_agent:
            matched_ext = c_caller
        elif c_callee in ext_to_base_agent:
            matched_ext = c_callee
        elif str(call.hangup_source or "").startswith("transfer:"):
            t_ext = str(call.hangup_source).split("transfer:", 1)[1].strip()
            if t_ext in ext_to_base_agent:
                matched_ext = t_ext
        if matched_ext and (matched_ext, c_ag_name.lower()) not in existing_ext_names:
            existing_ext_names.add((matched_ext, c_ag_name.lower()))
            base_ag = ext_to_base_agent[matched_ext]
            agents_list.append({
                "id": f"hist-{matched_ext}-{c_ag_name}",
                "orig_user_id": str(base_ag["id"]),
                "name": c_ag_name,
                "extension": matched_ext,
                "role": base_ag.get("role") or "agent",
                "avatar": "",
                "is_online": False,
                "is_ai": False,
                "is_historical": True
            })

    for b_log in window_breaks:
        b_ag_name = str(getattr(b_log, "agent_name", "") or "").strip()
        if not b_ag_name:
            continue
        b_ext = str(b_log.extension or "").strip()
        b_uid = str(b_log.user_id or "").strip()
        base_ag = ext_to_base_agent.get(b_ext) or uid_to_base_agent.get(b_uid)
        if base_ag:
            m_ext = str(base_ag.get("extension") or "").strip()
            if m_ext and (m_ext, b_ag_name.lower()) not in existing_ext_names:
                existing_ext_names.add((m_ext, b_ag_name.lower()))
                agents_list.append({
                    "id": f"hist-{m_ext}-{b_ag_name}",
                    "orig_user_id": str(base_ag["id"]),
                    "name": b_ag_name,
                    "extension": m_ext,
                    "role": base_ag.get("role") or "agent",
                    "avatar": "",
                    "is_online": False,
                    "is_ai": False,
                    "is_historical": True
                })

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
        ag_orig_id = str(ag.get("orig_user_id") or ag_id)
        ag_ext = str(ag["extension"])
        ag_name = str(ag["name"] or "").strip()
        is_hist = bool(ag.get("is_historical"))

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
            if b_uid not in (ag_id, ag_orig_id, ag_ext) and b_ext not in (ag_id, ag_orig_id, ag_ext):
                continue

            b_ag_name = str(getattr(b_log, "agent_name", "") or "").strip()
            if b_ag_name:
                if b_ag_name.lower() != ag_name.lower():
                    continue
            elif is_hist:
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
                is_caller = (caller == ag_ext or caller == ag_orig_id or (len(ag_ext) >= 3 and caller.endswith(ag_ext)))
                is_callee = (callee == ag_ext or callee == ag_orig_id or (len(ag_ext) >= 3 and callee.endswith(ag_ext)))

            if not is_caller and not is_callee:
                if not ag.get("is_ai") and st == "transferred" and len([x for x in agents_list if not x.get("is_ai") and not x.get("is_historical")]) == 1:
                    is_callee = True
                else:
                    continue

            if not ag.get("is_ai"):
                c_ag_name = str(getattr(call, "agent_name", "") or "").strip()
                if c_ag_name:
                    if c_ag_name.lower() != ag_name.lower() and any(
                        str(a.get("extension") or "").strip() == ag_ext and str(a.get("name") or "").strip().lower() == c_ag_name.lower()
                        for a in agents_list
                    ):
                        continue
                elif is_hist:
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


@app.get("/api/settings/intent-rules")
async def get_intent_rules(request: Request, tenant_id: Optional[str] = None):
    u_info = get_user_info(request)
    eff_tenant = tenant_id or u_info.get("tenant_id") or "tenant-default"
    settings = load_settings()
    all_rules = settings.get("intent_rules")
    if not isinstance(all_rules, list) or len(all_rules) == 0:
        all_rules = [r.copy() for r in DEFAULT_SETTINGS.get("intent_rules", [])]

    tenant_rules = [
        r for r in all_rules
        if is_default_tenant(eff_tenant)
        or r.get("tenant_id") in (eff_tenant, None, "tenant-default", "default")
    ]
    return {"status": "success", "rules": tenant_rules}


@app.post("/api/settings/intent-rules")
async def save_intent_rules_endpoint(request: Request):
    u_info = get_user_info(request)
    eff_tenant = u_info.get("tenant_id") or "tenant-default"
    body = await request.json()
    incoming_rules = body.get("rules", [])
    if not isinstance(incoming_rules, list):
        raise HTTPException(status_code=400, detail="rules listesi gereklidir")

    cleaned_rules = []
    for idx, item in enumerate(incoming_rules):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        raw_kws = item.get("keywords") or []
        if isinstance(raw_kws, str):
            kws = [k.strip() for k in raw_kws.split(",") if k.strip()]
        elif isinstance(raw_kws, list):
            kws = [str(k).strip() for k in raw_kws if str(k).strip()]
        else:
            kws = []
        cleaned_rules.append({
            "id": str(item.get("id") or f"intent-custom-{int(datetime.datetime.utcnow().timestamp())}-{idx}"),
            "name": name,
            "category": str(item.get("category") or "Genel").strip(),
            "keywords": kws,
            "speaker_scope": str(item.get("speaker_scope") or "customer").strip(),
            "status_color": str(item.get("status_color") or "blue").strip(),
            "tenant_id": str(item.get("tenant_id") or eff_tenant)
        })

    settings = load_settings()
    existing_all = settings.get("intent_rules", [])
    if not isinstance(existing_all, list):
        existing_all = []

    if is_default_tenant(eff_tenant):
        other_tenant_rules = [
            r for r in existing_all
            if r.get("tenant_id") not in (None, "tenant-default", "default", eff_tenant)
        ]
    else:
        other_tenant_rules = [
            r for r in existing_all
            if r.get("tenant_id") != eff_tenant
        ]

    settings["intent_rules"] = other_tenant_rules + cleaned_rules
    save_settings(settings)
    return {"status": "success", "rules": cleaned_rules}


@app.get("/api/reports/intent-analysis")
async def get_intent_analysis_report(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tenant_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    u_info = get_user_info(request)
    eff_tenant = tenant_id or u_info.get("tenant_id") or "tenant-default"
    now_utc = datetime.datetime.utcnow()
    now_tr = now_utc + datetime.timedelta(hours=3)

    try:
        s_str = (start_date or "").strip() or now_tr.strftime("%Y-%m-%d")
        e_str = (end_date or "").strip() or s_str
        s_dt_tr = datetime.datetime.strptime(s_str[:10], "%Y-%m-%d")
        e_dt_tr = datetime.datetime.strptime(e_str[:10], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except Exception:
        s_dt_tr = now_tr.replace(hour=0, minute=0, second=0, microsecond=0)
        e_dt_tr = now_tr.replace(hour=23, minute=59, second=59, microsecond=999999)

    window_start_utc = s_dt_tr - datetime.timedelta(hours=3)
    window_end_utc = e_dt_tr - datetime.timedelta(hours=3)

    stmt_calls = select(Call).where(
        Call.start_time >= window_start_utc,
        Call.start_time <= window_end_utc
    )
    if not is_default_tenant(eff_tenant):
        stmt_calls = stmt_calls.where(Call.tenant_id == eff_tenant)
    stmt_calls = stmt_calls.order_by(Call.start_time.desc())
    res_calls = await db.execute(stmt_calls)
    calls_list = res_calls.scalars().all()

    call_ids = [c.id for c in calls_list if c.id]
    transcripts_by_call = {}
    if call_ids:
        stmt_tr = select(Transcript).where(Transcript.call_id.in_(call_ids)).order_by(Transcript.timestamp.asc())
        res_tr = await db.execute(stmt_tr)
        for tr in res_tr.scalars().all():
            transcripts_by_call.setdefault(tr.call_id, []).append({
                "id": tr.id,
                "speaker": tr.speaker or "customer",
                "text": tr.text or "",
                "timestamp": tr.timestamp.isoformat() if tr.timestamp else None
            })

    settings = load_settings()
    all_rules = settings.get("intent_rules")
    if not isinstance(all_rules, list) or len(all_rules) == 0:
        all_rules = [r.copy() for r in DEFAULT_SETTINGS.get("intent_rules", [])]

    active_rules = [
        r for r in all_rules
        if is_default_tenant(eff_tenant)
        or r.get("tenant_id") in (eff_tenant, None, "tenant-default", "default")
    ]

    return {
        "status": "success",
        "rules": active_rules,
        "transcripts_by_call": transcripts_by_call
    }


@app.get("/api/agent/directory")
async def get_agent_directory(db: AsyncSession = Depends(get_db)):
    from backend.services.ami_manager import registered_endpoints
    from backend.services.agent_presence import get_agent_state
    settings = load_settings()
    users = settings.get("users", [])
    queues = settings.get("queues", [])

    directory = []
    seen_exts = set()

    try:
        res_u = await db.execute(select(SystemUser))
        for su in res_u.scalars().all():
            ext_val = str(su.extension or "").strip()
            if not ext_val or ext_val in seen_exts:
                continue
            seen_exts.add(ext_val)
            u_name = str(su.full_name or su.email or f"Dahili {ext_val}").strip()
            uid_str = str(su.id or "")
            st_ext = get_agent_state(ext_val)
            st_uid = get_agent_state(uid_str)
            presence_online = (st_ext and st_ext.get("is_logged_in", False)) or (st_uid and st_uid.get("is_logged_in", False))
            is_reg = (ext_val in registered_endpoints or uid_str in registered_endpoints) and presence_online
            c_state = get_live_user_call_state(ext_val, is_reg)
            directory.append({
                "type": "user",
                "id": su.id,
                "name": u_name,
                "full_name": u_name,
                "number": ext_val,
                "extension": ext_val,
                "avatar": getattr(su, "avatar_url", None),
                "is_registered": is_reg,
                "call_state": c_state,
                "status": c_state
            })
    except Exception:
        pass

    for u in users:
        ext_val = str(u.get("extension") or "").strip()
        if not ext_val or ext_val in seen_exts:
            continue
        seen_exts.add(ext_val)
        u_name = str(u.get("full_name") or u.get("name") or u.get("username") or u.get("email") or f"Dahili {ext_val}").strip()
        uid_str = str(u.get("id") or "")
        st_ext = get_agent_state(ext_val)
        st_uid = get_agent_state(uid_str)
        presence_online = (st_ext and st_ext.get("is_logged_in", False)) or (st_uid and st_uid.get("is_logged_in", False))
        is_reg = (ext_val in registered_endpoints or uid_str in registered_endpoints) and presence_online
        c_state = get_live_user_call_state(ext_val, is_reg)
        directory.append({
            "type": "user",
            "id": u.get("id"),
            "name": u_name,
            "full_name": u_name,
            "number": ext_val,
            "extension": ext_val,
            "avatar": u.get("avatar_url") or u.get("avatar"),
            "is_registered": is_reg,
            "call_state": c_state,
            "status": c_state
        })
    for q in queues:
        directory.append({
            "type": "queue",
            "id": q.get("id"),
            "name": q.get("name"),
            "number": q.get("extension"),
            "extension": q.get("extension"),
            "status": "active"
        })
    return directory

@app.get("/api/agent/chat")
async def get_internal_chat(extension: str = None, user_id: str = None, db: AsyncSession = Depends(get_db)):
    from backend.database.models import InternalChatMessage
    from sqlalchemy import select, or_

    ext_val = str(extension or "").strip()
    uid_val = str(user_id or "").strip()
    identities = {v for v in (ext_val, uid_val) if v and v not in ("undefined", "null")}

    if identities:
        settings = load_settings()
        for u in settings.get("users", []):
            u_id = str(u.get("id", "")).strip()
            u_ext = str(u.get("extension", "")).strip()
            if u_id in identities or u_ext in identities:
                if u_id:
                    identities.add(u_id)
                if u_ext:
                    identities.add(u_ext)

    conds = [InternalChatMessage.receiver_id == "broadcast"]
    for ident in identities:
        conds.append(InternalChatMessage.sender_id == ident)
        conds.append(InternalChatMessage.receiver_id == ident)

    stmt = select(InternalChatMessage).where(or_(*conds)).order_by(InternalChatMessage.timestamp.asc())
    res = await db.execute(stmt)
    messages = res.scalars().all()
    return [
        {
            "id": m.id,
            "sender_id": str(m.sender_id or ""),
            "receiver_id": str(m.receiver_id or ""),
            "text": m.text or "",
            "timestamp": (m.timestamp.isoformat() + "Z") if m.timestamp else None
        }
        for m in messages
    ]

@app.post("/api/agent/chat")
async def post_internal_chat(payload: dict, db: AsyncSession = Depends(get_db)):
    from backend.database.models import InternalChatMessage
    sender_id = str(payload.get("sender_id") or "").strip()
    receiver_id = str(payload.get("receiver_id") or "").strip()
    text_val = str(payload.get("text") or "").strip()
    if not sender_id or not receiver_id or not text_val:
        raise HTTPException(status_code=400, detail="Gönderen, alıcı ve mesaj metni zorunludur.")

    msg = InternalChatMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        text=text_val,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return {
        "id": msg.id,
        "sender_id": str(msg.sender_id or ""),
        "receiver_id": str(msg.receiver_id or ""),
        "text": msg.text or "",
        "timestamp": (msg.timestamp.isoformat() + "Z") if msg.timestamp else None
    }


@app.get("/api/agent/queue-peers")
async def get_agent_queue_peers(
    extension: Optional[str] = None,
    user_id: Optional[str] = None,
    queue_id: Optional[str] = None,
    user_info: dict = Depends(get_user_info),
    db: AsyncSession = Depends(get_db)
):
    from backend.database.models import Call, AgentBreakLog, PBXQueue, SystemUser
    from backend.services.ami_manager import registered_endpoints, get_ami_manager
    from backend.services.agent_presence import get_agent_state
    from sqlalchemy import select, or_

    now_utc = datetime.datetime.utcnow()
    now_tr = now_utc + datetime.timedelta(hours=3)
    today_tr_midnight = now_tr.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_tr_midnight - datetime.timedelta(hours=3)

    target_tenant = user_info.get("tenant_id") or "tenant-default"
    settings = load_settings()

    # 1. Load all users (PostgreSQL SystemUser + settings.json fallback)
    users_map = {}  # key: canonical ext or id -> user dict
    id_to_key = {}
    ext_to_key = {}

    try:
        stmt_u = select(SystemUser)
        if not is_global_tenant(target_tenant):
            if is_default_tenant(target_tenant):
                stmt_u = stmt_u.where(or_(SystemUser.tenant_id == "tenant-default", SystemUser.tenant_id == "default", SystemUser.tenant_id.is_(None)))
            else:
                stmt_u = stmt_u.where(SystemUser.tenant_id == target_tenant)
        res_u = await db.execute(stmt_u)
        for su in res_u.scalars().all():
            u_id = str(su.id).strip()
            u_ext = str(su.extension or "").strip()
            key = u_ext or f"uid_{u_id}"
            u_name = str(su.full_name or su.email or f"Dahili {u_ext}").strip()
            users_map[key] = {
                "id": u_id,
                "extension": u_ext,
                "name": u_name,
                "full_name": u_name,
                "role": su.role or "agent",
                "avatar": getattr(su, "avatar_url", None) or getattr(su, "avatar", None) or ""
            }
            if u_id:
                id_to_key[u_id] = key
            if u_ext:
                ext_to_key[u_ext] = key
    except Exception as e_u:
        print(f"[Queue Peers Users DB Error]: {e_u}")

    for u in settings.get("users", []):
        if not is_global_tenant(target_tenant):
            u_ten = u.get("tenant_id")
            if is_default_tenant(target_tenant):
                if u_ten not in (None, "", "tenant-default", "default"):
                    continue
            elif u_ten != target_tenant:
                continue
        u_id = str(u.get("id") or "").strip()
        u_ext = str(u.get("extension") or "").strip()
        key = u_ext or f"uid_{u_id}"
        if not key or key == "uid_":
            continue
        if key not in users_map:
            u_name = str(u.get("full_name") or u.get("name") or u.get("username") or u.get("email") or f"Dahili {u_ext}").strip()
            users_map[key] = {
                "id": u_id or u_ext,
                "extension": u_ext,
                "name": u_name,
                "full_name": u_name,
                "role": u.get("role") or "agent",
                "avatar": u.get("avatar_url") or u.get("avatar") or ""
            }
        if u_id:
            id_to_key[u_id] = key
        if u_ext:
            ext_to_key[u_ext] = key

    def resolve_agent_key(val):
        s = str(val or "").strip()
        if not s or s in ("undefined", "null", "none"):
            return None
        if s in users_map:
            return s
        if s in ext_to_key:
            return ext_to_key[s]
        if s in id_to_key:
            return id_to_key[s]
        return None

    req_key = resolve_agent_key(extension) or resolve_agent_key(user_id)

    # 2. Load all queues and expand members (including subscriber_groups)
    raw_queues = []
    try:
        stmt_q = select(PBXQueue).order_by(PBXQueue.id)
        if not is_global_tenant(target_tenant):
            if is_default_tenant(target_tenant):
                stmt_q = stmt_q.where(or_(PBXQueue.tenant_id == "tenant-default", PBXQueue.tenant_id.is_(None)))
            else:
                stmt_q = stmt_q.where(PBXQueue.tenant_id == target_tenant)
        res_q = await db.execute(stmt_q)
        for q_row in res_q.scalars().all():
            raw_queues.append({c.name: getattr(q_row, c.name) for c in q_row.__table__.columns})
    except Exception as e_q:
        print(f"[Queue Peers Queues DB Error]: {e_q}")

    if not raw_queues:
        for q_cfg in settings.get("queues", []):
            raw_queues.append(q_cfg)

    all_groups = settings.get("subscriber_groups", [])
    queues_out = []
    agent_queues_map = {k: [] for k in users_map}
    my_queue_ids = set()

    for q in raw_queues:
        q_id = str(q.get("id") or q.get("extension") or "")
        q_name = str(q.get("name") or f"Kuyruk {q_id}")
        q_ext = str(q.get("extension") or "")
        raw_members = q.get("queueMembers") or q.get("members") or []
        if isinstance(raw_members, str):
            try:
                raw_members = json.loads(raw_members)
            except Exception:
                raw_members = []
        raw_sups = q.get("supervisors") or []
        if isinstance(raw_sups, str):
            try:
                raw_sups = json.loads(raw_sups)
            except Exception:
                raw_sups = []

        member_keys = []
        for m in list(raw_members) + list(raw_sups):
            m_val = m.get("user_id") or m.get("extension") or m.get("id") if isinstance(m, dict) else m
            s_val = str(m_val or "").strip()
            if not s_val:
                continue
            if s_val.startswith("group_"):
                gid = s_val.replace("group_", "", 1)
                grp = next((g for g in all_groups if str(g.get("id")) == gid), None)
                if grp:
                    for g_item in (grp.get("extensions") or grp.get("members") or []):
                        gk = resolve_agent_key(g_item)
                        if gk and gk not in member_keys:
                            member_keys.append(gk)
                continue
            ak = resolve_agent_key(s_val)
            if ak and ak not in member_keys:
                member_keys.append(ak)

        q_info = {"id": q_id, "name": q_name, "extension": q_ext, "member_keys": member_keys}
        queues_out.append(q_info)

        if req_key and req_key in member_keys:
            my_queue_ids.add(q_id)

        for mk in member_keys:
            if mk in agent_queues_map:
                agent_queues_map[mk].append({"id": q_id, "name": q_name, "extension": q_ext})

    # Determine which agents belong to the filtered queues
    selected_qid = str(queue_id or "").strip()
    if selected_qid and selected_qid not in ("all", "my_queues", "undefined", "null"):
        allowed_agent_keys = set()
        for q_info in queues_out:
            if q_info["id"] == selected_qid or q_info["extension"] == selected_qid:
                allowed_agent_keys.update(q_info["member_keys"])
    elif my_queue_ids and selected_qid != "all":
        allowed_agent_keys = set()
        for q_info in queues_out:
            if q_info["id"] in my_queue_ids:
                allowed_agent_keys.update(q_info["member_keys"])
    else:
        # If agent is not in a specific queue (or selected "all"), include all queue members, or all users if no queue members exist
        allowed_agent_keys = set()
        for q_info in queues_out:
            allowed_agent_keys.update(q_info["member_keys"])
        if not allowed_agent_keys:
            allowed_agent_keys = set(users_map.keys())

    # 3. Fetch today's calls and break/login/logout logs
    stmt_calls = select(Call).where(Call.start_time >= today_start_utc).order_by(Call.start_time.asc())
    res_calls = await db.execute(stmt_calls)
    today_calls = res_calls.scalars().all()

    stmt_breaks = select(AgentBreakLog).where(
        or_(
            AgentBreakLog.start_time >= today_start_utc,
            AgentBreakLog.end_time >= today_start_utc,
            AgentBreakLog.end_time.is_(None)
        )
    ).order_by(AgentBreakLog.start_time.asc())
    res_breaks = await db.execute(stmt_breaks)
    today_breaks = res_breaks.scalars().all()

    # Check live Asterisk channels if available
    live_busy_exts = {}
    try:
        ami = get_ami_manager()
        if ami and getattr(ami, "active_channels", None):
            for ch_id, ch_info in list(ami.active_channels.items()):
                ch_name = str(ch_info.get("channel") or "")
                m_ext = re.search(r"PJSIP/(\d+)-", ch_name)
                if m_ext:
                    live_busy_exts[m_ext.group(1)] = ch_info.get("created_at") or now_utc
    except Exception:
        pass

    def fmt_tr_hms(dt_utc):
        if not dt_utc:
            return "-"
        dt_tr = dt_utc + datetime.timedelta(hours=3)
        return dt_tr.strftime("%H:%M:%S")

    agents_result = []
    for a_key, u_obj in users_map.items():
        if a_key not in allowed_agent_keys:
            continue

        u_id = str(u_obj.get("id") or "").strip()
        u_ext = str(u_obj.get("extension") or "").strip()
        ident_set = {v for v in (u_id, u_ext, a_key) if v}

        inbound_count = 0
        outbound_count = 0
        missed_count = 0
        talk_seconds = 0
        break_seconds = 0

        first_login_utc = None
        last_login_utc = None
        last_logout_utc = None
        last_call_end_utc = None
        last_break_end_utc = None
        first_activity_utc = None

        active_break_log = None
        active_call_obj = None

        # Process break / login / logout logs for this agent
        for b_log in today_breaks:
            b_uid = str(b_log.user_id or "").strip()
            b_ext = str(b_log.extension or "").strip()
            if b_uid not in ident_set and b_ext not in ident_set:
                continue

            b_name = str(b_log.break_name or "Mola")
            if first_activity_utc is None or b_log.start_time < first_activity_utc:
                first_activity_utc = b_log.start_time

            if b_name == "__LOGIN__":
                if first_login_utc is None or b_log.start_time < first_login_utc:
                    first_login_utc = b_log.start_time
                if last_login_utc is None or b_log.start_time > last_login_utc:
                    last_login_utc = b_log.start_time
            elif b_name == "__LOGOUT__":
                if last_logout_utc is None or b_log.start_time > last_logout_utc:
                    last_logout_utc = b_log.start_time
            elif not b_name.startswith("__"):
                eff_start = max(b_log.start_time, today_start_utc)
                eff_end = b_log.end_time if b_log.end_time else now_utc
                if eff_end >= eff_start:
                    break_seconds += int((eff_end - eff_start).total_seconds())
                if b_log.end_time is None:
                    active_break_log = b_log
                else:
                    if last_break_end_utc is None or b_log.end_time > last_break_end_utc:
                        last_break_end_utc = b_log.end_time

        # Process calls for this agent
        for call in today_calls:
            caller = str(call.caller_number or "").strip()
            callee = str(call.callee_number or "").strip()
            st = str(call.status or "").lower()

            is_caller = bool(u_ext and (caller == u_ext or (len(u_ext) >= 3 and caller.endswith(u_ext))))
            is_callee = bool(u_ext and (callee == u_ext or (len(u_ext) >= 3 and callee.endswith(u_ext))))
            if not is_caller and not is_callee:
                continue

            if first_activity_utc is None or call.start_time < first_activity_utc:
                first_activity_utc = call.start_time

            if st == "in_progress" and call.end_time is None and (now_utc - call.start_time).total_seconds() < 7200:
                active_call_obj = call

            c_end = call.end_time or (now_utc if st == "in_progress" else call.start_time)
            c_dur = max(0, int((c_end - call.start_time).total_seconds()))

            if st in ("completed", "in_progress", "transferred", "answered"):
                if is_callee:
                    inbound_count += 1
                elif is_caller:
                    outbound_count += 1
                talk_seconds += c_dur
                if call.end_time and (last_call_end_utc is None or call.end_time > last_call_end_utc):
                    last_call_end_utc = call.end_time
            elif st in ("missed", "no_answer", "busy", "cancelled", "failed", "abandoned", "blocked"):
                missed_count += 1

        # Determine real-time status & status_since_utc (matching Wallboard /api/reports/agents logic)
        mem_st = get_agent_state(user_id=u_id, extension=u_ext)
        mem_since_utc = None
        if mem_st and mem_st.get("status_since_utc"):
            try:
                mem_since_utc = datetime.datetime.fromisoformat(str(mem_st["status_since_utc"]).replace("Z", ""))
            except Exception:
                mem_since_utc = None

        has_active_login = bool(last_login_utc and (last_logout_utc is None or last_login_utc >= last_logout_utc))
        if mem_st and mem_st.get("status_since_utc"):
            is_online = bool(mem_st.get("is_logged_in", False)) and mem_st.get("status") != "offline"
        elif active_break_log is not None:
            is_online = True
        elif has_active_login:
            is_online = True
        else:
            is_online = False

        status_code = "offline"
        status_label = "Çevrimdışı"
        break_name_val = None
        break_id_val = None
        break_color_val = None
        active_call_with = None
        status_since_utc = None
        breaks_cfg = settings.get("breaks", [])

        if is_online:
            if active_call_obj is not None or (u_ext and u_ext in live_busy_exts):
                status_code = "busy"
                if active_call_obj is not None:
                    other_num = active_call_obj.callee_number if str(active_call_obj.caller_number) == u_ext else active_call_obj.caller_number
                    active_call_with = str(other_num or "")
                    status_since_utc = active_call_obj.start_time
                else:
                    status_since_utc = live_busy_exts.get(u_ext) or now_utc
                status_label = f"Meşgul ({active_call_with})" if active_call_with else "Meşgul (Çağrıda)"
            elif active_break_log is not None or (mem_st and mem_st.get("status") == "break"):
                status_code = "break"
                cb = (mem_st.get("current_break") if mem_st else None) or {}
                if active_break_log is not None:
                    break_name_val = active_break_log.break_name or cb.get("name") or "Mola"
                    status_since_utc = active_break_log.start_time
                else:
                    break_name_val = cb.get("name") or "Mola"
                    status_since_utc = mem_since_utc or now_utc
                break_id_val = cb.get("id")
                break_color_val = cb.get("color")
                for b_cfg in breaks_cfg:
                    if str(b_cfg.get("name", "")).strip().lower() == str(break_name_val).strip().lower():
                        if not break_id_val:
                            break_id_val = b_cfg.get("id")
                        if not break_color_val and b_cfg.get("color"):
                            break_color_val = b_cfg.get("color")
                        break
                status_label = f"Molada ({break_name_val})"
            elif mem_st and mem_st.get("status") == "acw":
                status_code = "acw"
                status_label = "ACW / İşlemde"
                status_since_utc = mem_since_utc or now_utc
            else:
                status_code = "available"
                status_label = "Müsait"
                candidates = [t for t in (last_call_end_utc, last_break_end_utc, last_login_utc, mem_since_utc, first_activity_utc) if t is not None]
                status_since_utc = max(candidates) if candidates else today_start_utc
        else:
            status_code = "offline"
            status_label = "Çevrimdışı"
            status_since_utc = last_logout_utc or mem_since_utc

        status_duration_seconds = max(0, int((now_utc - status_since_utc).total_seconds())) if status_since_utc else 0

        eff_login_utc = first_login_utc or first_activity_utc or (mem_since_utc if is_online else None)
        login_time_str = fmt_tr_hms(eff_login_utc) if eff_login_utc else ("Aktif" if is_online else "-")
        if is_online and (last_logout_utc is None or (last_login_utc and last_login_utc >= last_logout_utc)):
            logout_time_str = f"Aktif (Son: {fmt_tr_hms(last_logout_utc)})" if last_logout_utc else "Aktif"
        else:
            logout_time_str = fmt_tr_hms(last_logout_utc) if last_logout_utc else "-"

        from backend.services.agent_presence import is_auto_break_name
        is_auto_break_peer = bool(status_code == "break" and is_auto_break_name(break_name_val))
        agents_result.append({
            "id": u_id or a_key,
            "name": u_obj["name"],
            "full_name": u_obj["full_name"],
            "extension": u_ext,
            "role": u_obj.get("role") or "agent",
            "avatar": u_obj.get("avatar") or "",
            "is_me": a_key == req_key,
            "is_logged_in": bool(is_online and status_code != "offline"),
            "queues": agent_queues_map.get(a_key, []),
            "status": status_code,
            "status_label": status_label,
            "break_id": break_id_val,
            "break_name": break_name_val,
            "break_color": break_color_val,
            "is_auto_break": is_auto_break_peer,
            "active_call_with": active_call_with,
            "status_since_utc": (status_since_utc.isoformat() + "Z") if status_since_utc else None,
            "status_duration_seconds": status_duration_seconds,
            "inbound_calls": inbound_count,
            "outbound_calls": outbound_count,
            "missed_calls": missed_count,
            "total_calls": inbound_count + outbound_count,
            "talk_duration_seconds": talk_seconds,
            "break_duration_seconds": break_seconds,
            "login_time": login_time_str,
            "logout_time": logout_time_str
        })

    # Sort: busy/break/available first, then by extension
    status_order = {"busy": 0, "break": 1, "available": 2, "offline": 3}
    agents_result.sort(key=lambda x: (status_order.get(x["status"], 9), str(x.get("extension") or "9999")))

    return {
        "status": "success",
        "my_queues": [
            {"id": q["id"], "name": q["name"], "extension": q["extension"]}
            for q in queues_out if q["id"] in my_queue_ids
        ],
        "all_queues": [
            {"id": q["id"], "name": q["name"], "extension": q["extension"], "member_count": len(q["member_keys"])}
            for q in queues_out
        ],
        "agents": agents_result
    }

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
    # Configured SIP Trunk hosts (e.g. ikonsip.com) + cached DNS resolution
    if not hasattr(_is_trusted_or_local_ip, "_dns_cache"):
        _is_trusted_or_local_ip._dns_cache = {}
    import socket
    for t in settings_db.get("trunks", []):
        h = str(t.get("host") or "").strip()
        if not h:
            continue
        if h == base_ip:
            return True
        if not re.match(r"^\d{1,3}(?:\.\d{1,3}){3}$", h):
            resolved_ips = _is_trusted_or_local_ip._dns_cache.get(h)
            if resolved_ips is None:
                try:
                    infos = socket.getaddrinfo(h, None, socket.AF_INET)
                    resolved_ips = {info[4][0] for info in infos if info and len(info) > 4 and info[4]}
                except Exception:
                    resolved_ips = set()
                _is_trusted_or_local_ip._dns_cache[h] = resolved_ips
            if base_ip in resolved_ips:
                return True
    return False


_enforced_kernel_ban_ips = set()
_realtime_sip_attack_tracker = {}


def _enforce_kernel_drop_for_ip(ip_clean: str):
    """
    Saldırgan IP'yi Linux çekirdeğinde hem raw PREROUTING (nf_conntrack'tan ÖNCE, aktif UDP akışlarını anında keser)
    hem de INPUT zincirinin en üstüne (1. sıraya) ekler ve aktif conntrack UDP tablosunu temizler.
    """
    import subprocess
    if not ip_clean or ip_clean in _enforced_kernel_ban_ips:
        return
    # 1. raw PREROUTING drop (stops active UDP floods before conntrack ESTABLISHED bypass)
    try:
        chk_raw = subprocess.run(
            ["iptables", "-t", "raw", "-C", "PREROUTING", "-s", ip_clean, "-j", "DROP"],
            check=False, capture_output=True, timeout=1.5
        )
        if chk_raw.returncode != 0:
            subprocess.run(
                ["iptables", "-t", "raw", "-I", "PREROUTING", "1", "-s", ip_clean, "-j", "DROP"],
                check=False, capture_output=True, timeout=1.5
            )
    except Exception:
        pass

    # 2. filter INPUT drop
    try:
        chk_in = subprocess.run(
            ["iptables", "-C", "INPUT", "-s", ip_clean, "-j", "DROP"],
            check=False, capture_output=True, timeout=1.5
        )
        if chk_in.returncode != 0:
            subprocess.run(
                ["iptables", "-I", "INPUT", "1", "-s", ip_clean, "-j", "DROP"],
                check=False, capture_output=True, timeout=1.5
            )
    except Exception:
        pass

    # 3. Flush active UDP conntrack state if conntrack tool is present
    try:
        subprocess.run(["conntrack", "-D", "-s", ip_clean], check=False, capture_output=True, timeout=1.0)
    except Exception:
        pass

    _enforced_kernel_ban_ips.add(ip_clean)


def _execute_firewall_ban(ip_str: str, jail: str = "asterisk", reason: str = "SIP Brute-Force / Yetkisiz Deneme", force_manual: bool = False) -> bool:
    import subprocess, datetime, re, ipaddress
    ip_clean = str(ip_str or "").strip()
    try:
        ipaddress.ip_network(ip_clean, strict=False)
    except Exception:
        return False

    if not force_manual and _is_trusted_or_local_ip(ip_clean):
        return False

    # 1. Enforce kernel-level raw PREROUTING + INPUT DROP immediately
    _enforce_kernel_drop_for_ip(ip_clean)

    # 2. Ban via UFW (if available)
    try:
        subprocess.run(["ufw", "insert", "1", "deny", "from", ip_clean, "to", "any"], check=False, capture_output=True, timeout=2.0)
    except Exception:
        pass

    # 3. Ban via fail2ban-client (if running)
    for j_name in [jail, "asterisk", "asterisk-pjsip"]:
        try:
            subprocess.run(["fail2ban-client", "set", j_name, "banip", ip_clean], check=False, capture_output=True, timeout=2.0)
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
        print(f"[SIP IPS AUTO-BAN] Saldırgan IP Engellendi: {ip_clean} -> {reason}")
    save_settings(settings_db)
    return True


def _execute_firewall_unban(ip_str: str, add_to_whitelist: bool = False) -> bool:
    import subprocess, ipaddress, datetime
    ip_clean = str(ip_str or "").strip()
    try:
        ipaddress.ip_network(ip_clean, strict=False)
    except Exception:
        return False

    _enforced_kernel_ban_ips.discard(ip_clean)
    _realtime_sip_attack_tracker.pop(ip_clean, None)

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

    # 3. Remove from iptables (both raw PREROUTING and filter INPUT)
    for _ in range(3):
        try:
            r1 = subprocess.run(["iptables", "-t", "raw", "-D", "PREROUTING", "-s", ip_clean, "-j", "DROP"], check=False, capture_output=True, timeout=1.5)
            r2 = subprocess.run(["iptables", "-D", "INPUT", "-s", ip_clean, "-j", "DROP"], check=False, capture_output=True, timeout=1.5)
            if r1.returncode != 0 and r2.returncode != 0:
                break
        except Exception:
            break

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


def ensure_asterisk_security_logger_and_manager():
    """
    Asterisk'in PJSIP 'log_failed_request' (NOTICE) ve SecurityEvent (SECURITY) kayıtlarını
    /var/log/asterisk/messages ve /var/log/asterisk/security dosyalarına kesintisiz yazmasını
    ve AMI üzerinden 'security' olaylarını göndermesini garanti altına alır.
    """
    import subprocess
    if not os.path.exists("/etc/asterisk"):
        return

    try:
        os.makedirs("/var/log/asterisk", exist_ok=True)
        for lf in ("/var/log/asterisk/messages", "/var/log/asterisk/security", "/var/log/asterisk/full"):
            if not os.path.exists(lf):
                with open(lf, "a", encoding="utf-8"):
                    pass
            try:
                os.chmod(lf, 0o664)
            except Exception:
                pass
        subprocess.run(["chown", "-R", "asterisk:asterisk", "/var/log/asterisk"], check=False, capture_output=True, timeout=2.0)
    except Exception:
        pass

    # 1. Ensure /etc/asterisk/logger.conf has messages & security channels active
    logger_conf_path = "/etc/asterisk/logger.conf"
    desired_logger_conf = """; ==========================================
; AIDA OTOMATIK ASTERISK GUVENLIK & FAIL2BAN LOG YAPILANDIRMASI
; ==========================================
[general]
dateformat=%F %T

[logfiles]
console => notice,warning,error,security
messages => notice,warning,error,security
security => security,notice,warning,error
full => notice,warning,error,debug,verbose,dtmf,fax,security
"""
    try:
        needs_logger_reload = False
        if not os.path.exists(logger_conf_path):
            with open(logger_conf_path, "w", encoding="utf-8") as f:
                f.write(desired_logger_conf)
            needs_logger_reload = True
        else:
            with open(logger_conf_path, "r", encoding="utf-8", errors="ignore") as f:
                cur_logger = f.read()
            # Check if messages => ... security is active (uncommented)
            has_active_messages = any(
                line.strip().startswith("messages") and "notice" in line and "security" in line
                for line in cur_logger.splitlines()
                if not line.strip().startswith(";")
            )
            if not has_active_messages:
                with open(logger_conf_path, "w", encoding="utf-8") as f:
                    f.write(desired_logger_conf)
                needs_logger_reload = True
        if needs_logger_reload:
            subprocess.run(["asterisk", "-rx", "logger reload"], check=False, capture_output=True, timeout=2.0)
    except Exception as e_lconf:
        print(f"[Asterisk Logger Sync Error]: {e_lconf}")

    # 2. Ensure /etc/asterisk/manager.conf includes 'security' permission for AMI real-time IPS
    mgr_conf_path = "/etc/asterisk/manager.conf"
    try:
        if os.path.exists(mgr_conf_path):
            with open(mgr_conf_path, "r", encoding="utf-8", errors="ignore") as f:
                mgr_txt = f.read()
            if "read = system,call,log,verbose,command,agent,user" in mgr_txt and "security" not in mgr_txt:
                mgr_txt = mgr_txt.replace(
                    "read = system,call,log,verbose,command,agent,user",
                    "read = system,call,log,verbose,command,agent,user,security"
                )
                with open(mgr_conf_path, "w", encoding="utf-8") as f:
                    f.write(mgr_txt)
                subprocess.run(["asterisk", "-rx", "manager reload"], check=False, capture_output=True, timeout=2.0)
    except Exception:
        pass


def configure_and_sync_fail2ban(install_if_missing: bool = False) -> dict:
    """
    Fail2ban Asterisk PJSIP filtresini ve hapishane (jail) kurallarını gelişmiş güvenlik ayarlarına ve
    Güvenli IP / Blok (ignoreip) listesine göre otomatik yapılandırır ve servisi yeniden yükler.
    """
    import subprocess, shutil
    ensure_asterisk_security_logger_and_manager()

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
            filter_content = """[INCLUDES]
before = common.conf

[Definition]
datepattern = ^\\[?%%Y-%%m-%%d %%H:%%M:%%S(?:\\.%%f)?\\]?
              ^\\[?%%b\\s+%%d %%H:%%M:%%S\\]?
              {^LN-BEG}

failregex = ^.*res_pjsip(?:/pjsip_distributor)?\\.c:.*log_failed_request:\\s*Request\\s+'.*'\\s+from\\s+'.*'\\s+failed for\\s+'<HOST>(?::\\d+)?'.*-\\s*(?:No matching endpoint found|Failed to authenticate|Method not allowed).*$
            ^.*SecurityEvent="(?:FailedACL|InvalidAccountID|ChallengeResponseFailed|InvalidPassword|RequestNotSupported|UnexpectedAddress)".*RemoteAddress="IPV[46]/(?:UDP|TCP|TLS|WS|WSS)/<HOST>/\\d+".*$
            ^.*chan_sip\\.c:.*Registration from '.*' failed for '<HOST>(?::\\d+)?' - .*$

ignoreregex =
"""
            with open("/etc/fail2ban/filter.d/asterisk-aida.conf", "w", encoding="utf-8") as ff:
                ff.write(filter_content)

            log_path = "/var/log/asterisk/messages"
            sec_log_path = "/var/log/asterisk/security"
            for lp in (log_path, sec_log_path):
                if not os.path.exists(lp):
                    os.makedirs("/var/log/asterisk", exist_ok=True)
                    with open(lp, "a", encoding="utf-8"):
                        pass

            jail_content = f"""[asterisk]
enabled = true
backend = auto
port = 5060,5061,8088,8089
protocol = all
filter = asterisk-aida
banaction = iptables-allports
logpath = {log_path}
          {sec_log_path}
maxretry = {max_retry}
findtime = 600
bantime = {ban_seconds}
ignoreip = {ignore_ip_str}
"""
            with open("/etc/fail2ban/jail.d/asterisk-pjsip.conf", "w", encoding="utf-8") as jf:
                jf.write(jail_content)

            subprocess.run(["systemctl", "enable", "fail2ban"], check=False, capture_output=True, timeout=3.0)
            subprocess.run(["systemctl", "restart", "fail2ban"], check=False, capture_output=True, timeout=4.0)
        except Exception as e_f2b:
            print(f"[Fail2Ban Config Error]: {e_f2b}")

    # Purge any false-positive 'ChallengeSent' / 'SuccessfulAuth' bans that blocked legitimate WebPhone clients
    existing_blocked = settings_db.get("security_blocked_ips", [])
    cleaned_blocked = [
        item for item in existing_blocked
        if "ChallengeSent" not in str(item.get("reason") or "")
        and "SuccessfulAuth" not in str(item.get("reason") or "")
    ]
    if len(cleaned_blocked) != len(existing_blocked):
        removed_count = len(existing_blocked) - len(cleaned_blocked)
        settings_db["security_blocked_ips"] = cleaned_blocked
        save_settings(settings_db)
        _enforced_kernel_ban_ips.clear()
        try:
            subprocess.run(["iptables", "-t", "raw", "-F", "PREROUTING"], check=False, capture_output=True, timeout=2.0)
            subprocess.run(["fail2ban-client", "unban", "--all"], check=False, capture_output=True, timeout=2.0)
            print(f"[Fail2Ban Cleanup] {removed_count} adet hatalı ChallengeSent IP engeli kaldırıldı ve güvenlik duvarı temizlendi.")
        except Exception:
            pass

    # Re-enforce kernel drops for up to the 40 most recent real blocked IPs
    for item in settings_db.get("security_blocked_ips", [])[:40]:
        b_ip = str(item.get("ip") or "").strip()
        if b_ip and not _is_trusted_or_local_ip(b_ip):
            _enforce_kernel_drop_for_ip(b_ip)

    return {"maxretry": max_retry, "bantime_minutes": ban_minutes, "ignoreip": ignore_ip_str}


def record_and_ban_realtime_sip_attack(ip_addr: str, event_type: str = "InvalidAccountID", account_id: str = "", service: str = "PJSIP"):
    """
    AMI üzerinden gelen gerçek zamanlı SecurityEvent (InvalidAccountID, ChallengeResponseFailed vb.)
    sinyallerini yakalar ve saldırgan IP'yi milisaniyeler içinde engeller.
    """
    import datetime
    if event_type in ("ChallengeSent", "SuccessfulAuth"):
        return
    ip_clean = str(ip_addr or "").strip()
    if not ip_clean or _is_trusted_or_local_ip(ip_clean):
        return

    adv = settings_db.get("security_advanced", {})
    max_retry = max(1, int(adv.get("login_rate_limit") or 3))
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    entry = _realtime_sip_attack_tracker.setdefault(ip_clean, {
        "ip": ip_clean,
        "attempts": 0,
        "last_seen": now_str,
        "req_type": service,
        "from_uri": account_id,
        "reason": f"{event_type} ({account_id})"
    })
    entry["attempts"] += 1
    entry["last_seen"] = now_str
    entry["reason"] = f"AMI {event_type} ({account_id or service})"

    # Instant ban for known scanner probing accounts (<sip:1@1>, NonExistent unknown account brute-force) or >= max_retry
    is_instant_scanner = ("1@1" in str(account_id)) or (event_type == "InvalidAccountID" and entry["attempts"] >= min(2, max_retry))
    if is_instant_scanner or entry["attempts"] >= max_retry:
        _execute_firewall_ban(
            ip_clean,
            jail="asterisk-pjsip",
            reason=f"{entry['reason']} ({entry['attempts']} deneme)"
        )


def scan_asterisk_failed_sip_attempts(auto_ban: bool = True) -> list:
    """
    /var/log/asterisk/messages, /var/log/asterisk/security ve /var/log/asterisk/full dosyalarındaki
    PJSIP 'No matching endpoint found', 'Failed to authenticate' ve gerçek başarısız 'SecurityEvent' saldırı kayıtlarını tarar;
    botnet tarayıcılarını (örn. <sip:1@1>) ve limit aşan saldırgan IP'leri otomatik olarak çekirdek güvenlik duvarında engeller.
    """
    import re
    adv = settings_db.get("security_advanced", {})
    max_retry = max(1, int(adv.get("login_rate_limit") or 3))

    log_files = ["/var/log/asterisk/messages", "/var/log/asterisk/security", "/var/log/asterisk/full"]
    ip_stats = {}

    # Seed from real-time AMI tracker
    for k_ip, k_info in list(_realtime_sip_attack_tracker.items()):
        if not _is_trusted_or_local_ip(k_ip):
            ip_stats[k_ip] = dict(k_info)

    pattern_pjsip = re.compile(
        r"(?:\[([^\]]+)\]|^(\S+\s+\d+\s+\d+:\d+:\d+)).*log_failed_request:\s*Request\s*'([^']+)'\s*from\s*'([^']+)'\s*failed for\s*'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?'(?:\s*\(callid:\s*([^)]+)\))?\s*-\s*(.+)$"
    )
    pattern_sec = re.compile(
        r'(?:\[([^\]]+)\]|^(\S+\s+\d+\s+\d+:\d+:\d+)).*SecurityEvent="(FailedACL|InvalidAccountID|ChallengeResponseFailed|InvalidPassword|RequestNotSupported|UnexpectedAddress)".*AccountID="([^"]*)".*RemoteAddress="IPV[46]/(?:UDP|TCP|TLS|WS|WSS)/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/\d+"'
    )

    all_lines = []
    for lf in log_files:
        if not os.path.exists(lf):
            continue
        try:
            with open(lf, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(0, os.SEEK_END)
                f_size = f.tell()
                # Read last ~384KB for fast non-blocking scan
                f.seek(max(0, f_size - 393216), os.SEEK_SET)
                all_lines.extend(f.readlines()[-3500:])
        except Exception as e_log:
            print(f"[Asterisk Security Log Scan Error]: {e_log}")

    # Also read recent systemd journal for asterisk service (catches CLI notices before logger.conf reload)
    try:
        import subprocess
        res_jctl = subprocess.run(
            ["journalctl", "-u", "asterisk", "-n", "400", "--no-pager"],
            check=False, capture_output=True, text=True, timeout=1.5
        )
        if res_jctl.returncode == 0 and res_jctl.stdout:
            all_lines.extend(res_jctl.stdout.splitlines())
    except Exception:
        pass

    for line in all_lines:
        if "log_failed_request" in line:
            m = pattern_pjsip.search(line.strip())
            if m:
                ts_a, ts_b, req_type, from_uri, ip_addr, call_id, fail_reason = m.groups()
                ts_str = ts_a or ts_b or ""
                call_id = call_id or ""
                if _is_trusted_or_local_ip(ip_addr):
                    continue
                entry = ip_stats.setdefault(ip_addr, {
                    "ip": ip_addr,
                    "attempts": 0,
                    "last_seen": ts_str,
                    "req_type": req_type,
                    "from_uri": from_uri,
                    "reason": fail_reason.strip(),
                    "is_scanner": False
                })
                entry["attempts"] += 1
                entry["last_seen"] = ts_str
                entry["reason"] = f"{fail_reason.strip()} ({req_type} {from_uri})"
                if "<sip:1@1>" in from_uri or call_id.strip() == "1" or "No matching endpoint found" in fail_reason:
                    entry["is_scanner"] = True
        elif "SecurityEvent=" in line:
            m_s = pattern_sec.search(line.strip())
            if m_s:
                ts_a, ts_b, sec_ev, acc_id, ip_addr = m_s.groups()
                ts_str = ts_a or ts_b or ""
                if _is_trusted_or_local_ip(ip_addr):
                    continue
                entry = ip_stats.setdefault(ip_addr, {
                    "ip": ip_addr,
                    "attempts": 0,
                    "last_seen": ts_str,
                    "req_type": "SIP",
                    "from_uri": acc_id,
                    "reason": sec_ev,
                    "is_scanner": False
                })
                entry["attempts"] += 1
                entry["last_seen"] = ts_str
                entry["reason"] = f"{sec_ev} ({acc_id})"
                if sec_ev in ("InvalidAccountID", "FailedACL"):
                    entry["is_scanner"] = True

    already_banned = {item.get("ip") for item in settings_db.get("security_blocked_ips", [])}
    detected_list = []

    for ip_addr, info in ip_stats.items():
        should_ban = info["attempts"] >= max_retry or (info.get("is_scanner") and info["attempts"] >= min(2, max_retry)) or ("<sip:1@1>" in str(info.get("from_uri", "")))
        if auto_ban and should_ban:
            if ip_addr not in already_banned:
                _execute_firewall_ban(
                    ip_addr,
                    jail="asterisk-pjsip",
                    reason=f"{info['reason']} ({info['attempts']} deneme)"
                )
                already_banned.add(ip_addr)
            else:
                # Ensure kernel raw PREROUTING drop is active even if IP was already in settings_db
                _enforce_kernel_drop_for_ip(ip_addr)
        elif ip_addr not in already_banned:
            detected_list.append(info)

    detected_list.sort(key=lambda x: x["attempts"], reverse=True)
    return detected_list


async def asterisk_sip_ips_guard_loop():
    """
    Arka planda her 4 saniyede bir kesintisiz çalışan Gerçek Zamanlı SIP IPS (Saldırı Önleme) Servisi.
    Asterisk loglarını ve PJSIP yetkisiz REGISTER / INVITE / OPTIONS taramalarını yakalayıp
    saldırgan IP'leri raw PREROUTING + INPUT + Fail2Ban üzerinden otomatik engeller.
    """
    import asyncio
    try:
        await asyncio.to_thread(configure_and_sync_fail2ban, False)
        await asyncio.to_thread(scan_asterisk_failed_sip_attempts, True)
        print("[SIP IPS Guard] Gerçek zamanlı Asterisk PJSIP & Fail2Ban koruma kalkanı aktif.")
    except Exception as e_init:
        print(f"[SIP IPS Guard Init Error]: {e_init}")

    while True:
        try:
            await asyncio.sleep(4.0)
            await asyncio.to_thread(scan_asterisk_failed_sip_attempts, True)
        except Exception as e_loop:
            print(f"[SIP IPS Guard Loop Error]: {e_loop}")
            await asyncio.sleep(5.0)



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
    old_ip: Optional[str] = None


@app.post("/api/security/whitelist")
async def add_security_whitelist_ip(request: Request, payload: WhitelistIpSchema, user_info: dict = Depends(get_user_info)):
    import ipaddress, datetime, subprocess
    ip_str = (payload.ip or "").strip()
    old_ip_str = (payload.old_ip or "").strip()
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
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_desc = (payload.description or "Güvenli IP / Blok").strip()

    if old_ip_str:
        # Editing an existing whitelist entry
        if old_ip_str != clean_ip:
            try:
                subprocess.run(["ufw", "delete", "allow", "from", old_ip_str, "to", "any"], check=False, capture_output=True, timeout=2.0)
            except Exception:
                pass
        updated = False
        new_wl = []
        for w in wl:
            if w.get("ip") == old_ip_str:
                if not updated:
                    new_wl.append({
                        "ip": clean_ip,
                        "description": new_desc,
                        "added_at": w.get("added_at") or now_str
                    })
                    updated = True
            elif w.get("ip") == clean_ip and old_ip_str != clean_ip:
                # Avoid duplicate if user edited old_ip into another existing IP
                continue
            else:
                new_wl.append(w)
        if not updated:
            new_wl.insert(0, {
                "ip": clean_ip,
                "description": new_desc,
                "added_at": now_str
            })
        wl = new_wl
    else:
        existing = next((w for w in wl if w.get("ip") == clean_ip), None)
        if existing:
            existing["description"] = new_desc
        else:
            wl.insert(0, {
                "ip": clean_ip,
                "description": new_desc,
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
        "message": (
            f"Güvenli IP kaydı ({clean_ip}) başarıyla güncellendi."
            if old_ip_str
            else f"{clean_ip} güvenli listeye (Fail2Ban ignoreip & UFW Allow) eklendi."
        ),
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


from backend.services.totp_service import (
    generate_totp_secret,
    verify_totp_code,
    build_otpauth_uri,
    generate_qr_svg_data_uri,
    generate_email_otp,
    verify_email_otp,
    send_2fa_email_otp,
    mask_email_address,
    generate_whatsapp_otp,
    verify_whatsapp_otp,
    format_whatsapp_2fa_message,
    mask_phone_number,
    normalize_phone_last10,
    resolve_business_whatsapp_number
)

class Verify2FASchema(BaseModel):
    user_id: str
    code: str
    method: Optional[str] = None
    secret: Optional[str] = None
    phone: Optional[str] = None

class Setup2FASchema(BaseModel):
    reset: Optional[bool] = False
    method: Optional[str] = "google_auth"
    email: Optional[str] = None
    secret: Optional[str] = None

class SendEmailOTPSchema(BaseModel):
    user_id: str
    email: Optional[str] = None

class SendWhatsAppOTPSchema(BaseModel):
    user_id: str
    phone: Optional[str] = None

def _find_disk_user_for_2fa(user_id: str) -> Optional[dict]:
    users = settings_db.get("users", [])
    uid_str = str(user_id or "").strip()
    for u in users:
        if (
            str(u.get("id")) == uid_str
            or str(u.get("extension")) == uid_str
            or str(u.get("username") or "") == uid_str
            or str(u.get("email") or "").lower() == uid_str.lower()
        ):
            return u
    if uid_str in ["admin", "9999"]:
        return next((u for u in users if u.get("role") == "admin"), None)
    return None

def _sync_user_2fa_to_db(user_dict: dict):
    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemUser
        with SyncSessionLocal() as session:
            uid = user_dict.get("id")
            ext = str(user_dict.get("extension") or "")
            q = session.query(SystemUser)
            if uid is not None and str(uid).isdigit():
                db_u = q.filter((SystemUser.id == int(uid)) | (SystemUser.extension == ext)).first()
            else:
                db_u = q.filter(SystemUser.extension == ext).first()
            if db_u:
                if "two_factor_enabled" in user_dict:
                    db_u.two_factor_enabled = bool(user_dict.get("two_factor_enabled", False))
                if "two_factor_method" in user_dict:
                    db_u.two_factor_method = str(user_dict.get("two_factor_method") or "google_auth")
                if "two_factor_secret" in user_dict:
                    db_u.two_factor_secret = user_dict.get("two_factor_secret")
                if "two_factor_enrolled" in user_dict:
                    db_u.two_factor_enrolled = bool(user_dict.get("two_factor_enrolled", False))
                if "gsm_number" in user_dict and user_dict.get("gsm_number"):
                    db_u.gsm_number = str(user_dict.get("gsm_number"))
                session.commit()
    except Exception as e:
        print(f"[2FA DB Sync Notice]: {e}")

@app.get("/api/auth/setup_2fa/{user_id}")
@app.post("/api/auth/setup_2fa/{user_id}")
async def setup_2fa(
    user_id: str,
    reset: bool = False,
    method: str = "google_auth",
    email: Optional[str] = None,
    secret: Optional[str] = None,
    payload: Optional[Setup2FASchema] = None
):
    if payload:
        if payload.reset is not None:
            reset = bool(payload.reset)
        if payload.method:
            method = payload.method
        if payload.email:
            email = payload.email
        if payload.secret:
            secret = payload.secret

    norm_method = str(method or "google_auth").strip().lower()
    if norm_method == "app":
        norm_method = "google_auth"

    biz_wa = resolve_business_whatsapp_number(settings_db)

    # Support preview/new user creation inside UserSettings modal before saving
    if str(user_id).strip().lower() in ["new", "preview", "temp", "0"]:
        active_secret = secret if (secret and not reset) else generate_totp_secret()
        acct = str(email or "kullanici@aida.local").strip()
        uri = build_otpauth_uri(active_secret, account_name=acct, issuer="AIDA", method=norm_method)
        qr_svg = generate_qr_svg_data_uri(uri)
        return {
            "status": "success",
            "secret": active_secret,
            "uri": uri,
            "qr_svg": qr_svg,
            "enrolled": False,
            "method": norm_method,
            "email": acct,
            "masked_email": mask_email_address(acct),
            "business_whatsapp_number": biz_wa
        }

    user = _find_disk_user_for_2fa(user_id)
    if not user:
        # Check DB directly if not in settings_db["users"]
        try:
            from backend.database.config import SyncSessionLocal
            from backend.database.models import SystemUser
            with SyncSessionLocal() as session:
                uid_s = str(user_id).strip()
                if uid_s.isdigit():
                    db_u = session.query(SystemUser).filter((SystemUser.id == int(uid_s)) | (SystemUser.extension == uid_s)).first()
                else:
                    db_u = session.query(SystemUser).filter((SystemUser.extension == uid_s) | (SystemUser.email == uid_s)).first()
                if db_u:
                    user = {c.name: getattr(db_u, c.name) for c in db_u.__table__.columns}
                    if "users" not in settings_db:
                        settings_db["users"] = []
                    settings_db["users"].append(user)
        except Exception as e:
            print(f"[Setup 2FA DB Lookup Warning]: {e}")

    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    active_secret = user.get("two_factor_secret")
    if reset or not active_secret:
        active_secret = generate_totp_secret()
        user["two_factor_secret"] = active_secret
        if reset:
            user["two_factor_enrolled"] = False
        save_settings(settings_db)
        _sync_user_2fa_to_db(user)

    acct_label = str(email or user.get("email") or user.get("extension") or user.get("full_name") or user_id).strip()
    uri = build_otpauth_uri(active_secret, account_name=acct_label, issuer="AIDA", method=norm_method)
    qr_svg = generate_qr_svg_data_uri(uri)
    user_gsm = user.get("gsm_number") or (user.get("follow_me", {}) or {}).get("mobile_number") or ""

    return {
        "status": "success",
        "secret": active_secret,
        "uri": uri,
        "qr_svg": qr_svg,
        "enrolled": bool(user.get("two_factor_enrolled", False)),
        "method": user.get("two_factor_method") or norm_method,
        "email": user.get("email", ""),
        "masked_email": mask_email_address(user.get("email", "")),
        "phone": user_gsm,
        "masked_phone": mask_phone_number(user_gsm),
        "business_whatsapp_number": biz_wa
    }

@app.post("/api/auth/2fa/send-email-otp")
@app.post("/auth/2fa/send-email-otp")
async def send_email_otp_endpoint(payload: SendEmailOTPSchema, request: Request):
    tenant_id = request.headers.get("X-Tenant-ID") or request.headers.get("Tenant-ID") or "tenant-default"
    uid_str = str(payload.user_id or "").strip()

    user = None if uid_str.lower() in ["new", "preview", "temp", "0"] else _find_disk_user_for_2fa(uid_str)
    if not user and uid_str.lower() not in ["new", "preview", "temp", "0"]:
        try:
            from backend.database.config import SyncSessionLocal
            from backend.database.models import SystemUser
            with SyncSessionLocal() as session:
                if uid_str.isdigit():
                    db_u = session.query(SystemUser).filter((SystemUser.id == int(uid_str)) | (SystemUser.extension == uid_str)).first()
                else:
                    db_u = session.query(SystemUser).filter((SystemUser.extension == uid_str) | (SystemUser.email == uid_str)).first()
                if db_u:
                    user = {c.name: getattr(db_u, c.name) for c in db_u.__table__.columns}
        except Exception:
            pass

    target_email = str(payload.email or (user.get("email") if user else "") or "").strip()
    if not target_email or "@" not in target_email or target_email.endswith("@localhost"):
        raise HTTPException(
            status_code=400,
            detail="Kullanıcıya tanımlı geçerli bir E-Posta adresi bulunamadı. Lütfen önce kullanıcı ayarlarından geçerli bir e-posta adresi tanımlayın."
        )

    user_key = str(user.get("id")) if (user and user.get("id") is not None) else uid_str
    user_name = (user.get("full_name") or user.get("name") or "Kullanıcı") if user else "Kullanıcı"
    user_tenant = (user.get("tenant_id") if user else None) or tenant_id

    otp_info = generate_email_otp(user_key=user_key, email_str=target_email, ttl_seconds=180)
    # Also store under uid_str and extension so lookup succeeds regardless of identifier used
    if uid_str != user_key:
        from backend.services.totp_service import _EMAIL_OTP_CACHE
        _EMAIL_OTP_CACHE[uid_str] = _EMAIL_OTP_CACHE[user_key]
    if user and user.get("extension"):
        from backend.services.totp_service import _EMAIL_OTP_CACHE
        _EMAIL_OTP_CACHE[str(user.get("extension"))] = _EMAIL_OTP_CACHE[user_key]

    send_res = await send_2fa_email_otp(
        settings_db=settings_db,
        tenant_id=user_tenant,
        to_email=target_email,
        user_name=user_name,
        otp_code=otp_info["code"],
        ttl_seconds=180
    )
    if send_res.get("status") != "success":
        raise HTTPException(status_code=400, detail=send_res.get("message") or "E-Posta gönderilemedi. SMTP ayarlarını kontrol edin.")

    return {
        "status": "success",
        "message": f"6 haneli doğrulama kodu {otp_info['masked_email']} adresine gönderildi.",
        "masked_email": otp_info["masked_email"],
        "expires_in": 180
    }

@app.post("/api/auth/2fa/send-whatsapp-otp")
@app.post("/auth/2fa/send-whatsapp-otp")
async def send_whatsapp_otp_endpoint(payload: SendWhatsAppOTPSchema):
    from backend.services.whatsapp_service import send_whatsapp_message
    uid_str = str(payload.user_id or "").strip()

    user = None if uid_str.lower() in ["new", "preview", "temp", "0"] else _find_disk_user_for_2fa(uid_str)
    if not user and uid_str.lower() not in ["new", "preview", "temp", "0"]:
        try:
            from backend.database.config import SyncSessionLocal
            from backend.database.models import SystemUser
            with SyncSessionLocal() as session:
                if uid_str.isdigit():
                    db_u = session.query(SystemUser).filter((SystemUser.id == int(uid_str)) | (SystemUser.extension == uid_str)).first()
                else:
                    db_u = session.query(SystemUser).filter((SystemUser.extension == uid_str) | (SystemUser.email == uid_str)).first()
                if db_u:
                    user = {c.name: getattr(db_u, c.name) for c in db_u.__table__.columns}
        except Exception:
            pass

    user_gsm = ""
    if user:
        user_gsm = user.get("gsm_number") or (user.get("follow_me", {}) or {}).get("mobile_number") or ""
    target_phone = str(payload.phone or user_gsm or "").strip()
    last10 = normalize_phone_last10(target_phone)

    if len(last10) < 10:
        raise HTTPException(
            status_code=400,
            detail="Kullanıcıya tanımlı geçerli bir Cep Telefonu (GSM) numarası bulunamadı. Lütfen önce GSM numarası tanımlayın."
        )

    user_key = str(user.get("id")) if (user and user.get("id") is not None) else uid_str
    ext_key = str(user.get("extension") or "") if user else ""
    user_name = (user.get("full_name") or user.get("name") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "Kullanıcı") if user else "Kullanıcı"

    otp_info = generate_whatsapp_otp([user_key, uid_str, ext_key, last10], target_phone, ttl_seconds=300)
    msg_text = format_whatsapp_2fa_message(user_name, otp_info["code"], ttl_seconds=300)
    biz_wa = resolve_business_whatsapp_number(settings_db)

    sent_ok = await send_whatsapp_message(target_phone, msg_text)
    if sent_ok:
        return {
            "status": "success",
            "sent_direct": True,
            "message": f"5 dakika geçerli 6 haneli doğrulama kodu {otp_info['masked_phone']} numaralı WhatsApp hattına gönderildi.",
            "masked_phone": otp_info["masked_phone"],
            "business_whatsapp_number": biz_wa,
            "expires_in": 300
        }
    else:
        return {
            "status": "success",
            "sent_direct": False,
            "message": f"24 saatlik ücretsiz WhatsApp penceresini açmak için lütfen WhatsApp üzerinden 'Giriş Kodu' mesajı gönderin.",
            "masked_phone": otp_info["masked_phone"],
            "business_whatsapp_number": biz_wa,
            "expires_in": 300
        }

@app.post("/api/auth/verify_2fa")
@app.post("/auth/verify_2fa")
async def verify_2fa(payload: Verify2FASchema):
    uid_str = str(payload.user_id or "").strip()
    code = str(payload.code or "").strip()

    # Handle preview/new user verification in UserSettings modal
    if uid_str.lower() in ["new", "preview", "temp", "0"]:
        req_method = str(payload.method or "google_auth").strip().lower()
        if req_method == "email":
            if verify_email_otp(uid_str, code):
                return {"status": "success", "message": "E-Posta 2FA doğrulama kodu onaylandı.", "enrolled": True}
            raise HTTPException(status_code=401, detail="Geçersiz veya süresi dolmuş E-Posta doğrulama kodu.")
        elif req_method == "whatsapp":
            if verify_whatsapp_otp([uid_str, str(payload.phone or "")], code):
                return {"status": "success", "message": "WhatsApp 2FA doğrulama kodu onaylandı.", "enrolled": True}
            raise HTTPException(status_code=401, detail="Geçersiz veya süresi dolmuş (5 dk) WhatsApp doğrulama kodu.")
        else:
            if not payload.secret:
                raise HTTPException(status_code=400, detail="2FA kurulum anahtarı (secret) bulunamadı.")
            if verify_totp_code(payload.secret, code):
                return {"status": "success", "message": "Authenticator kodu başarıyla doğrulandı.", "enrolled": True}
            raise HTTPException(status_code=401, detail="Geçersiz 6 haneli Authenticator doğrulama kodu.")

    user = _find_disk_user_for_2fa(uid_str)
    if not user:
        try:
            from backend.database.config import SyncSessionLocal
            from backend.database.models import SystemUser
            with SyncSessionLocal() as session:
                if uid_str.isdigit():
                    db_u = session.query(SystemUser).filter((SystemUser.id == int(uid_str)) | (SystemUser.extension == uid_str)).first()
                else:
                    db_u = session.query(SystemUser).filter((SystemUser.extension == uid_str) | (SystemUser.email == uid_str)).first()
                if db_u:
                    user = {c.name: getattr(db_u, c.name) for c in db_u.__table__.columns}
                    if "users" not in settings_db:
                        settings_db["users"] = []
                    settings_db["users"].append(user)
        except Exception:
            pass

    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    eff_method = str(payload.method or user.get("two_factor_method") or "google_auth").strip().lower()
    if eff_method == "email":
        verified = (
            verify_email_otp(str(user.get("id")), code)
            or verify_email_otp(uid_str, code)
            or verify_email_otp(str(user.get("extension") or ""), code)
        )
        if verified:
            user["two_factor_enrolled"] = True
            save_settings(settings_db)
            _sync_user_2fa_to_db(user)
            return {
                "status": "success",
                "message": "E-Posta 2FA doğrulaması başarılı.",
                "enrolled": True,
                "method": "email"
            }
        raise HTTPException(status_code=401, detail="Geçersiz veya süresi dolmuş E-Posta doğrulama kodu.")

    if eff_method == "whatsapp":
        user_gsm = user.get("gsm_number") or (user.get("follow_me", {}) or {}).get("mobile_number") or ""
        candidate_keys = [
            str(user.get("id") or ""),
            uid_str,
            str(user.get("extension") or ""),
            str(user_gsm),
            str(payload.phone or "")
        ]
        if verify_whatsapp_otp(candidate_keys, code):
            user["two_factor_enrolled"] = True
            user["two_factor_method"] = "whatsapp"
            if payload.phone and not user.get("gsm_number"):
                user["gsm_number"] = str(payload.phone).strip()
            save_settings(settings_db)
            _sync_user_2fa_to_db(user)
            return {
                "status": "success",
                "message": "WhatsApp 2FA doğrulaması başarılı.",
                "enrolled": True,
                "method": "whatsapp"
            }
        raise HTTPException(
            status_code=401,
            detail="Geçersiz veya süresi dolmuş (5 dk) WhatsApp doğrulama kodu. Lütfen WhatsApp hattımıza 'Giriş Kodu' yazarak yeni kod alınız."
        )

    # Google Authenticator / Microsoft Authenticator / TOTP App verification
    secret = payload.secret or user.get("two_factor_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Bu kullanıcı için henüz Authenticator anahtarı oluşturulmamış.")

    if verify_totp_code(secret, code):
        user["two_factor_secret"] = secret
        user["two_factor_enrolled"] = True
        if payload.method and payload.method in ["google_auth", "microsoft_auth"]:
            user["two_factor_method"] = payload.method
        save_settings(settings_db)
        _sync_user_2fa_to_db(user)
        return {
            "status": "success",
            "message": "Authenticator 2FA doğrulaması başarılı.",
            "enrolled": True,
            "method": user.get("two_factor_method") or eff_method
        }
    else:
        raise HTTPException(status_code=401, detail="Geçersiz 6 haneli doğrulama kodu. Lütfen uygulamadaki güncel kodu giriniz.")

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
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS smart_callback_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS smart_callback_max_wait_seconds INTEGER DEFAULT 60;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS smart_callback_queue_threshold INTEGER DEFAULT 3;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS smart_callback_max_retries INTEGER DEFAULT 3;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS smart_callback_retry_interval INTEGER DEFAULT 60;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS smart_callback_priority_level VARCHAR DEFAULT 'high';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS smart_callback_outbound_trunk_id INTEGER DEFAULT 1;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS smart_callback_missed_call_auto BOOLEAN DEFAULT TRUE;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_scale VARCHAR DEFAULT '1-5';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_question_announcement VARCHAR DEFAULT '';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_thank_you_announcement VARCHAR DEFAULT '';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_thank_you_text VARCHAR DEFAULT '';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_thank_you_voice VARCHAR DEFAULT 'tr-TR-EmelNeural';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_questions JSON DEFAULT '[]';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_timeout_sec INTEGER DEFAULT 10;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS survey_low_score_threshold INTEGER DEFAULT 2;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS max_concurrent_breaks INTEGER DEFAULT 0;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS disposition_codes JSON DEFAULT '[]';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS auto_pause_missed_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS auto_pause_missed_count INTEGER DEFAULT 1;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS auto_pause_disconnect_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS auto_pause_disconnect_grace_sec INTEGER DEFAULT 15;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS auto_pause_reconnect_mode VARCHAR DEFAULT 'manual';",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS auto_pause_notify_user BOOLEAN DEFAULT TRUE;",
                "ALTER TABLE pbx_queues ADD COLUMN IF NOT EXISTS auto_pause_notify_channels VARCHAR DEFAULT 'both';",
                "ALTER TABLE queue_survey_responses ADD COLUMN IF NOT EXISTS question_answers JSON DEFAULT '[]';",
                "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS recipient_info VARCHAR;",
                "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS assigned_user VARCHAR;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS active_profile VARCHAR DEFAULT 'available';",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS profiles JSON DEFAULT '[]';",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS sip_username VARCHAR;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS max_activations INTEGER DEFAULT 1;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS follow_me JSON;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS two_factor_method VARCHAR DEFAULT 'google_auth';",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS two_factor_enrolled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS managed_users JSON DEFAULT '[]';",
                "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS managed_queues JSON DEFAULT '[]';",
                "ALTER TABLE trunks ADD COLUMN IF NOT EXISTS max_channels INTEGER DEFAULT 30;",
                "ALTER TABLE trunks ADD COLUMN IF NOT EXISTS codecs JSON DEFAULT '[\"alaw\", \"ulaw\", \"g722\", \"g729\"]';",
                "ALTER TABLE trunks ADD COLUMN IF NOT EXISTS call_limit_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE trunks ADD COLUMN IF NOT EXISTS call_limit_direction VARCHAR DEFAULT 'both';",
                "ALTER TABLE trunks ADD COLUMN IF NOT EXISTS sip_headers JSON DEFAULT '{}';",
                "ALTER TABLE trunks ALTER COLUMN host DROP NOT NULL;",
                "ALTER TABLE calls ADD COLUMN IF NOT EXISTS agent_name VARCHAR;",
                "ALTER TABLE agent_break_logs ADD COLUMN IF NOT EXISTS agent_name VARCHAR;"
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

            # Backfill missing agent_name snapshots on existing Call and AgentBreakLog rows
            try:
                res_null_calls = await session.execute(select(Call).where(or_(Call.agent_name.is_(None), Call.agent_name == "")))
                for c_row in res_null_calls.scalars().all():
                    resolved_c_ag = resolve_call_agent_name_snapshot(
                        c_row.caller_number,
                        c_row.callee_number,
                        c_row.status,
                        c_row.hangup_source
                    )
                    if resolved_c_ag:
                        c_row.agent_name = resolved_c_ag

                res_null_breaks = await session.execute(select(AgentBreakLog).where(or_(AgentBreakLog.agent_name.is_(None), AgentBreakLog.agent_name == "")))
                for b_row in res_null_breaks.scalars().all():
                    resolved_b_ag = resolve_user_name_by_ext_or_id(b_row.extension or b_row.user_id)
                    if resolved_b_ag:
                        b_row.agent_name = resolved_b_ag
            except Exception as e_bf:
                print(f"[Startup Agent Name Backfill Warning]: {e_bf}")

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

    try:
        await asyncio.wait_for(seed_db_tables(), timeout=5.0)
    except Exception as e:
        print(f"[Database Init/Seeding Timeout or Error]: {e}")
        global settings_db
        settings_db.update(load_settings())

    # Regenerate Asterisk configs (PJSIP endpoints, trunks, queues, dialplan) for native or docker Asterisk
    try:
        from backend.services.ami_manager import ensure_asterisk_alive_sync
        regenerate_pjsip_custom_conf()
        regenerate_queues_conf()
        regenerate_extensions_custom_conf()
        await asyncio.to_thread(ensure_asterisk_alive_sync, False)
        print("[Asterisk Startup Sync] PJSIP, Kuyruk ve Dialplan başarıyla güncellendi.")
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
        
    asyncio.create_task(start_ami_listener())
    asyncio.create_task(asterisk_sip_ips_guard_loop())

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
            for fk in ("forwarding_always", "forwarding_busy", "forwarding_no_answer"):
                if u.get(fk) is None and disk_u.get(fk) is not None:
                    u[fk] = disk_u.get(fk)
            if (not u.get("sip_password") or u.get("sip_password") == "1234") and disk_u.get("sip_password"):
                u["sip_password"] = disk_u.get("sip_password")
            if not u.get("sip_username") and disk_u.get("sip_username"):
                u["sip_username"] = disk_u.get("sip_username")
            if not u.get("two_factor_enabled") and disk_u.get("two_factor_enabled"):
                u["two_factor_enabled"] = disk_u.get("two_factor_enabled")
            if disk_u.get("two_factor_method") and (not u.get("two_factor_method") or u.get("two_factor_method") == "app"):
                u["two_factor_method"] = disk_u.get("two_factor_method")
            if not u.get("two_factor_secret") and disk_u.get("two_factor_secret"):
                u["two_factor_secret"] = disk_u.get("two_factor_secret")
            if not u.get("two_factor_enrolled") and disk_u.get("two_factor_enrolled"):
                u["two_factor_enrolled"] = disk_u.get("two_factor_enrolled")
            if not u.get("managed_users") and disk_u.get("managed_users"):
                u["managed_users"] = disk_u.get("managed_users")
            if not u.get("managed_queues") and disk_u.get("managed_queues"):
                u["managed_queues"] = disk_u.get("managed_queues")
        if u.get("two_factor_method") == "app" or not u.get("two_factor_method"):
            u["two_factor_method"] = "google_auth"
        u["two_factor_enabled"] = bool(u.get("two_factor_enabled", False))
        u["two_factor_enrolled"] = bool(u.get("two_factor_enrolled", False))
        for mk in ("managed_users", "managed_queues"):
            mval = u.get(mk)
            if isinstance(mval, str) and mval.strip().startswith("["):
                try:
                    u[mk] = json.loads(mval)
                except Exception:
                    u[mk] = []
            elif not isinstance(mval, list):
                u[mk] = []
        for fk in ("forwarding_always", "forwarding_busy", "forwarding_no_answer"):
            fval = u.get(fk)
            if isinstance(fval, str) and fval.strip().startswith("{"):
                try:
                    u[fk] = json.loads(fval)
                except Exception:
                    pass
        u["sip_password"] = resolve_secure_sip_password(ext, u.get("sip_password") or "")
        ensure_user_profiles(u)
        reg_ip = registered_endpoints.get_ip(ext) or registered_endpoints.get_ip(uid)
        st_ext = get_agent_state(ext)
        st_uid = get_agent_state(uid)
        presence_online = (st_ext and st_ext.get("is_logged_in", False)) or (st_uid and st_uid.get("is_logged_in", False))
        is_reg = (ext in registered_endpoints or uid in registered_endpoints) and presence_online
        u["is_registered"] = is_reg
        u["sip_status"] = "online" if is_reg else "offline"
        u["call_state"] = get_live_user_call_state(ext, is_reg)
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
        json_cols = {"profiles", "follow_me", "forwarding_always", "forwarding_busy", "forwarding_no_answer", "active_sessions", "managed_users", "managed_queues"}
        saved_payload_by_ext = {}
        saved_payload_by_id = {}

        for idx, item in enumerate(items_list):
            data = item.model_dump()
            ensure_user_profiles(data)
            ext_str = str(data.get("extension") or "")
            data["sip_password"] = resolve_secure_sip_password(ext_str, data.get("sip_password") or "")
            if data.get("two_factor_method") == "app" or not data.get("two_factor_method"):
                data["two_factor_method"] = "google_auth"

            target_user = None
            if data.get("id") and data.get("id") in existing_by_id:
                target_user = existing_by_id[data.get("id")]
            elif ext_str and ext_str in existing_by_ext:
                target_user = existing_by_ext[ext_str]

            prev_disk = existing_disk_by_id.get(data.get("id")) or existing_disk_by_ext.get(ext_str) or {}
            # Preserve existing 2FA secret if not explicitly overwritten
            if not data.get("two_factor_secret"):
                existing_sec = (getattr(target_user, "two_factor_secret", None) if target_user else None) or prev_disk.get("two_factor_secret")
                if existing_sec:
                    data["two_factor_secret"] = existing_sec
            # Auto-generate a TOTP secret if 2FA is enabled with an Authenticator app and no secret exists yet
            if data.get("two_factor_enabled") and data.get("two_factor_method") in ["google_auth", "microsoft_auth"] and not data.get("two_factor_secret"):
                data["two_factor_secret"] = generate_totp_secret()
            if not data.get("two_factor_enrolled") and prev_disk.get("two_factor_enrolled"):
                data["two_factor_enrolled"] = True

            if data.get("managed_users") is None:
                data["managed_users"] = (getattr(target_user, "managed_users", None) if target_user else None) or prev_disk.get("managed_users") or []
            if data.get("managed_queues") is None:
                data["managed_queues"] = (getattr(target_user, "managed_queues", None) if target_user else None) or prev_disk.get("managed_queues") or []

            if ext_str:
                saved_payload_by_ext[ext_str] = data
            if data.get("id") is not None:
                saved_payload_by_id[data.get("id")] = data

            filtered_data = {k: v for k, v in data.items() if k in valid_keys and k != "id"}

            if target_user:
                old_name = str(getattr(target_user, "full_name", "") or "").strip()
                if not old_name and ext_str in existing_disk_by_ext:
                    old_name = str(existing_disk_by_ext[ext_str].get("full_name") or existing_disk_by_ext[ext_str].get("name") or "").strip()
                old_ext = str(getattr(target_user, "extension", "") or ext_str or "").strip()
                new_name = str(data.get("full_name") or "").strip()

                if old_name and old_ext:
                    try:
                        stmt_preserve_calls = (
                            update(Call)
                            .where(
                                or_(Call.agent_name.is_(None), Call.agent_name == ""),
                                or_(
                                    Call.caller_number == old_ext,
                                    Call.callee_number == old_ext,
                                    Call.hangup_source == f"transfer:{old_ext}"
                                )
                            )
                            .values(agent_name=old_name)
                        )
                        await db.execute(stmt_preserve_calls)

                        stmt_preserve_breaks = (
                            update(AgentBreakLog)
                            .where(
                                or_(AgentBreakLog.agent_name.is_(None), AgentBreakLog.agent_name == ""),
                                or_(
                                    AgentBreakLog.extension == old_ext,
                                    AgentBreakLog.user_id == str(target_user.id),
                                    AgentBreakLog.user_id == old_ext
                                )
                            )
                            .values(agent_name=old_name)
                        )
                        await db.execute(stmt_preserve_breaks)
                    except Exception as e_pres:
                        print(f"[Preserve Historical Agent Name Warning]: {e_pres}")

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
                        for tf_k in ("two_factor_enabled", "two_factor_method", "two_factor_secret", "two_factor_enrolled", "managed_users", "managed_queues"):
                            if p_match.get(tf_k) is not None:
                                u_dict[tf_k] = p_match.get(tf_k)
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
            sup_Required = ["supervisor:access", "supervisor:agent_status", "supervisor:agent_logout", "supervisor:scope_filter"]
            for r in roles:
                d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
                perms_list = list(d.get("permissions") or [])
                if d.get("role_code") in ["admin", "superadmin"]:
                    perms_list = list(set(perms_list + admin_defaults))
                elif d.get("role_code") == "supervisor":
                    if not any(str(p).startswith("supervisor") for p in perms_list):
                        perms_list = list(set(perms_list + sup_Required))
                d["permissions"] = perms_list
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


def _resolve_survey_announcement_wav(ann_val: str, default_wav: str) -> str:
    if not ann_val or not str(ann_val).strip():
        return default_wav
    val_str = str(ann_val).strip()
    for a in settings_db.get("announcements", []):
        if str(a.get("id")) == val_str or str(a.get("filename")) == val_str or str(a.get("name")) == val_str:
            ann_id = str(a.get("id") or "").strip()
            fname = str(a.get("filename") or "").strip()
            if fname:
                src_fp = os.path.join("uploads/announcements", fname)
                if ann_id and os.path.exists(src_fp):
                    wav_check = os.path.join("/var/spool/asterisk/monitor", f"{ann_id}.wav")
                    local_wav_check = os.path.join(ASTERISK_CONFIG_DIR, "sounds_tr", f"{ann_id}.wav")
                    if not os.path.exists(wav_check) and not os.path.exists(local_wav_check):
                        _convert_and_sync_announcement_wav(src_fp, ann_id)
                base_name = os.path.splitext(fname)[0]
                return base_name or ann_id or default_wav
            if ann_id:
                return ann_id
    base_val = os.path.splitext(val_str)[0]
    return base_val or default_wav


def _extract_clean_agent_ext(raw_agent: str) -> str:
    if not raw_agent:
        return ""
    s = str(raw_agent).strip()
    if "/" in s:
        s = s.split("/", 1)[1]
    if "@" in s:
        s = s.split("@", 1)[0]
    if "-" in s:
        s = s.split("-", 1)[0]
    return s.strip()


@app.get("/api/queues/survey/config")
async def get_queue_survey_config_for_dialplan(
    queue_ext: Optional[str] = "",
    agent_ext: Optional[str] = "",
    call_id: Optional[str] = "",
    db: AsyncSession = Depends(get_db)
):
    """
    Called by Asterisk dialplan right after a queue or agent call ends from the agent side.
    Returns: ENABLED:<queue_ext>:<max_digits>:<timeout>:<q_wav_1>&<q_wav_2>...:<thankyou_wav>:<q_count> or DISABLED
    """
    try:
        res = await db.execute(select(PBXQueue).order_by(PBXQueue.id))
        db_queues = res.scalars().all()
        queues_list = [{c.name: getattr(item, c.name) for c in item.__table__.columns} for item in db_queues]
    except Exception:
        queues_list = []
    if not queues_list:
        queues_list = settings_db.get("queues", [])

    clean_q = str(queue_ext or "").strip()
    clean_ag = _extract_clean_agent_ext(agent_ext or "")

    matched_q = None
    # 1. Exact queue extension or name match
    if clean_q and clean_q != "temsilci_kuyrugu":
        for q in queues_list:
            if str(q.get("extension") or "") == clean_q or str(q.get("name") or "") == clean_q:
                matched_q = q
                break

    # 2. Match by agent membership in an active survey-enabled queue
    if not matched_q and clean_ag:
        for q in queues_list:
            if not q.get("survey_enabled"):
                continue
            members = q.get("queueMembers") or []
            for m in members:
                if isinstance(m, dict):
                    m_ext = str(m.get("extension") or m.get("user_id") or "")
                    if m_ext == clean_ag:
                        matched_q = q
                        break
            if matched_q:
                break

    # 3. Fallback for generic transfer_to_human queue
    if not matched_q and clean_q == "temsilci_kuyrugu":
        matched_q = next((q for q in queues_list if q.get("survey_enabled")), None)

    if not matched_q or not matched_q.get("survey_enabled"):
        return PlainTextResponse("DISABLED")

    q_ext_resolved = str(matched_q.get("extension") or clean_q or "2000")
    scale = str(matched_q.get("survey_scale") or "1-5")
    max_digits = 2 if scale == "1-10" else 1
    timeout_sec = max(3, min(30, int(matched_q.get("survey_timeout_sec") or 10)))

    raw_questions = matched_q.get("survey_questions")
    if isinstance(raw_questions, str):
        try:
            raw_questions = json.loads(raw_questions)
        except Exception:
            raw_questions = []

    q_wav_list = []
    if isinstance(raw_questions, list) and len(raw_questions) > 0:
        for q_item in raw_questions:
            if isinstance(q_item, dict):
                ann_ref = q_item.get("announcement_id") or q_item.get("announcement") or ""
                q_wav_list.append(_resolve_survey_announcement_wav(ann_ref, "tr_anket_soru"))
    if not q_wav_list:
        q_wav_list = [_resolve_survey_announcement_wav(matched_q.get("survey_question_announcement"), "tr_anket_soru")]

    q_wavs_str = "&".join(q_wav_list)
    ty_wav = _resolve_survey_announcement_wav(matched_q.get("survey_thank_you_announcement"), "tr_anket_tesekkur")

    return PlainTextResponse(f"ENABLED:{q_ext_resolved}:{max_digits}:{timeout_sec}:{q_wavs_str}:{ty_wav}:{len(q_wav_list)}")


@app.get("/api/queues/survey/submit")
@app.post("/api/queues/survey/submit")
async def submit_queue_survey_response(
    request: Request,
    call_id: Optional[str] = "",
    queue_ext: Optional[str] = "",
    agent_ext: Optional[str] = "",
    caller: Optional[str] = "",
    score: Optional[str] = "",
    db: AsyncSession = Depends(get_db)
):
    """Records post-call queue satisfaction survey response from Asterisk DTMF or API (supports single or multi-question comma-separated scores)."""
    body_data = {}
    if request.method == "POST":
        try:
            body_data = await request.json()
        except Exception:
            body_data = {}

    c_id = str(body_data.get("call_id") or call_id or "").strip()
    q_ext = str(body_data.get("queue_ext") or body_data.get("queue_extension") or queue_ext or "").strip()
    ag_ext = _extract_clean_agent_ext(body_data.get("agent_ext") or body_data.get("agent_extension") or agent_ext or "")
    caller_num = str(body_data.get("caller") or body_data.get("caller_number") or caller or "").strip()
    raw_score = str(body_data.get("score") if body_data.get("score") is not None else (score or "")).strip()
    tenant_id = str(body_data.get("tenant_id") or request.headers.get("X-Tenant-ID") or "tenant-default")

    # Resolve queue metadata
    queues_list = []
    try:
        res_q = await db.execute(select(PBXQueue))
        queues_list = [{c.name: getattr(item, c.name) for c in item.__table__.columns} for item in res_q.scalars().all()]
    except Exception:
        pass
    if not queues_list:
        queues_list = settings_db.get("queues", [])

    matched_q = next((q for q in queues_list if str(q.get("extension") or "") == q_ext or str(q.get("name") or "") == q_ext), None)
    if not matched_q and queues_list:
        matched_q = next((q for q in queues_list if q.get("survey_enabled")), queues_list[0])

    q_name = matched_q.get("name", f"Kuyruk {q_ext}") if matched_q else (f"Kuyruk {q_ext}" if q_ext else "Genel Kuyruk")
    if matched_q and not q_ext:
        q_ext = str(matched_q.get("extension") or "2000")
    scale = str(matched_q.get("survey_scale") or "1-5") if matched_q else "1-5"
    max_score = 10 if scale == "1-10" else (2 if scale == "1-2" else 5)
    low_threshold = int(matched_q.get("survey_low_score_threshold") or 2) if matched_q else 2

    raw_questions = matched_q.get("survey_questions") if matched_q else []
    if isinstance(raw_questions, str):
        try:
            raw_questions = json.loads(raw_questions)
        except Exception:
            raw_questions = []
    if not isinstance(raw_questions, list):
        raw_questions = []

    # Resolve agent & caller from Call table if missing
    ag_name = ""
    if c_id:
        try:
            call_row = await db.get(Call, c_id)
            if call_row:
                if not caller_num and call_row.caller_number:
                    caller_num = call_row.caller_number
                if not ag_ext and call_row.callee_number and len(str(call_row.callee_number)) <= 5:
                    ag_ext = str(call_row.callee_number)
                if call_row.agent_name:
                    ag_name = call_row.agent_name
        except Exception:
            pass

    # Resolve agent name from users list
    if ag_ext and not ag_name:
        try:
            res_u = await db.execute(select(SystemUser).where(SystemUser.extension == ag_ext))
            u_row = res_u.scalars().first()
            if u_row and u_row.full_name:
                ag_name = u_row.full_name
        except Exception:
            pass
        if not ag_name:
            for u in settings_db.get("users", []):
                if str(u.get("extension") or "") == ag_ext:
                    ag_name = u.get("full_name") or f"Dahili {ag_ext}"
                    break
    if not ag_name:
        ag_name = f"Dahili {ag_ext}" if ag_ext else "Temsilci"

    # Parse single or multi-question score(s)
    score_parts = raw_score.split(",") if "," in raw_score else ([raw_score] if raw_score != "" else [])
    question_answers = []
    valid_scores = []
    any_invalid = False

    total_q_len = max(len(score_parts), len(raw_questions), 1)
    for idx in range(total_q_len):
        part_str = score_parts[idx].strip() if idx < len(score_parts) else ""
        q_meta = raw_questions[idx] if idx < len(raw_questions) and isinstance(raw_questions[idx], dict) else {}
        q_title = str(q_meta.get("title") or q_meta.get("question_text") or q_meta.get("text") or f"{idx + 1}. Soru").strip()
        q_sc = None
        q_st = "timeout"
        if part_str != "":
            try:
                p_int = int(part_str)
                q_sc = p_int
                if 1 <= p_int <= max_score:
                    q_st = "completed"
                    valid_scores.append(p_int)
                else:
                    q_st = "invalid"
                    any_invalid = True
            except Exception:
                q_st = "invalid"
                any_invalid = True
        question_answers.append({
            "question_index": idx + 1,
            "question_text": q_title,
            "score": q_sc,
            "max_score": max_score,
            "status": q_st
        })

    if valid_scores:
        score_val = int(round(sum(valid_scores) / len(valid_scores)))
        status_val = "completed"
    elif any_invalid:
        score_val = question_answers[0]["score"] if question_answers else None
        status_val = "invalid"
    else:
        score_val = None
        status_val = "timeout"

    now_utc = datetime.datetime.utcnow()
    new_resp = QueueSurveyResponse(
        tenant_id=tenant_id,
        call_id=c_id or None,
        queue_extension=q_ext or "2000",
        queue_name=q_name,
        agent_extension=ag_ext or "",
        agent_name=ag_name,
        caller_number=caller_num or "Bilinmeyen",
        score=score_val,
        max_score=max_score,
        question_answers=question_answers,
        status=status_val,
        timestamp=now_utc
    )
    try:
        db.add(new_resp)
        await db.commit()
        await db.refresh(new_resp)
        saved_id = new_resp.id
    except Exception as db_err:
        print(f"[Survey DB Save Warning]: {db_err}")
        await db.rollback()
        saved_id = int(now_utc.timestamp() * 1000)

    # Also mirror in settings_db for instant fallback
    survey_list = list(settings_db.get("queue_survey_responses", []))
    survey_list.insert(0, {
        "id": saved_id,
        "tenant_id": tenant_id,
        "call_id": c_id or None,
        "queue_extension": q_ext or "2000",
        "queue_name": q_name,
        "agent_extension": ag_ext or "",
        "agent_name": ag_name,
        "caller_number": caller_num or "Bilinmeyen",
        "score": score_val,
        "max_score": max_score,
        "question_answers": question_answers,
        "status": status_val,
        "timestamp": now_utc.isoformat()
    })
    settings_db["queue_survey_responses"] = survey_list[:1000]
    save_settings(settings_db)

    if status_val == "completed" and score_val is not None and score_val <= low_threshold:
        add_system_log("QUEUE_SURVEY", "WARNING", f"Düşük Anket Puanı ({score_val}/{max_score}): Kuyruk={q_name} ({q_ext}), Temsilci={ag_name}, Arayan={caller_num}")
    elif status_val == "completed":
        add_system_log("QUEUE_SURVEY", "INFO", f"Anket Tamamlandı ({score_val}/{max_score}): Kuyruk={q_name} ({q_ext}), Temsilci={ag_name}, Arayan={caller_num}")

    if request.method == "GET":
        return PlainTextResponse("SAVED")
    return {"status": "success", "id": saved_id, "score": score_val, "question_answers": question_answers, "survey_status": status_val}


@app.get("/api/reports/queue-surveys")
async def get_queue_survey_reports(
    request: Request,
    queue_extension: Optional[str] = "all",
    queue_ext: Optional[str] = None,
    agent_extension: Optional[str] = "all",
    agent_ext: Optional[str] = None,
    score_filter: Optional[str] = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_info: dict = Depends(get_user_info),
    db: AsyncSession = Depends(get_db)
):
    """Returns aggregated CSAT KPIs, score distribution, per-queue/per-agent breakdown, and detailed survey records."""
    target_tenant = user_info.get("tenant_id") or "tenant-default"
    if queue_ext and (not queue_extension or queue_extension == "all"):
        queue_extension = queue_ext
    if agent_ext and (not agent_extension or agent_extension == "all"):
        agent_extension = agent_ext

    raw_rows = []
    try:
        stmt = select(QueueSurveyResponse).order_by(QueueSurveyResponse.timestamp.desc())
        res = await db.execute(stmt)
        for r in res.scalars().all():
            r_tenant = getattr(r, "tenant_id", "tenant-default") or "tenant-default"
            if not is_global_tenant(target_tenant):
                if is_default_tenant(target_tenant):
                    if r_tenant not in ["tenant-default", "default", ""]:
                        continue
                elif r_tenant != target_tenant:
                    continue
            ts_iso = r.timestamp.isoformat() if r.timestamp else datetime.datetime.utcnow().isoformat()
            q_ans = getattr(r, "question_answers", []) or []
            if isinstance(q_ans, str):
                try:
                    q_ans = json.loads(q_ans)
                except Exception:
                    q_ans = []
            raw_rows.append({
                "id": r.id,
                "tenant_id": r_tenant,
                "call_id": r.call_id,
                "queue_extension": r.queue_extension or "2000",
                "queue_name": r.queue_name or f"Kuyruk {r.queue_extension or '2000'}",
                "agent_extension": r.agent_extension or "",
                "agent_name": r.agent_name or "Temsilci",
                "caller_number": r.caller_number or "Bilinmeyen",
                "score": r.score,
                "max_score": r.max_score or 5,
                "question_answers": q_ans,
                "status": r.status or "completed",
                "timestamp": ts_iso,
                "created_at": ts_iso
            })
    except Exception as e:
        print(f"[Survey Reports DB Read Warning]: {e}")

    if not raw_rows and settings_db.get("queue_survey_responses"):
        raw_rows = list(settings_db.get("queue_survey_responses", []))

    # Load queues and users for filter options and low score threshold resolution
    queues_meta = {}
    try:
        res_q = await db.execute(select(PBXQueue))
        for q in res_q.scalars().all():
            queues_meta[str(q.extension)] = {
                "extension": str(q.extension),
                "name": q.name,
                "survey_enabled": bool(getattr(q, "survey_enabled", False)),
                "survey_scale": getattr(q, "survey_scale", "1-5") or "1-5",
                "low_threshold": int(getattr(q, "survey_low_score_threshold", 2) or 2)
            }
    except Exception:
        pass
    if not queues_meta:
        for q in settings_db.get("queues", []):
            ext_k = str(q.get("extension") or "")
            if ext_k:
                queues_meta[ext_k] = {
                    "extension": ext_k,
                    "name": q.get("name", f"Kuyruk {ext_k}"),
                    "survey_enabled": bool(q.get("survey_enabled", False)),
                    "survey_scale": q.get("survey_scale", "1-5"),
                    "low_threshold": int(q.get("survey_low_score_threshold", 2) or 2)
                }

    # Filter rows
    filtered = []
    for row in raw_rows:
        if queue_extension and queue_extension != "all":
            if str(row.get("queue_extension")) != str(queue_extension):
                continue
        if agent_extension and agent_extension != "all":
            if str(row.get("agent_extension")) != str(agent_extension):
                continue
        if start_date:
            if str(row.get("timestamp", ""))[:10] < start_date:
                continue
        if end_date:
            if str(row.get("timestamp", ""))[:10] > end_date:
                continue

        sc = row.get("score")
        st = row.get("status", "completed")
        q_info = queues_meta.get(str(row.get("queue_extension")), {})
        low_thr = q_info.get("low_threshold", 2)

        if score_filter and score_filter != "all":
            if score_filter == "high":
                if st != "completed" or sc is None or sc < 4:
                    continue
            elif score_filter == "low":
                if st != "completed" or sc is None or sc > low_thr:
                    continue
            elif score_filter == "timeout":
                if st == "completed":
                    continue
            else:
                try:
                    if sc != int(score_filter):
                        continue
                except Exception:
                    pass

        is_crit = bool(st == "completed" and sc is not None and sc <= low_thr)
        row["is_critical"] = is_crit
        row["is_low_score"] = is_crit
        if not row.get("created_at"):
            row["created_at"] = row.get("timestamp")
        row["recording_path"] = f"/api/recordings/{row['call_id']}.wav" if row.get("call_id") else None
        filtered.append(row)

    total_count = len(filtered)
    completed_rows = [r for r in filtered if r.get("status") == "completed" and r.get("score") is not None]
    completed_count = len(completed_rows)
    timeout_count = total_count - completed_count
    participation_rate = round((completed_count / total_count) * 100, 1) if total_count > 0 else 0.0

    # Normalize scores to 5-point scale for unified average
    norm_scores = []
    high_count = 0
    low_count = 0
    dist_counts = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}

    for r in completed_rows:
        sc = float(r.get("score") or 0)
        mx = float(r.get("max_score") or 5)
        norm_5 = (sc / mx) * 5.0 if mx > 0 else sc
        norm_scores.append(norm_5)

        bucket = max(1, min(5, int(round(norm_5))))
        dist_counts[bucket] = dist_counts.get(bucket, 0) + 1

        if norm_5 >= 3.8:
            high_count += 1
        if r.get("is_critical") or norm_5 <= 2.2:
            low_count += 1

    avg_score = round(sum(norm_scores) / len(norm_scores), 2) if norm_scores else 0.0
    csat_pct = round((high_count / completed_count) * 100, 1) if completed_count > 0 else 0.0
    low_rate_pct = round((low_count / completed_count) * 100, 1) if completed_count > 0 else 0.0

    score_distribution = []
    for star in [5, 4, 3, 2, 1]:
        cnt = dist_counts.get(star, 0)
        pct = round((cnt / completed_count) * 100, 1) if completed_count > 0 else 0.0
        score_distribution.append({"score": star, "count": cnt, "percentage": pct})

    # Per-Queue Aggregation
    by_queue_map = {}
    for q_ext, q_m in queues_meta.items():
        by_queue_map[q_ext] = {
            "queue_extension": q_ext,
            "queue_name": q_m["name"],
            "survey_enabled": q_m["survey_enabled"],
            "survey_scale": q_m["survey_scale"],
            "total": 0,
            "completed": 0,
            "scores": [],
            "high_count": 0,
            "low_count": 0
        }
    for r in filtered:
        qe = str(r.get("queue_extension") or "2000")
        if qe not in by_queue_map:
            by_queue_map[qe] = {
                "queue_extension": qe,
                "queue_name": r.get("queue_name") or f"Kuyruk {qe}",
                "survey_enabled": False,
                "survey_scale": "1-5",
                "total": 0,
                "completed": 0,
                "scores": [],
                "high_count": 0,
                "low_count": 0
            }
        by_queue_map[qe]["total"] += 1
        if r.get("status") == "completed" and r.get("score") is not None:
            by_queue_map[qe]["completed"] += 1
            sc = float(r["score"])
            mx = float(r.get("max_score") or 5)
            n5 = (sc / mx) * 5.0 if mx > 0 else sc
            by_queue_map[qe]["scores"].append(n5)
            if n5 >= 3.8:
                by_queue_map[qe]["high_count"] += 1
            if r.get("is_critical") or n5 <= 2.2:
                by_queue_map[qe]["low_count"] += 1

    by_queue_list = []
    for qe, qd in by_queue_map.items():
        comp = qd["completed"]
        tot_q = qd["total"]
        avg_q = round(sum(qd["scores"]) / comp, 2) if comp > 0 else 0.0
        csat_q = round((qd["high_count"] / comp) * 100, 1) if comp > 0 else 0.0
        part_q = round((comp / tot_q) * 100, 1) if tot_q > 0 else 0.0
        by_queue_list.append({
            "queue_extension": qe,
            "queue_name": qd["queue_name"],
            "survey_enabled": qd["survey_enabled"],
            "survey_scale": qd["survey_scale"],
            "total": tot_q,
            "total_offered": tot_q,
            "completed": comp,
            "participation_rate": part_q,
            "avg_score": avg_q,
            "csat_pct": csat_q,
            "high_count": qd["high_count"],
            "low_count": qd["low_count"],
            "low_score_count": qd["low_count"]
        })
    by_queue_list.sort(key=lambda x: (x["completed"], x["avg_score"]), reverse=True)

    # Per-Agent Aggregation
    by_agent_map = {}
    for r in filtered:
        ae = str(r.get("agent_extension") or "belirsiz")
        aname = r.get("agent_name") or (f"Dahili {ae}" if ae != "belirsiz" else "Temsilci")
        if ae not in by_agent_map:
            by_agent_map[ae] = {
                "agent_extension": ae,
                "agent_name": aname,
                "total": 0,
                "completed": 0,
                "scores": [],
                "high_count": 0,
                "low_count": 0
            }
        by_agent_map[ae]["total"] += 1
        if r.get("status") == "completed" and r.get("score") is not None:
            by_agent_map[ae]["completed"] += 1
            sc = float(r["score"])
            mx = float(r.get("max_score") or 5)
            n5 = (sc / mx) * 5.0 if mx > 0 else sc
            by_agent_map[ae]["scores"].append(n5)
            if n5 >= 3.8:
                by_agent_map[ae]["high_count"] += 1
            if r.get("is_critical") or n5 <= 2.2:
                by_agent_map[ae]["low_count"] += 1

    by_agent_list = []
    for ae, ad in by_agent_map.items():
        comp = ad["completed"]
        avg_a = round(sum(ad["scores"]) / comp, 2) if comp > 0 else 0.0
        csat_a = round((ad["high_count"] / comp) * 100, 1) if comp > 0 else 0.0
        by_agent_list.append({
            "agent_extension": ae,
            "agent_name": ad["agent_name"],
            "total": ad["total"],
            "completed": comp,
            "avg_score": avg_a,
            "csat_pct": csat_a,
            "high_count": ad["high_count"],
            "high_score_count": ad["high_count"],
            "low_count": ad["low_count"],
            "low_score_count": ad["low_count"]
        })
    by_agent_list.sort(key=lambda x: (x["avg_score"], x["completed"]), reverse=True)

    q_list_out = [{"extension": k, "name": v["name"]} for k, v in queues_meta.items()]
    return {
        "summary": {
            "total_surveys": total_count,
            "total_offered": total_count,
            "completed_surveys": completed_count,
            "completed_responses": completed_count,
            "timeout_surveys": timeout_count,
            "timeout_count": timeout_count,
            "participation_rate": participation_rate,
            "avg_score": avg_score,
            "csat_pct": csat_pct,
            "csat_percent": csat_pct,
            "high_score_count": high_count,
            "high_satisfaction_count": high_count,
            "high_satisfaction_rate": csat_pct,
            "low_score_count": low_count,
            "low_score_rate": low_rate_pct,
            "distribution": {str(k): v for k, v in dist_counts.items()}
        },
        "score_distribution": score_distribution,
        "by_queue": by_queue_list,
        "by_agent": by_agent_list,
        "items": filtered[:250],
        "queues_list": q_list_out,
        "queues": q_list_out
    }

@app.get("/api/settings/trunks")
@app.get("/settings/trunks")
async def new_list_trunks(request: Request, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    target_tenant = user_info.get("tenant_id") or request.headers.get("X-Tenant-ID") or request.headers.get("Tenant-ID") or request.query_params.get("tenant_id") or "tenant-default"
    disk_trunks_map = {str(dt.get("trunk_name") or dt.get("id") or ""): dt for dt in settings_db.get("trunks", [])}
    try:
        if target_tenant in ["all", "global"]:
            stmt = select(Trunk).order_by(Trunk.id)
        elif target_tenant == "tenant-default":
            stmt = select(Trunk).where(or_(Trunk.tenant_id == "tenant-default", Trunk.tenant_id.is_(None))).order_by(Trunk.id)
        else:
            stmt = select(Trunk).where(Trunk.tenant_id == target_tenant).order_by(Trunk.id)
        result = await db.execute(stmt)
        trunks = result.scalars().all()
        out_rows = []
        for t in trunks:
            row_d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
            tk = str(row_d.get("trunk_name") or row_d.get("id") or "")
            dt = disk_trunks_map.get(tk)
            if dt:
                for extra_k in ("codecs", "call_limit_enabled", "call_limit_direction", "max_channels", "sip_headers"):
                    if row_d.get(extra_k) in (None, {}, []) and dt.get(extra_k) not in (None, {}, []):
                        row_d[extra_k] = dt.get(extra_k)
            out_rows.append(row_d)
        return out_rows
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
            if isinstance(data.get("codecs"), list) and data.get("codecs"):
                data["codec"] = ",".join([str(c).strip() for c in data["codecs"] if str(c).strip()])
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
                if filtered_data.get("host") is None:
                    filtered_data["host"] = "" if filtered_data.get("trunk_type") == "account" else "127.0.0.1"
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
            if isinstance(data.get("codecs"), list) and data.get("codecs"):
                data["codec"] = ",".join([str(c).strip() for c in data["codecs"] if str(c).strip()])
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
    try:
        save_settings(settings_db)
    except Exception as e_save:
        print(f"[Save Trunk settings.json Warning]: {e_save}")

    try:
        regenerate_pjsip_custom_conf(background_tasks)
        regenerate_extensions_custom_conf(background_tasks)
    except Exception as e_ast:
        print(f"[Save Trunk Asterisk Regeneration Warning]: {e_ast}")

    return {"status": "success", "trunks": out}

@app.delete("/api/settings/trunks/{trunk_id}")
@app.delete("/settings/trunks/{trunk_id}")
async def new_delete_trunk(trunk_id: int, background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
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
            regenerate_pjsip_custom_conf(background_tasks)
            regenerate_extensions_custom_conf(background_tasks)
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
        "version": "v2.6.9",
        "commit_hash": live_commit,
        "release_date": "27 Ekim 2026",
        "status": "Güncel / Canlı Sürüm",
        "environment": "Production (On-Premise)",
        "changelog": [
            {
                "version": "v2.6.9",
                "commit_hash": live_commit,
                "release_date": "27 Ekim 2026",
                "badge": "Canlı Sürüm (Güncel)",
                "badge_type": "current",
                "title": "Canlı İzleme Paneli Minimal Arama İkonu & Temsilci Durum Filtresinin Profil Ayarlarına Taşınması",
                "summary": "Temsilci & AI Çağrı Meşguliyet Durumları başlığındaki Mini/Normal/Detay seçicisi kaldırıldı, Tümü/Görüşmede/Müsait/Molada/Çevrimdışı filtresi Profil Ayarları > Canlı İzleme Paneli sekmesine taşındı ve arama alanı sağ üstte büyüteç ikonuna dönüştürüldü.",
                "features": [
                    {
                        "title": "🔍 Minimal Büyüteç Arama İkonu",
                        "desc": "Temsilci & AI Çağrı Meşguliyet Durumları kart başlığının sağ tarafında yalnızca kompakt büyüteç ikonu yer alır; tıklandığında arama kutusu açılır."
                    },
                    {
                        "title": "🎛️ Temsilci Durum Filtresi Profil Ayarlarında",
                        "desc": "Tümü, Görüşmede, Müsait, Molada ve Çevrimdışı durum filtreleri ana ekrandan kaldırılarak Profil Ayarları > Canlı İzleme Paneli > Kart Görünümü & Alarm Eşikleri bölümüne eklendi."
                    }
                ]
            },
            {
                "version": "v2.6.8",
                "commit_hash": "ae1e24c",
                "release_date": "27 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Profil Ayarları Sol Dikey Sekme Düzeni & Canlı İzleme Paneli Özelleştirme Sekmesi",
                "summary": "Canlı İzleme Paneli başlığındaki alt açıklama ve şablon/özelleştirme butonları kaldırılarak sağ üst Profil Ayarları penceresine 'Canlı İzleme Paneli' sekmesi olarak taşındı; Temsilci Profil Ayarları popup penceresi Kullanıcı Düzenleme penceresi gibi sol dikey sekmeli yapıya kavuşturuldu.",
                "features": [
                    {
                        "title": "🗂️ Temsilci Profil Ayarları Sol Dikey Sekme Mimarisi",
                        "desc": "Sağ üst avatar menüsünden açılan Temsilci Profil Ayarları penceresindeki sekmeler (Profil & Tema, Profiller, Donanım & Santral, Yönlendirme, Güvenlik, Çağrı Paneli, Canlı İzleme Paneli) sol tarafa dikey menü olarak hizalandı."
                    },
                    {
                        "title": "🖥️ Canlı İzleme Paneli Özelleştirme Sekmesi & Sadeleştirilmiş Başlık",
                        "desc": "Canlı İzleme Paneli içerisindeki açıklama metni ve şablon/özelleştirme barı kaldırılarak tüm Wallboard Studio ayarları Profil Ayarları altındaki 'Canlı İzleme Paneli' sekmesine konumlandırıldı."
                    }
                ]
            },
            {
                "version": "v2.6.7",
                "commit_hash": "1882bed",
                "release_date": "26 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Kişiselleştirilebilir Canlı İzleme Paneli (Wallboard Studio) & Hazır Şablonlar",
                "summary": "Her kullanıcının Canlı İzleme Paneli'ni kendi çalışma tarzına göre tasarlayıp kaydedebileceği Wallboard Tasarım Stüdyosu, hazır görünüm şablonları, sürükle-bırak modül/sayaç yönetimi, temsilci kart yoğunluğu/filtreleme ve kişisel alarm eşikleri eklendi.",
                "features": [
                    {
                        "title": "🎨 Kişisel Wallboard Tasarım Stüdyosu & Kullanıcı Bazlı Kayıt",
                        "desc": "Kullanıcılar 'Paneli Özelleştir' menüsünden KPI kartlarını ve ana widget modüllerini açıp kapatabilir, sürükle-bırak ile sıralayabilir ve genişliklerini (1/3, 1/2, 2/3, Tam) ayarlayarak kendi hesaplarına özel kaydedebilir."
                    },
                    {
                        "title": "🧩 Yeni Seçilebilir Modüller (Aktif Görüşmeler, Kuyruk Tablosu, Liderlik & Mola Takibi)",
                        "desc": "Temsilci & AI Meşguliyet Panosu'nun yanı sıra Canlı Aktif Görüşmeler Listesi, Canlı Kuyruk (ACD) Durum Tablosu, Günün En'leri Performans Sıralaması ve Canlı Mola Takip Kutusu modülleri eklendi."
                    },
                    {
                        "title": "⚡ Hazır Şablonlar, Kart Yoğunluğu (Mini/Normal/Detay) & Kişisel Alarm Eşikleri",
                        "desc": "Tek tıkla geçiş yapılabilen Standart, Süpervizör, Kuyruk & Çağrı ve Kompakt şablonlar; temsilci durum filtreleri ve kişisel bekleme/SL/mola süresi görsel alarm eşikleri eklendi."
                    }
                ]
            },
            {
                "version": "v2.6.6",
                "commit_hash": "9a7d1e8",
                "release_date": "26 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Canlı İzleme Paneli (Wallboard) Servis Seviyesi (SL) Kartı Eklemesi (6'lı KPI Satırı)",
                "summary": "Canlı İzleme Paneli üst KPI satırına Servis Seviyesi (SL %) ve ortalama bekleme süresi kutucuğu tekrar eklendi (Sırada Bekleyen, AI Başarılı Çözüm, Servis Seviyesi, Müsait, Meşgul, Molada).",
                "features": [
                    {
                        "title": "📈 Servis Seviyesi (SL %) & Bekleme Süresi Kartı",
                        "desc": "Canlı İzleme Paneli üst özet satırında Sırada Bekleyen, AI Başarılı Çözüm, Servis Seviyesi (SL %), Müsait, Meşgul ve Molada olmak üzere 6 kutucuk yan yana gösterilir."
                    }
                ]
            },
            {
                "version": "v2.6.5",
                "commit_hash": "2068fa2",
                "release_date": "26 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Canlı İzleme Paneli (Wallboard) Tam Genişlik Düzeni & Müsait / Meşgul / Molada Özet Kartları",
                "summary": "Canlı İzleme Paneli'nden Hedef & Eşik Durumu, Çağrı Olay Günlüğü ve Canlı Santral Trafik Akışı panelleri kaldırıldı; Sırada Bekleyen ve AI Başarılı Çözüm kartlarının yanına Müsait, Meşgul ve Molada kartları eklendi, Temsilci & AI Çağrı Meşguliyet Durumları alanı tam genişliğe çıkarıldı.",
                "features": [
                    {
                        "title": "📊 5'li Canlı Özet KPI Kartları (Sırada Bekleyen, AI Başarılı Çözüm, Müsait, Meşgul, Molada)",
                        "desc": "Canlı İzleme Paneli üst barında anlık Sırada Bekleyen, AI Başarılı Çözüm, Müsait Temsilci, Meşgul (Görüşmede) ve Molada Temsilci sayıları yan yana gösterilir."
                    },
                    {
                        "title": "🖥️ Tam Genişlik Temsilci & AI Çağrı Meşguliyet Izgarası",
                        "desc": "Gereksiz yan ve alt grafik panelleri kaldırılarak kalan tüm ekran alanı Temsilci & AI Çağrı Meşguliyet Durumları kartlarına tahsis edildi."
                    }
                ]
            },
            {
                "version": "v2.6.4",
                "commit_hash": "2a63429",
                "release_date": "26 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Canlı Çağrı Araya Girme (Barge-In), Sufle Verme (Whisper) ve Fısıldama (Listen) & Masa Telefonu ChanSpy Entegrasyonu",
                "summary": "Rol bazlı Araya Girme, Sufle Verme ve Fısıldama yetkileri, Canlı İzleme Paneli ve Gerçek Zamanlı AI Pano üzerinde kulaklık ikonu açılır menüsü, WebPhone otomatik cevaplama ve Numara Planı masa telefonu tuşlama kodları (*551*, *552*, *553*) Asterisk ChanSpy motoruyla entegre edildi.",
                "features": [
                    {
                        "title": "🎧 Rol Bazlı Araya Girme, Sufle ve Fısıldama Yetkileri",
                        "desc": "Roller ekranına AI temsilciler ve insan aboneler dahil tüm aktif çağrıları dinleme (call_monitor:listen), sufle verme (call_monitor:whisper) ve araya girme (call_monitor:barge) yetkileri eklendi."
                    },
                    {
                        "title": "🖥️ Canlı İzleme Paneli & Gerçek Zamanlı AI Pano Hızlı Müdahale Menüsü",
                        "desc": "Temsilci ve AI çağrı kutucuklarına eklenen mini dinleme simgesi ile Araya Gir, Sufle ve Fısılda seçenekleri tek tıkla WebRTC WebPhone veya masa telefonunu otomatik devreye alır."
                    },
                    {
                        "title": "☎️ Numara Planı & Masa Telefonu ChanSpy Kodları (*551*, *552*, *553*)",
                        "desc": "Numara Planı altına eklenen Fısıldama (*551*), Sufle (*552*) ve Araya Girme (*553*) prefix kodları Asterisk dialplan'a bağlanarak masa telefonlarından doğrudan çağrıya müdahale imkanı sağlandı."
                    }
                ]
            },
            {
                "version": "v2.6.3",
                "commit_hash": "8488ab8",
                "release_date": "26 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Üst Başlık (Header) Sadeleştirme & Merkezli Arama Çubuğu Düzeni",
                "summary": "Üst barda sol tarafta yer alan 'Aktif İşlemler' ve 'Arama Bekleniyor' ibareleri kaldırılarak arama çubuğunun (GlobalSearchBar) tam ortadaki konumu korundu.",
                "features": [
                    {
                        "title": "✨ Üst Başlık (Header) Sadeleştirme",
                        "desc": "Sol üstteki 'AKTİF İŞLEMLER' ve 'Arama Bekleniyor' etiketleri kaldırıldı; arama kutusu (Ctrl+K) mevcut merkezi konumunda sabit tutuldu."
                    }
                ]
            },
            {
                "version": "v2.6.2",
                "commit_hash": "fe95e31",
                "release_date": "26 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Dış Hat Tanımları (SIP Trunks) 3 Sekmeli Teknik Konfigürasyon & Birebir Asterisk PJSIP/Dialplan Senkronizasyonu",
                "summary": "Santral > Dış Hat Tanımları ekranı Genel (Register/Peer/Account), Gelişmiş (Kodek DualListBox & Çağrı Kısıtlama) ve SIP Başlıkları (Gelen/Giden PJSIP Header & User-Agent/Realm/Maxptime) sekmeleriyle yenilendi ve Asterisk PJSIP motoruna birebir bağlandı.",
                "features": [
                    {
                        "title": "🔌 Register, Peer ve Account Dış Hat Tipleri & TLS Taşıma Desteği",
                        "desc": "Genel sekmesine Register, Peer ve Account dış hat tipleri, UDP/TCP/TLS taşıma protokolleri ve Account tipi için otomatik SIP kullanıcı adı/parola üretici eklendi."
                    },
                    {
                        "title": "🎚️ Kodek Öncelik Listesi (DualListBox) & Eş Zamanlı Çağrı Kısıtlama",
                        "desc": "Gelişmiş sekmesinde sistem kodeklerini seçip öncelik sıralaması yapabilme ve Asterisk GROUP_COUNT tabanlı Gelen/Giden eş zamanlı çağrı limiti kontrolü sağlandı."
                    },
                    {
                        "title": "📑 Gelen & Giden SIP Başlıkları (From, Diversion, RPID, PAI, PPI, User-Agent, Realm, Maxptime)",
                        "desc": "SIP Başlıkları sekmesindeki tüm gelen/giden başlık kuralları ve özel (custom) değerler PJSIP_HEADER pre-dial handler ile Asterisk'e birebir işlendi."
                    }
                ]
            },
            {
                "version": "v2.6.1",
                "commit_hash": "b7b044f",
                "release_date": "26 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "WhatsApp 'Giriş Kodu' İki Faktörlü Doğrulama (Ücretsiz 24 Saat Penceresi & 5 Dk Geçerli Kod)",
                "summary": "Kullanıcı WhatsApp hattımıza 'Giriş Kodu' mesajı gönderdiğinde sistem numarayı otomatik tanır ve 5 dakika (300 saniye) geçerli 6 haneli 2FA doğrulama kodunu %100 ücretsiz olarak yanıtlar.",
                "features": [
                    {
                        "title": "💬 WhatsApp 'Giriş Kodu' ile %100 Ücretsiz 2FA",
                        "desc": "Kullanıcı WhatsApp üzerinden sistem hattına 'Giriş Kodu' (veya '2FA') yazdığında Meta 24 saatlik ücretsiz müşteri hizmetleri penceresi açılır; sistem 5 dakika geçerli 6 haneli doğrulama kodunu üretip anında yanıtlar."
                    },
                    {
                        "title": "🔐 4 Yöntemli 2FA Seçimi (E-Posta, WhatsApp, Google & Microsoft Authenticator)",
                        "desc": "Kullanıcı Yönetimi > Özellikler, Temsilci Profili ve Giriş (Login) ekranlarına WhatsApp 2FA seçeneği, tek tıkla WhatsApp 'Giriş Kodu' bağlantısı ve test doğrulama akışı eklendi."
                    }
                ]
            },
            {
                "version": "v2.6.0",
                "commit_hash": "4a7610c",
                "release_date": "26 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Çok Yöntemli İki Faktörlü Doğrulama (2FA: E-Posta, Google Authenticator, Microsoft Authenticator)",
                "summary": "Kullanıcı Yönetimi > Özellikler ve Temsilci Profili ekranlarına 2FA Aktif/Pasif kontrolü ile E-Posta (OTP), Google Authenticator ve Microsoft Authenticator yöntem seçimi, çevrimdışı QR Kod üretimi, manuel kurulum anahtarı ve ilk girişte cihaz eşleştirme akışı eklendi.",
                "features": [
                    {
                        "title": "🔐 3 Yöntemli 2FA Seçimi (E-Posta, Google Authenticator, Microsoft Authenticator)",
                        "desc": "Kullanıcı ekranındaki Özellikler sekmesinde 2FA aktif edildiğinde E-Posta (E-Mail Kodu), Google Authenticator veya Microsoft Authenticator yöntemlerinden biri seçilebilir, QR kod ve kurulum anahtarı anında görüntülenip test edilebilir."
                    },
                    {
                        "title": "📱 İlk Girişte QR Kod Eşleştirme & E-Posta Geri Sayım Sayacı",
                        "desc": "Authenticator seçili kullanıcılar ilk girişlerinde QR kodu telefon kamerasıyla okutarak cihazlarını eşleştirebilir; E-Posta 2FA kullanıcıları ise girişte otomatik gönderilen 6 haneli tek kullanımlık kod ile güvenli giriş yapabilir."
                    }
                ]
            },
            {
                "version": "v2.5.9",
                "commit_hash": "d751bbf",
                "release_date": "25 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Müşteri Niyet Raporu (Intent Analysis) & Kaydedilebilir Anahtar Kelime Motoru",
                "summary": "Çağrı transkriptlerinden müşteri niyetini (Satış, Yardım Masası, Fiyat Sorgulama, İptal/Şikayet veya özel süreçler) otomatik analiz eden, filtre alanından yeni anahtar kelimeler girip kalıcı olarak kaydetmeye olanak tanıyan 'Niyet Raporu' eklendi.",
                "features": [
                    {
                        "title": "🎯 Çağrı Transkript Tabanlı Müşteri Niyet Raporu",
                        "desc": "Çağrı Raporları & Analiz menüsü altına eklenen Niyet Raporu, görüşme transkriptlerini ve özetlerini tarayarak müşterinin arama niyetini, kategorisini, eşleşen anahtar kelimeleri ve müşterinin kurduğu kanıt cümlesini raporlar."
                    },
                    {
                        "title": "💾 Kaydedilebilir Anahtar Kelime & Niyet Kuralı Yönetimi",
                        "desc": "Raporun filtre ve üst yönetim alanından satış, yardım masası veya farklı operasyonlar için özel anahtar kelimeler girilip kalıcı olarak kaydedilebilir, düzenlenebilir ve filtrelenebilir."
                    }
                ],
                "fixes": [
                    "Rol ve Yetki Yönetimi (RoleSettings) altına 'Niyet Raporu' (reports_intent:access) yetkisi eklendi ve mevcut yönetici/süpervizör profillerine otomatik tanımlandı."
                ]
            },
            {
                "version": "v2.5.8",
                "commit_hash": "072451a",
                "release_date": "25 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Temsilci Kronolojisi (Timeline) Detay Penceresinde İnteraktif Hareket Filtresi",
                "summary": "Temsilci Kronolojisi detay penceresindeki metin tabanlı 'Gün İçi Kronolojik Hareket Özeti' alanı kaldırılarak yerine 'Tümü', 'Login / Logout', 'Molalar', 'Gelen Çağrılar', 'Giden Çağrılar', 'Cevapsız Çağrılar' ve 'Transfer / Diğer' seçeneklerinden oluşan hızlı hareket filtreleme çubuğu eklendi.",
                "features": [
                    {
                        "title": "🔍 Adım Adım Hareket Akışı İçin Hızlı Kategori Filtresi",
                        "desc": "Temsilci Kronolojisi detay penceresinde seçilen kategori veya kategorilere (Login/Logout, Molalar, Gelen Çağrılar, Giden Çağrılar, Cevapsız Çağrılar, Transfer/Diğer) göre Adım Adım Hareket Akışı kartları ve altındaki kronolojik hareket tablosu anlık olarak filtrelenir. 'Tümü' seçildiğinde tüm hareketler gösterilir."
                    }
                ],
                "fixes": [
                    "Görsel bütünlüğü bozan uzun metinli 'Gün İçi Kronolojik Hareket Özeti' kutusu kaldırıldı."
                ]
            },
            {
                "version": "v2.5.7",
                "commit_hash": "3c6057f",
                "release_date": "25 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Tüm Raporlarda Standart Gün.Ay.Yıl (GG.AA.YYYY) Tarih Formatı & Kuyruk ID Gösterim Sadeleştirmesi",
                "summary": "Sistemdeki tüm rapor ekranlarında, detay pencerelerinde ve Excel dışa aktarma çıktılarında tarih gösterimleri standart Gün.Ay.Yıl (GG.AA.YYYY ve GG.AA.YYYY SS:DD:sn) formatına güncellendi. Kuyruk & Bekleme Analitiği Raporunda Kuyruk ID önündeki '#' ibaresi kaldırıldı.",
                "features": [
                    {
                        "title": "📅 Tüm Raporlarda Standart Gün.Ay.Yıl (GG.AA.YYYY) Tarih Gösterimi",
                        "desc": "Kuyruk & Bekleme Analitiği, Temsilci Kronolojisi (Timeline), Kaçan Çağrılar, ACD Memnuniyet Anketi, CDR, Ses Kayıtları ve tüm detay pencereleri ile Excel dışa aktarma dosyalarındaki tarihler Yıl-Ay-Gün (YYYY-MM-DD) yerine standart Gün.Ay.Yıl (örn. 25.10.2026) formatına dönüştürüldü."
                    },
                    {
                        "title": "🔢 Kuyruk & Bekleme Analitiği Raporunda Kuyruk ID Gösterimi",
                        "desc": "Kuyruk & Bekleme Analitiği tablosu ve detay pencerelerinde Kuyruk ID alanının başındaki '#' işareti kaldırılarak doğrudan sade kuyruk numarası (örn. 2000) gösterilecek şekilde düzenlendi."
                    }
                ],
                "fixes": [
                    "Tarayıcı dil ayarlarından bağımsız deterministik GG.AA.YYYY tarih formatlayıcı eklendi.",
                    "Kuyruk & Bekleme Analitiği tablosunda kronolojik sıralama korunarak görsel tarih gösterimi GG.AA.YYYY yapıldı."
                ]
            },
            {
                "version": "v2.5.6",
                "commit_hash": "ffc964e",
                "release_date": "25 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "Kuyruk & Bekleme Analitiği Kuyruk ID/İsmi Alanları & Tüm Raporlarda Dinamik Sütun Seçici (Sütunlar)",
                "summary": "Kuyruk & Bekleme Analitiği raporuna Kuyruk ID ve Kuyruk İsmi sütunları (tablo, filtre, detay penceresi ve Excel çıktısı dahil) eklendi. Ayrıca CDR raporundaki 'Sütunlar' görünürlük seçici özelliği sistemdeki tüm 24 rapor ekranına kendi sütun başlıklarıyla entegre edildi.",
                "features": [
                    {
                        "title": "📋 Kuyruk & Bekleme Analitiği Raporunda Kuyruk ID ve Kuyruk İsmi Alanları",
                        "desc": "Kuyruk & Bekleme Analitiği raporu artık çağrıları hem Tarih hem de Kuyruk bazında gruplayarak tabloda 'Kuyruk ID' (örn. 2000) ve 'Kuyruk İsmi' (örn. Satış Kuyruğu) sütunlarını gösterir. Filtre listesindeki kuyruk seçici, kuyruk detay popup başlığı ve Excel dışa aktarma çıktısı da Kuyruk ID ve Kuyruk İsmi bilgilerini içerecek şekilde güncellendi."
                    },
                    {
                        "title": "🏛️ Tüm Raporlarda Dinamik 'Sütunlar' (Sütun Görünürlük Seçici) Özelliği",
                        "desc": "CDR raporunda bulunan 'Sütunlar' açılır menüsü; Temsilci Performans, Kuyruk & Bekleme, Anket Raporları, Ses Kayıtları, Transkript, Duygu Analizi, QA Kalite, Temsilci Notları, Trafik Yoğunluk, Kaçan Çağrılar, FCR, AI ROI, Kelime Bulutu, Duygu Isı Haritası, Dış Hat (Trunk), IVR Terk, Transfer & Hold, Senaryo A/B, Müşteri Çilesi, Senaryo Uyum, Sessizlik Analizi ve Yönetici Özeti dahil tüm raporlara kendi özel sütun listeleriyle eklendi."
                    }
                ],
                "fixes": [
                    "Her rapor için seçilen görünür sütun tercihleri tarayıcı hafızasında (localStorage) rapor bazlı ayrı ayrı saklanacak şekilde yapılandırıldı.",
                    "Çağrı kayıtlarının kuyruk eşleştirmesi (resolveCallQueueInfo) doğrudan kuyruk alanı, gelen arama kuralları (DID/Trunk) ve kuyruk üyesi dahili numaraları üzerinden otomatik çözümlenecek şekilde güçlendirildi."
                ]
            },
            {
                "version": "v2.5.5",
                "commit_hash": "083599c",
                "release_date": "25 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "previous",
                "title": "ACD Kuyruk Çağrı Sonu Memnuniyet Anketi (CSAT) & Detaylı Anket Raporları (1-5 Yıldız / NPS)",
                "summary": "ACD Kuyruk ayarları içerisine çağrı sonu tuşlamalı (DTMF) Memnuniyet Anketi sekmesi, Asterisk otomatik anket dialplan akışı, varsayılan Türkçe anket ve teşekkür ses kayıtları ile Çağrı Raporları & Analiz menüsü altına kapsamlı Anket Raporları (CSAT, puan dağılımı, kuyruk ve temsilci sıralaması, ses kaydı dinleme ve Excel dışa aktarma) eklendi.",
                "features": [
                    {
                        "title": "⭐ ACD Kuyruk İçi Çağrı Sonu Memnuniyet Anketi Yapılandırması",
                        "desc": "Santral > ACD Kuyruk düzenleme penceresine 'Memnuniyet Anketi' sekmesi eklendi. Her kuyruk için ayrı ayrı anket aktifliği, puanlama ölçeği (1-5 Yıldız CSAT, 1-10 NPS, 1-2 Evet/Hayır), tuşlama bekleme süresi, kritik düşük puan eşiği, anket soru anonsu ve teşekkür anonsu seçimi sağlandı."
                    },
                    {
                        "title": "📞 Asterisk Otomatik Çağrı Sonu Anket & DTMF Tuşlama Motoru",
                        "desc": "Temsilci görüşmeyi sonlandırdığında müşteri hattı kapanmadan otomatik olarak anket soru anonsuna aktarılır (Queue 'c' ve Dial 'tTg' bayrakları). Müşterinin tuşladığı puan (Read DTMF) arayan numara, kuyruk, temsilci ve görüşme ses kaydı ile eşleştirilerek veritabanına kaydedilir."
                    },
                    {
                        "title": "📊 Çağrı Raporları & Analiz > Anket Raporları (CSAT & Temsilci Sıralaması)",
                        "desc": "Sol menüdeki Çağrı Raporları & Analiz altına 'Anket Raporları' ekranı eklendi. Ortalama Memnuniyet Puanı (CSAT), Ankete Katılım Oranı, Yüksek Memnuniyet (4-5★) ve Düşük/Kritik Puan (1-2★) KPI kartları, 1-5 yıldız dağılım grafiği, kuyruk bazlı özet, temsilci başarı sıralaması, ses kaydı dinleme ve Excel indirme özellikleri sunuldu."
                    }
                ],
                "fixes": [
                    "Kuyruk kartları üzerine anketin açık olduğunu gösteren '⭐ Anket Aktif' rozeti eklendi.",
                    "Rol ve Yetki Tanımları (RoleSettings) içerisine 'Anket Raporları' (reports_survey:access) yetkisi tanımlanarak mevcut yönetici ve takım lideri rollerine otomatik tanımlandı."
                ]
            },
            {
                "version": "v2.5.4",
                "commit_hash": "640fca9",
                "release_date": "25 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
                "title": "AI Kural & Senaryo Zorunlu Öncelik Motoru, Kuyruk Bazlı Otomatik Geri Arama, Masa Telefonu Tuşlamalı Yönlendirme & Canlı API Bütçe Panosu",
                "summary": "Kural ve Senaryo Editörü'ndeki soru-cevap ve senaryo kurallarının sesli/yazılı tüm AI temsilcilerde en yüksek öncelikle uygulanması, Otomatik Geri Arama (Smart Callback) özelliğinin ACD Kuyruk içine taşınması, masa telefonlarından *21*/*67*/*61*/#21# tuşlamasıyla çift yönlü yönlendirme senkronizasyonu ve Operasyon & İzleme altına gerçek zamanlı API Bütçe & Tüketim Panosu eklendi.",
                "features": [
                    {
                        "title": "🧠 AI Kural & Senaryo Editörü Zorunlu Öncelik Motoru ve Kural Düzenleme",
                        "desc": "Kural ve Senaryo Editörü'ne girilen Soru-Cevap (FAQ), Karakter/Prompt ve Özel Yönlendirme kuralları ile Görsel Senaryo Akışı hem canlı sesli görüşmelerde hem de Ortak Gelen Kutusu (WhatsApp/Web/Sosyal Medya) kanallarında en yüksek öncelikli bilgi tabanı olarak derlendi; mevcut kuralları yerinde düzenleme (PUT /api/rules/{id}) desteği eklendi."
                    },
                    {
                        "title": "🔄 Kuyruk Bazlı Otomatik Geri Arama (Per-Queue Smart Callback)",
                        "desc": "Otomatik Geri Arama ayarları genel sistem ayarlarından çıkarılarak ACD Kuyruk Düzenleme penceresi içine taşındı; her kuyruk için bağımsız geri arama aktifliği, bekleme eşiği, maksimum deneme sayısı, öncelik ve dış hat seçimi sağlandı."
                    },
                    {
                        "title": "☎️ Masa Telefonu Çağrı Yönlendirme Kodları (*21*, *67*, *61*, #21#) & Arayüz Senkronizasyonu",
                        "desc": "Numara Planı'na Her Zaman, Meşgulde, Zaman Aşımında Yönlendirme ve İptal prefix kodları eklendi. Masa telefonundan tuşlanan yönlendirmelerin Kullanıcı Düzenleme > Yönlendirme sekmesine anında yansıması ve arayüzden iptal edilebilmesi sağlandı."
                    },
                    {
                        "title": "💳 Gerçek Zamanlı API Bütçe & Tüketim Panosu ve Rol Yetki Hiyerarşisi",
                        "desc": "Operasyon & İzleme menüsü altına son bakiye yükleme tarihinden itibaren gerçek birim maliyetleri ve canlı ElevenLabs karakter kotasını takip eden API Bütçe & Tüketim Panosu eklendi; Rol ve Yetki Tanımları ekranı sol menü mimarisiyle birebir uyumlu sekmeli yapıya kavuşturuldu."
                    }
                ],
                "fixes": [
                    "AI temsilcinin Kural ve Senaryo Editörü'nde tanımlı sorulara RAG PDF dökümanlarında bulamadığı için 'bilmiyorum' yanıtı vermesi sorunu tamamen giderildi.",
                    "Kuralların hem PostgreSQL veritabanı hem de settings.json üzerinde çift yönlü yedekli çalışması sağlandı.",
                    "API Bütçe ekranındaki geçmiş tüm zamanların toplamını gösteren hatalı hesaplama düzeltilerek yalnızca son yükleme sonrası gerçek kullanımın hesaplanması sağlandı."
                ]
            },
            {
                "version": "v2.5.3",
                "commit_hash": "e6c4df3",
                "release_date": "22 Ekim 2026",
                "badge": "Önceki Sürüm",
                "badge_type": "minor",
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
    regenerate_extensions_custom_conf(background_tasks)
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
            
        query_ext = (request.query_params.get("extension") or "").strip()
        query_uid = (request.query_params.get("user_id") or "").strip()
        header_user_id = (request.headers.get("X-User-ID") or request.headers.get("x-user-id") or "").strip()
        if header_user_id in ("System", "undefined", "null"):
            header_user_id = ""
        user_id = query_uid or query_ext or header_user_id or (user_info.get("user_id") or user_info.get("id") if user_info else None)
        if str(user_id) == "admin":
            user_id = 1
        
        # Search user by extension, ID, username, or email
        current_user = None
        if query_ext:
            try:
                result = await db.execute(select(SystemUser).filter(SystemUser.extension == query_ext))
                db_user = result.scalars().first()
                if db_user:
                    current_user = {c.name: getattr(db_user, c.name) for c in db_user.__table__.columns}
            except Exception as ex_ext:
                print(f"[WebRTC Config Extension Resolution Error]: {ex_ext}")

        if not current_user and user_id:
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
        if not current_user and (user_id or query_ext):
            target_lookup = query_ext or str(user_id)
            for u in settings_db.get("users", []):
                if str(u.get("id")) == str(user_id) or str(u.get("extension")) == target_lookup or u.get("email") == str(user_id):
                    current_user = dict(u)
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
        if not raw_sip_pwd or raw_sip_pwd == "1234":
            for su in settings_db.get("users", []):
                if str(su.get("extension", "")).strip() == agent_ext and su.get("sip_password"):
                    raw_sip_pwd = su.get("sip_password")
                    break
        sip_password = resolve_secure_sip_password(agent_ext, raw_sip_pwd)
        
        # Dynamically compute WebSocket URL and resolved viaHost IPv4
        req_host = request.headers.get("host", "").split(":")[0] or request.url.hostname or "127.0.0.1"
        xff = (request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip") or "").split(",")[0].strip()
        client_ip = xff or (request.client.host if request.client else "127.0.0.1")

        # Ensure WebRTC client IP is never blocked by SIP firewall
        if client_ip and client_ip not in ("127.0.0.1", "::1", "localhost"):
            try:
                blocked_ips_set = {item.get("ip") for item in settings_db.get("security_blocked_ips", [])}
                if client_ip in blocked_ips_set or client_ip in _enforced_kernel_ban_ips:
                    await asyncio.to_thread(_execute_firewall_unban, client_ip, True)
            except Exception:
                pass

        # If Asterisk AMI is not currently connected, trigger background self-heal check so WSS port 8089 is ready
        try:
            from backend.services.ami_manager import manager_instance as _ami_mgr, get_ami_manager
            if _ami_mgr is None or not getattr(_ami_mgr, "_connected", False):
                asyncio.create_task(get_ami_manager())
        except Exception:
            pass

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

        agent_name = str(
            (current_user.get("full_name") or current_user.get("name") or current_user.get("username") or f"Temsilci {agent_ext}")
            if current_user else f"Temsilci {agent_ext}"
        ).strip()

        return {
            "asteriskWssUrl": wss_url,
            "fallbackWssUrl": f"{scheme}://{req_host}/ws",
            "agentExtension": agent_ext,
            "agentName": agent_name,
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
            "agentName": "Temsilci 1000",
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


# ==============================================================================
# LIVE SPEECH-TO-TEXT TRANSLATION & TWO-WAY VOICE INTERPRETER ENDPOINTS
# ==============================================================================
class LiveTranslateAudioPayload(BaseModel):
    audio_base64: str
    mime_type: Optional[str] = "audio/webm"
    direction: Optional[str] = "customer_to_agent"
    source_lang: Optional[str] = "en"
    target_lang: Optional[str] = "tr"
    generate_tts: Optional[bool] = False
    call_id: Optional[str] = None
    fallback_stt_text: Optional[str] = None


class LiveTranslateTextPayload(BaseModel):
    text: str
    direction: Optional[str] = "customer_to_agent"
    source_lang: Optional[str] = "en"
    target_lang: Optional[str] = "tr"
    generate_tts: Optional[bool] = False
    call_id: Optional[str] = None


LANG_NAME_MAP = {
    "tr": "Turkish (Türkçe)",
    "en": "English (İngilizce)",
    "de": "German (Almanca)",
    "ru": "Russian (Rusça)",
    "ar": "Arabic (Arapça)",
    "fr": "French (Fransızca)",
    "es": "Spanish (İspanyolca)"
}


def _resolve_translator_ai_keys(user_info: Optional[dict] = None) -> dict:
    """Resolves Google/Gemini, Groq, OpenAI, and ElevenLabs API keys across tenant & global settings."""
    target_tenant = (user_info or {}).get("tenant_id") or "tenant-default"
    tenant_prov = {}
    if isinstance(settings_db.get("tenant_ai_providers"), dict):
        tenant_prov = settings_db["tenant_ai_providers"].get(target_tenant) or {}
    global_prov = settings_db.get("ai_providers", {}) if isinstance(settings_db.get("ai_providers"), dict) else {}

    # Also check any other tenant entry if default is empty
    any_tenant_google = ""
    any_tenant_groq = ""
    any_tenant_openai = ""
    any_tenant_el = ""
    if isinstance(settings_db.get("tenant_ai_providers"), dict):
        for _, tp in settings_db["tenant_ai_providers"].items():
            if isinstance(tp, dict):
                any_tenant_google = any_tenant_google or tp.get("google_api_key") or tp.get("gemini_api_key") or ""
                any_tenant_groq = any_tenant_groq or tp.get("groq_api_key") or ""
                any_tenant_openai = any_tenant_openai or tp.get("openai_api_key") or ""
                any_tenant_el = any_tenant_el or tp.get("elevenlabs_api_key") or ""

    raw_gemini_key = (
        tenant_prov.get("google_api_key")
        or tenant_prov.get("gemini_api_key")
        or global_prov.get("google_api_key")
        or global_prov.get("gemini_api_key")
        or any_tenant_google
        or settings_db.get("gemini_api_key")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    ).strip()
    gemini_key = raw_gemini_key if raw_gemini_key.startswith("AIza") else ""

    groq_key = (
        tenant_prov.get("groq_api_key")
        or global_prov.get("groq_api_key")
        or any_tenant_groq
        or os.getenv("GROQ_API_KEY")
        or ""
    ).strip()

    openai_key = (
        tenant_prov.get("openai_api_key")
        or global_prov.get("openai_api_key")
        or any_tenant_openai
        or os.getenv("OPENAI_API_KEY")
        or ""
    ).strip()

    elevenlabs_key = (
        tenant_prov.get("elevenlabs_api_key")
        or global_prov.get("elevenlabs_api_key")
        or any_tenant_el
        or os.getenv("ELEVENLABS_API_KEY")
        or ""
    ).strip()

    return {
        "gemini_key": gemini_key,
        "groq_key": groq_key,
        "openai_key": openai_key,
        "elevenlabs_key": elevenlabs_key,
        "elevenlabs_voice_id": global_prov.get("elevenlabs_voice_id") or "EXAVITQu4vr4xnSDxMaL"
    }


async def _synthesize_translator_tts_base64(text: str, lang_code: str = "tr", user_info: Optional[dict] = None) -> tuple[str, str]:
    """Synthesizes natural speech audio (MP3 base64) for real-time voice interpretation."""
    clean_text = (text or "").strip()
    if not clean_text:
        return "", "audio/mpeg"

    keys = _resolve_translator_ai_keys(user_info)

    # 1. Try ElevenLabs Multilingual v2 if API key is configured
    try:
        el_key = keys["elevenlabs_key"]
        if el_key:
            voice_id = keys["elevenlabs_voice_id"]
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?optimize_streaming_latency=3"
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.post(
                    url,
                    headers={"xi-api-key": el_key, "Content-Type": "application/json"},
                    json={
                        "text": clean_text[:350],
                        "model_id": "eleven_multilingual_v2",
                        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
                    }
                )
                if r.status_code == 200 and r.content:
                    return base64.b64encode(r.content).decode("utf-8"), "audio/mpeg"
    except Exception as el_err:
        print(f"[LiveTranslator ElevenLabs TTS Fallback]: {el_err}")

    # 2. Fast zero-cost Google Translate TTS stream fallback (works for tr, en, de, ru, ar, fr, es)
    try:
        import urllib.parse
        tl = (lang_code or "tr").split("-")[0].lower()
        q_enc = urllib.parse.quote(clean_text[:200])
        tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={tl}&q={q_enc}"
        async with httpx.AsyncClient(timeout=6.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
            r = await client.get(tts_url)
            if r.status_code == 200 and r.content:
                return base64.b64encode(r.content).decode("utf-8"), "audio/mpeg"
    except Exception as g_err:
        print(f"[LiveTranslator Google TTS Warning]: {g_err}")

    return "", "audio/mpeg"


async def _fallback_google_text_translate(text: str, source_lang: str, target_lang: str) -> str:
    """Multi-provider text translator when Gemini key is unavailable or rate-limited."""
    import urllib.parse
    clean_q = (text or "").strip()
    if not clean_q:
        return ""
    sl = (source_lang or "auto").split("-")[0].lower()
    tl = (target_lang or "tr").split("-")[0].lower()
    if sl == tl:
        return clean_q
    q_enc = urllib.parse.quote(clean_q)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    # 1. Google clients5 dict-chrome-ex endpoint (fast, no 429 on server IPs)
    try:
        url1 = f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl={sl}&tl={tl}&q={q_enc}"
        async with httpx.AsyncClient(timeout=6.0, headers=headers) as client:
            r1 = await client.get(url1)
            if r1.status_code == 200:
                arr1 = r1.json()
                if isinstance(arr1, list) and len(arr1) > 0:
                    first = arr1[0]
                    if isinstance(first, str) and first.strip():
                        return first.strip()
                    if isinstance(first, list) and len(first) > 0 and isinstance(first[0], str):
                        return first[0].strip()
    except Exception as e1:
        print(f"[LiveTranslator clients5 Translate Warning]: {e1}")

    # 2. Google translate_a/single with client=dict-chrome-ex
    try:
        url2 = f"https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl={sl}&tl={tl}&dt=t&q={q_enc}"
        async with httpx.AsyncClient(timeout=6.0, headers=headers) as client:
            r2 = await client.get(url2)
            if r2.status_code == 200:
                arr2 = r2.json()
                if isinstance(arr2, list) and len(arr2) > 0 and isinstance(arr2[0], list):
                    joined = "".join(seg[0] for seg in arr2[0] if isinstance(seg, list) and len(seg) > 0 and seg[0])
                    if joined.strip():
                        return joined.strip()
    except Exception as e2:
        print(f"[LiveTranslator dict-chrome-ex Translate Warning]: {e2}")

    # 3. MyMemory Translation API fallback
    try:
        sl_mm = "en" if sl == "auto" else sl
        url3 = f"https://api.mymemory.translated.net/get?q={q_enc}&langpair={sl_mm}|{tl}"
        async with httpx.AsyncClient(timeout=6.0, headers=headers) as client:
            r3 = await client.get(url3)
            if r3.status_code == 200:
                t_mm = ((r3.json().get("responseData") or {}).get("translatedText") or "").strip()
                if t_mm and "MYMEMORY WARNING" not in t_mm.upper():
                    return t_mm
    except Exception as e3:
        print(f"[LiveTranslator MyMemory Translate Warning]: {e3}")

    return ""


STT_LANG_TAG_MAP = {
    "en": "en-US",
    "tr": "tr-TR",
    "de": "de-DE",
    "ru": "ru-RU",
    "ar": "ar-SA",
    "fr": "fr-FR",
    "es": "es-ES"
}


async def _keyless_chromium_stt_from_audio(audio_bytes: bytes, mime_type: str, lang_code: str) -> str:
    """Transcribes 16kHz 16-bit mono WAV (or ffmpeg-converted WebM/OGG) via Google Chromium Speech API v2."""
    if not audio_bytes or len(audio_bytes) < 400:
        return ""
    try:
        from array import array
        import math
        import struct

        pcm_bytes = b""
        sample_rate = 16000

        # Check if audio_bytes is already a RIFF WAV container (sent by LiveTranslatorPanel WAV encoder)
        if audio_bytes[:4] == b"RIFF" and b"WAVE" in audio_bytes[:16]:
            try:
                sample_rate = struct.unpack("<I", audio_bytes[24:28])[0]
                if sample_rate < 8000 or sample_rate > 48000:
                    sample_rate = 16000
            except Exception:
                sample_rate = 16000
            data_idx = audio_bytes.find(b"data")
            pcm_bytes = audio_bytes[data_idx + 8:] if data_idx != -1 else audio_bytes[44:]
        elif shutil.which("ffmpeg"):
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "s16le", "pipe:1",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL
            )
            stdout_data, _ = await asyncio.wait_for(proc.communicate(input=audio_bytes), timeout=5.0)
            if stdout_data and len(stdout_data) > 400:
                pcm_bytes = stdout_data
                sample_rate = 16000

        if not pcm_bytes or len(pcm_bytes) < 400:
            return ""

        if len(pcm_bytes) % 2 != 0:
            pcm_bytes = pcm_bytes[:-1]

        samples = array("h")
        samples.frombytes(pcm_bytes)
        if not samples:
            return ""

        peak = max(abs(x) for x in samples)
        rms = int(math.sqrt(sum(x * x for x in samples) / len(samples)))
        print(f"[LiveTranslator STT Audio] lang={lang_code} in_bytes={len(audio_bytes)} pcm_bytes={len(pcm_bytes)} rms={rms} peak={peak}")
        if rms < 20 or peak < 90:
            return ""

        # Auto-gain normalize quiet telephone/WebRTC RTP audio so speech recognition never misses low volume
        if 90 <= peak < 18000:
            gain = min(10.0, 23000.0 / float(peak))
            samples = array("h", [max(-32767, min(32767, int(x * gain))) for x in samples])
            pcm_bytes = samples.tobytes()

        lang_tag = STT_LANG_TAG_MAP.get(lang_code.split("-")[0].lower(), "en-US")
        chromium_key = "AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw"
        stt_url = f"http://www.google.com/speech-api/v2/recognize?output=json&lang={lang_tag}&key={chromium_key}&client=chromium"

        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                stt_url,
                content=pcm_bytes,
                headers={
                    "Content-Type": f"audio/l16; rate={sample_rate}",
                    "User-Agent": "Mozilla/5.0"
                }
            )
            if resp.status_code == 200 and resp.text:
                for line in resp.text.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    obj = json.loads(line)
                    results = obj.get("result") or []
                    if results and results[0].get("alternative"):
                        alts = results[0]["alternative"]
                        best = alts[0].get("transcript", "").strip()
                        if best:
                            print(f"[LiveTranslator Chromium STT] ({lang_tag}, rms={rms}, peak={peak}) -> '{best}'")
                            return best
    except Exception as stt_err:
        print(f"[LiveTranslator Chromium STT Warning]: {stt_err}")
    return ""


async def _record_bilingual_transcript_turn(
    call_id: Optional[str],
    direction: str,
    original_text: str,
    translated_text: str,
    source_lang: str,
    target_lang: str,
    user_info: Optional[dict] = None
):
    orig_clean = (original_text or "").strip()
    trans_clean = (translated_text or "").strip()
    if call_id == "demo-call-99" or (not trans_clean and not orig_clean):
        return
    try:
        speaker = "customer" if direction == "customer_to_agent" else "human"
        src_upper = (source_lang or "").split("-")[0].upper()
        tgt_upper = (target_lang or "").split("-")[0].upper()
        is_bilingual = (
            orig_clean
            and trans_clean
            and orig_clean.lower() != trans_clean.lower()
            and src_upper != tgt_upper
        )
        if speaker == "customer":
            primary_line = trans_clean or orig_clean
            stored_text = f"{primary_line}\n[[ORIG:{src_upper or 'EN'}]] {orig_clean}" if is_bilingual else primary_line
        else:
            primary_line = orig_clean or trans_clean
            stored_text = f"{primary_line}\n[[TRANS:{tgt_upper or 'EN'}]] {trans_clean}" if is_bilingual else primary_line

        if call_id:
            await ws_manager.broadcast_to_call(
                call_id,
                {
                    "type": "transcript",
                    "speaker": speaker,
                    "text": stored_text
                }
            )

        # Persist turn to PostgreSQL transcripts table across all matching active Call rows
        # (both WebRTC session.id and Asterisk CALL_UUID so Reports & Call History never re-transcribe)
        async with AsyncSessionLocal() as db:
            target_call_ids = []
            matched_call_obj = None
            if call_id and call_id != "live-webrtc-call":
                res = await db.execute(select(Call).where(Call.id == call_id).limit(1))
                matched_call_obj = res.scalar_one_or_none()
                if matched_call_obj:
                    target_call_ids.append(matched_call_obj.id)

            agent_ext = None
            if user_info:
                uid_str = str(user_info.get("user_id") or "").strip().lower()
                for u in settings_db.get("users", []):
                    if (
                        str(u.get("email") or "").strip().lower() == uid_str
                        or str(u.get("name") or "").strip().lower() == uid_str
                        or str(u.get("extension") or "").strip() == uid_str
                    ):
                        agent_ext = str(u.get("extension") or "").strip()
                        break

            cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=25)
            if matched_call_obj and matched_call_obj.start_time:
                sib_start = matched_call_obj.start_time - datetime.timedelta(seconds=180)
                sib_end = matched_call_obj.start_time + datetime.timedelta(seconds=180)
                q_sib = (
                    select(Call.id)
                    .where(
                        and_(
                            Call.start_time >= sib_start,
                            Call.start_time <= sib_end
                        )
                    )
                    .order_by(Call.start_time.desc())
                    .limit(5)
                )
                res_sib = await db.execute(q_sib)
                for cid in res_sib.scalars().all():
                    if cid and cid not in target_call_ids:
                        target_call_ids.append(cid)

            if agent_ext:
                q = (
                    select(Call.id)
                    .where(
                        and_(
                            Call.start_time >= cutoff,
                            or_(
                                Call.caller_number == agent_ext,
                                Call.callee_number == agent_ext,
                                Call.hangup_source == f"pickup:{agent_ext}",
                                Call.status == "in_progress"
                            )
                        )
                    )
                    .order_by(Call.start_time.desc())
                    .limit(3)
                )
                res = await db.execute(q)
                for cid in res.scalars().all():
                    if cid and cid not in target_call_ids:
                        target_call_ids.append(cid)

            if not target_call_ids:
                q_any = (
                    select(Call.id)
                    .where(Call.start_time >= cutoff)
                    .order_by(Call.start_time.desc())
                    .limit(2)
                )
                res_any = await db.execute(q_any)
                for cid in res_any.scalars().all():
                    if cid and cid not in target_call_ids:
                        target_call_ids.append(cid)

            now_utc = datetime.datetime.utcnow()
            for cid in target_call_ids:
                db.add(
                    Transcript(
                        call_id=cid,
                        speaker=speaker,
                        text=stored_text,
                        timestamp=now_utc
                    )
                )
                if cid != call_id:
                    try:
                        await ws_manager.broadcast_to_call(
                            cid,
                            {
                                "type": "transcript",
                                "speaker": speaker,
                                "text": stored_text
                            }
                        )
                    except Exception:
                        pass
            if target_call_ids:
                await db.commit()
    except Exception as rec_err:
        print(f"[LiveTranslator Transcript DB Save Warning]: {rec_err}")


@app.post("/api/live-translator/translate-audio")
@app.post("/live-translator/translate-audio")
async def live_translate_audio_endpoint(payload: LiveTranslateAudioPayload, user_info: dict = Depends(get_user_info)):
    raw_b64 = (payload.audio_base64 or "").strip()
    if ";base64," in raw_b64:
        raw_b64 = raw_b64.split(";base64,", 1)[1].strip()
    elif "," in raw_b64:
        raw_b64 = raw_b64.split(",")[-1].strip()
    fallback_stt = (payload.fallback_stt_text or "").strip()
    if not raw_b64 and not fallback_stt:
        return {"original_text": "", "translated_text": ""}

    src_code = (payload.source_lang or "en").lower()
    tgt_code = (payload.target_lang or "tr").lower()
    effective_direction = payload.direction or "customer_to_agent"
    src_name = LANG_NAME_MAP.get(src_code, src_code)
    tgt_name = LANG_NAME_MAP.get(tgt_code, tgt_code)

    keys = _resolve_translator_ai_keys(user_info)
    gemini_key = keys["gemini_key"]
    groq_key = keys["groq_key"]
    openai_key = keys["openai_key"]

    original_text = ""
    translated_text = ""
    suggested_reply_tr = ""
    suggested_reply_target = ""
    detected_lang = src_code

    audio_bytes = b""
    if raw_b64:
        try:
            padded_b64 = raw_b64 + ("=" * ((4 - len(raw_b64) % 4) % 4))
            audio_bytes = base64.b64decode(padded_b64)
        except Exception as dec_err:
            print(f"[LiveTranslator B64 Decode Warning]: {dec_err}")
            audio_bytes = b""

    print(
        f"[LiveTranslator Req] dir={effective_direction} {src_code}->{tgt_code} "
        f"bytes={len(audio_bytes)} mime={payload.mime_type} fallback='{fallback_stt}'"
    )

    # 1. Primary: Gemini Multimodal Audio -> Transcription + Translation + Suggested Reply in one shot
    if gemini_key and raw_b64:
        prompt_text = (
            f"You are a real-time call center simultaneous interpreter. "
            f"Listen to this audio clip spoken in {src_name}. "
            f"If the audio contains only silence, static, or unintelligible background noise, return empty strings. "
            f"Otherwise, transcribe the exact speech into `original_text` and translate it accurately and naturally into {tgt_name} as `translated_text`. "
            f"Also provide a polite, helpful call-center agent reply suggestion in Turkish (`suggested_reply_tr`) and in {src_name} (`suggested_reply_target`). "
            f"Return ONLY valid JSON with keys: "
            f'{{"detected_lang": "{src_code}", "original_text": "...", "translated_text": "...", "suggested_reply_tr": "...", "suggested_reply_target": "..."}}'
        )
        for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
            try:
                g_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                req_body = {
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt_text},
                                {
                                    "inline_data": {
                                        "mime_type": (payload.mime_type or "audio/wav").split(";")[0],
                                        "data": raw_b64
                                    }
                                }
                            ]
                        }
                    ],
                    "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
                }
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(g_url, json=req_body)
                    if resp.status_code == 200:
                        r_json = resp.json()
                        cand_text = (
                            r_json.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        if cand_text:
                            cleaned = cand_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                            parsed = json.loads(cleaned)
                            original_text = (parsed.get("original_text") or "").strip()
                            translated_text = (parsed.get("translated_text") or "").strip()
                            suggested_reply_tr = (parsed.get("suggested_reply_tr") or "").strip()
                            suggested_reply_target = (parsed.get("suggested_reply_target") or "").strip()
                            detected_lang = (parsed.get("detected_lang") or src_code).strip()
                            break
                    else:
                        print(f"[LiveTranslator Audio Gemini ({model_name}) HTTP {resp.status_code}]: {resp.text[:200]}")
            except Exception as g_err:
                print(f"[LiveTranslator Audio Gemini ({model_name}) Warning]: {g_err}")

    # 2. Secondary Audio STT Fallback: Groq Whisper or OpenAI Whisper
    if not original_text and audio_bytes and (groq_key or openai_key):
        try:
            ext = "wav" if audio_bytes[:4] == b"RIFF" else "webm"
            if groq_key:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    r_w = await client.post(
                        "https://api.groq.com/openai/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {groq_key}"},
                        data={"model": "whisper-large-v3-turbo", "language": src_code.split("-")[0]},
                        files={"file": (f"speech.{ext}", audio_bytes, payload.mime_type or f"audio/{ext}")}
                    )
                    if r_w.status_code == 200:
                        original_text = (r_w.json().get("text") or "").strip()
            if not original_text and openai_key:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    r_w = await client.post(
                        "https://api.openai.com/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {openai_key}"},
                        data={"model": "whisper-1", "language": src_code.split("-")[0]},
                        files={"file": (f"speech.{ext}", audio_bytes, payload.mime_type or f"audio/{ext}")}
                    )
                    if r_w.status_code == 200:
                        original_text = (r_w.json().get("text") or "").strip()
        except Exception as w_err:
            print(f"[LiveTranslator Whisper Fallback Warning]: {w_err}")

    # 3. Built-in Keyless Audio STT: Google Chromium Speech API v2 (16kHz 16-bit WAV/PCM)
    if not original_text and audio_bytes:
        original_text = await _keyless_chromium_stt_from_audio(audio_bytes, payload.mime_type or "audio/wav", src_code)
        # If speaker spoke in the opposite language, recognize it while keeping speaker direction intact
        if not original_text and tgt_code and tgt_code != src_code:
            alt_text = await _keyless_chromium_stt_from_audio(audio_bytes, payload.mime_type or "audio/wav", tgt_code)
            if alt_text:
                original_text = alt_text
                detected_lang = tgt_code
                if effective_direction == "customer_to_agent":
                    translated_text = alt_text

    # 4. Browser SpeechRecognition fallback if provided
    if not original_text and fallback_stt:
        original_text = fallback_stt

    # Filter out common hallucinations on silence
    if original_text.lower().strip(".!?, ") in ("you", "thank you", "thanks for watching", "altyazı m.k.", "subtitle", ""):
        if not fallback_stt:
            original_text = ""

    # Translate transcribed speech if not yet translated
    if original_text and not translated_text:
        if effective_direction == "agent_to_customer" and detected_lang == tgt_code and tgt_code != src_code:
            # Agent spoke in the foreign language directly -> translate to Turkish so primary is Turkish and secondary is foreign
            tr_text = await _fallback_google_text_translate(original_text, tgt_code, src_code)
            translated_text = original_text
            original_text = tr_text or original_text
            detected_lang = src_code
        else:
            translated_text = await _fallback_google_text_translate(original_text, src_code, tgt_code)
            if (
                translated_text
                and translated_text.strip().lower() == original_text.strip().lower()
                and audio_bytes
                and tgt_code != src_code
            ):
                alt_text = await _keyless_chromium_stt_from_audio(audio_bytes, payload.mime_type or "audio/wav", tgt_code)
                if alt_text:
                    if effective_direction == "customer_to_agent":
                        original_text = alt_text
                        translated_text = alt_text
                        detected_lang = tgt_code
                    else:
                        tr_text = await _fallback_google_text_translate(alt_text, tgt_code, src_code)
                        original_text = tr_text or alt_text
                        translated_text = alt_text
                        detected_lang = src_code

    if original_text or translated_text:
        print(f"[LiveTranslator] dir={effective_direction} ({src_code}->{tgt_code}) Original='{original_text}' | Translated='{translated_text}'")

    tts_b64 = ""
    tts_mime = "audio/mpeg"
    if payload.generate_tts and translated_text:
        tts_b64, tts_mime = await _synthesize_translator_tts_base64(translated_text, tgt_code, user_info=user_info)

    if original_text or translated_text:
        await _record_bilingual_transcript_turn(
            payload.call_id,
            effective_direction,
            original_text,
            translated_text,
            detected_lang or src_code,
            tgt_code,
            user_info=user_info
        )

    return {
        "direction": effective_direction,
        "source_lang": src_code,
        "target_lang": tgt_code,
        "detected_lang": detected_lang,
        "original_text": original_text,
        "translated_text": translated_text,
        "suggested_reply_tr": suggested_reply_tr,
        "suggested_reply_target": suggested_reply_target,
        "tts_audio_base64": tts_b64,
        "tts_mime_type": tts_mime
    }


@app.post("/api/live-translator/translate-text")
@app.post("/live-translator/translate-text")
async def live_translate_text_endpoint(payload: LiveTranslateTextPayload, user_info: dict = Depends(get_user_info)):
    clean_text = (payload.text or "").strip()
    if not clean_text:
        return {"original_text": "", "translated_text": ""}

    src_code = (payload.source_lang or "en").lower()
    tgt_code = (payload.target_lang or "tr").lower()
    src_name = LANG_NAME_MAP.get(src_code, src_code)
    tgt_name = LANG_NAME_MAP.get(tgt_code, tgt_code)

    keys = _resolve_translator_ai_keys(user_info)
    gemini_key = keys["gemini_key"]

    translated_text = ""
    suggested_reply_tr = ""
    suggested_reply_target = ""

    if gemini_key:
        prompt_text = (
            f"You are a professional call-center simultaneous interpreter. "
            f"Translate the following message from {src_name} into {tgt_name} naturally and accurately.\n"
            f"Message: \"{clean_text}\"\n"
            f"Also provide a polite call-center agent reply suggestion in Turkish (`suggested_reply_tr`) and in {src_name if payload.direction == 'customer_to_agent' else tgt_name} (`suggested_reply_target`). "
            f"Return ONLY valid JSON: "
            f'{{"translated_text": "...", "suggested_reply_tr": "...", "suggested_reply_target": "..."}}'
        )
        for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
            try:
                g_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                req_body = {
                    "contents": [{"parts": [{"text": prompt_text}]}],
                    "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
                }
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(g_url, json=req_body)
                    if resp.status_code == 200:
                        r_json = resp.json()
                        cand_text = (
                            r_json.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        if cand_text:
                            cleaned = cand_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                            parsed = json.loads(cleaned)
                            translated_text = (parsed.get("translated_text") or "").strip()
                            suggested_reply_tr = (parsed.get("suggested_reply_tr") or "").strip()
                            suggested_reply_target = (parsed.get("suggested_reply_target") or "").strip()
                            break
            except Exception as g_err:
                print(f"[LiveTranslator Text Gemini ({model_name}) Warning]: {g_err}")

    if not translated_text:
        translated_text = await _fallback_google_text_translate(clean_text, src_code, tgt_code)
        if payload.direction == "customer_to_agent" and not suggested_reply_tr:
            suggested_reply_tr = "Memnuniyetle yardımcı olabilirim, hemen kontrol ediyorum."
            suggested_reply_target = await _fallback_google_text_translate(suggested_reply_tr, "tr", src_code)

    tts_b64 = ""
    tts_mime = "audio/mpeg"
    if payload.generate_tts and translated_text:
        tts_b64, tts_mime = await _synthesize_translator_tts_base64(translated_text, tgt_code, user_info=user_info)

    if clean_text or translated_text:
        await _record_bilingual_transcript_turn(
            payload.call_id,
            payload.direction or "customer_to_agent",
            clean_text,
            translated_text,
            src_code,
            tgt_code,
            user_info=user_info
        )

    return {
        "detected_lang": src_code,
        "original_text": clean_text,
        "translated_text": translated_text,
        "suggested_reply_tr": suggested_reply_tr,
        "suggested_reply_target": suggested_reply_target,
        "tts_audio_base64": tts_b64,
        "tts_mime_type": tts_mime
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)


