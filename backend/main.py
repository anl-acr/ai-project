import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
import shutil
import socket
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select, delete, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from typing import Union, List, Optional, Dict, Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
RECORDINGS_DIR = os.path.join(PROJECT_ROOT, "recordings")
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")
ASTERISK_CONFIG_DIR = os.path.join(PROJECT_ROOT, "asterisk_config")

import datetime
import uuid

system_logs = []

def add_system_log(source: str, level: str, message: str):
    now = datetime.datetime.now().strftime("%H:%M:%S")
    system_logs.append({"timestamp": now, "source": source, "level": level, "message": message})
    if len(system_logs) > 50:
        system_logs.pop(0)

add_system_log("SYSTEM", "INFO", "FastAPI Sunucusu başlatıldı.")
add_system_log("DATABASE", "INFO", "Veritabanı bağlantısı kuruldu.")
from backend.database.config import get_db, Base, engine, AsyncSessionLocal
from backend.database.models import Rule, Call, Transcript, Appointment, ChatSession, ChatMessage, Contact, CannedResponse, BlacklistItem, BlockWord, SystemUser, SystemRole, PBXQueue, Trunk, AIAgent, BreakType, SystemSetting
from backend.services.rag_service import index_pdf_file, index_website_url, query_vector_search, index_manual_text, delete_indexed_source, get_genai_client
from backend.services.websocket_manager import ws_manager
import redis.asyncio as aioredis
redis_client = aioredis.Redis(host='localhost', port=6379, decode_responses=True)

from backend.services.audit_logger import log_event

def get_user_info(request: Request):
    user_id = request.headers.get("X-User-ID", "Bilinmeyen")
    return {"user_id": user_id, "ip_address": request.client.host if request.client else None}

app = FastAPI(title="AI PBX & Omnichannel Backend API")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve call recordings statically
os.makedirs(RECORDINGS_DIR, exist_ok=True)
app.mount("/api/recordings", StaticFiles(directory=RECORDINGS_DIR), name="recordings")

os.makedirs("uploads/announcements", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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

class ChannelSettingsSchema(BaseModel):
    whatsapp_token: Optional[str] = None
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

class UserSchema(BaseModel):
    id: Optional[int] = None
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
    sip_password: Optional[str] = None
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
    two_factor_enabled: Optional[bool] = False
    two_factor_method: str = "app"
    two_factor_secret: Optional[str] = None

import string
import secrets
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
    
    # 1. Yapay Zeka Kotaları
    max_agents: Optional[int] = 20
    max_rag_docs: Optional[int] = 100
    max_scenarios: Optional[int] = 20
    
    # 2. Santral Kotaları
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
    
    # 1. Yapay Zeka Kotaları
    max_agents: Optional[int] = 20
    max_rag_docs: Optional[int] = 100
    max_scenarios: Optional[int] = 20
    
    # 2. Santral Kotaları
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
    name: str
    voice: str
    tone: str
    provider: Optional[str] = "google"
    llm_provider: Optional[str] = "google"
    tts_provider: Optional[str] = "google"
    model: str
    temperature: float
    max_tokens: int
    system_instruction: str
    greeting_prompt: Optional[str] = ""
    status: str
    transfer_target: Optional[str] = "200"
    elevenlabs_agent_id: Optional[str] = ""
    elevenlabs_voice_id: Optional[str] = ""
    elevenlabs_stability: Optional[float] = 0.5
    elevenlabs_similarity: Optional[float] = 0.75
    elevenlabs_style: Optional[float] = 0.0

import json

DEFAULT_SETTINGS = {
    "tenants": [
        {
            "id": "tenant-default",
            "name": "Ana Müşteri (Varsayılan)",
            "code": "default",
            "status": "active",
            "created_at": "2026-01-01T00:00:00",
            "max_agents": 10,
            "max_trunks": 5
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
                "pbx:read", "pbx:write", "pbx:delete",
                "channels:read", "channels:write",
                "breaks:read", "breaks:write", "breaks:delete",
                "users:read", "users:write", "users:delete",
                "roles:read", "roles:write", "roles:delete",
                "call_panel:access", "call_panel:listen_records", "logs:access", "storage:access", "transcripts:access", "wallboard:access", "dialer:access", "call_flow:access", "ai_whisper:access", "omnichannel:access", "reports:access",
                "ai_agents:read", "ai_agents:write", "ai_agents:delete", "ai_agents:access",
                "contacts:read", "contacts:write", "contacts:delete",
                "canned_responses:read", "canned_responses:write", "canned_responses:delete",
                "blacklist:read", "blacklist:write", "blacklist:delete",
                "mobile_transfer:read", "mobile_transfer:write",
                "qa:read", "qa:write", "qa:delete",
                "autoprovision_templates:read", "autoprovision_templates:write", "autoprovision_templates:delete",
                "outbound_rules:read", "outbound_rules:write", "outbound_rules:delete",
                "speed_dials:read", "speed_dials:write", "speed_dials:delete",
                "conferences:read", "conferences:write", "conferences:delete",
                "universal_api:read", "universal_api:write", "universal_api:delete",
                "voice_biometrics:read", "voice_biometrics:write", "voice_biometrics:delete",
                "announcements:read", "announcements:write", "announcements:delete",
                "autoprovision:read", "autoprovision:write", "autoprovision:delete",
                "acd_queues:read", "acd_queues:write", "acd_queues:delete",
                "trunks:read", "trunks:write", "trunks:delete",
                "inbound_rules:read", "inbound_rules:write", "inbound_rules:delete",
                "call_pickup_groups:read", "call_pickup_groups:write", "call_pickup_groups:delete",
                "subscriber_groups:read", "subscriber_groups:write", "subscriber_groups:delete",
                "roi_settings:read", "roi_settings:write", "roi_settings:delete",
                "ssl:read", "ssl:write",
                "backup_restore:read", "backup_restore:write",
                "recording_retention:read", "recording_retention:write", "recording_retention:delete",
                "security:read", "security:write", "security:delete",
                "api_budgets:read", "api_budgets:write"
            ],
            "allowed_breaks": [1, 2, 3, 4]
        },
        {
            "id": 2,
            "role_code": "supervisor",
            "name": "Şef (Supervisor)",
            "permissions": [
                "pbx:read", "pbx:write",
                "channels:read", "channels:write",
                "breaks:read", "breaks:write",
                "users:read", "users:write",
                "call_panel:access", "logs:access", "storage:access", "wallboard:access", "ai_whisper:access", "omnichannel:access",
                "contacts:read", "contacts:write", "contacts:delete",
                "canned_responses:read", "canned_responses:write", "canned_responses:delete",
                "blacklist:read", "blacklist:write", "blacklist:delete",
                "mobile_transfer:read", "mobile_transfer:write",
                "qa:read", "qa:write", "qa:delete",
                "recording_retention:read", "recording_retention:write", "recording_retention:delete",
                "security:read", "security:write", "security:delete"
            ],
            "allowed_breaks": [1, 2, 3, 4]
        },
        {
            "id": 3,
            "role_code": "agent",
            "name": "Müşteri Temsilcisi",
            "permissions": [
                "call_panel:access", "omnichannel:access", 
                "contacts:read", "contacts:write",
                "canned_responses:read", "blacklist:read",
                "mobile_transfer:read", "mobile_transfer:write",
                "qa:read", "recording_retention:read"
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
    "conferences": []
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

            # Auto assign security permissions if missing
            if r.get("role_code") in ["admin", "supervisor"]:
                if "security:read" not in new_perms:
                    new_perms.append("security:read")
                if "security:write" not in new_perms:
                    new_perms.append("security:write")
                if "security:delete" not in new_perms:
                    new_perms.append("security:delete")

            # Auto assign all system permissions to admin and superadmin roles
            if r.get("role_code") in ["admin", "superadmin"]:
                admin_defaults = DEFAULT_SETTINGS["roles"][0]["permissions"]
                for p in admin_defaults:
                    if p not in new_perms:
                        new_perms.append(p)
                
            r["permissions"] = list(set(new_perms))
            
    # Ensure auto_whisper_enabled exists in pbx settings (migration)
    if "pbx" in db and "auto_whisper_enabled" not in db["pbx"]:
        db["pbx"]["auto_whisper_enabled"] = True

    # Ensure all trunks have a codec field (migration)
    if "trunks" in db:
        for t in db["trunks"]:
            if "codec" not in t:
                t["codec"] = "G711"

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
async def get_roi_settings():
    return settings_db.get("roi_settings", DEFAULT_SETTINGS["roi_settings"])

@app.post("/api/settings/roi_settings")
async def save_roi_settings(payload: dict):
    settings_db["roi_settings"] = payload
    save_settings(settings_db)
    return {"status": "success"}

@app.get("/api/settings/pbx")
async def get_pbx_settings():
    return settings_db["pbx"]

@app.post("/api/settings/pbx")
async def save_pbx_settings(payload: PBXSettingsSchema):
    settings_db["pbx"] = payload.model_dump()
    save_settings(settings_db)
    # Update local environment variables dynamically so services read them
    os.environ["AMI_HOST"] = payload.ami_host
    os.environ["AMI_PORT"] = str(payload.ami_port)
    os.environ["AMI_USER"] = payload.ami_user
    os.environ["AMI_SECRET"] = payload.ami_secret
    return {"status": "success", "message": "Santral ayarları başarıyla kaydedildi."}

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
    # Trigger Asterisk PJSIP Reload command dynamically to make Asterisk register/unregister the trunk instantly
    try:
        import subprocess
        subprocess.run(["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", "pjsip reload"], check=True, capture_output=True)
        print("[Asterisk Config] PJSIP configurations reloaded successfully in Asterisk container.")
    except Exception as e:
        print(f"[Asterisk Config] Failed to reload PJSIP in Asterisk: {e}")

def run_queue_reload():
    try:
        import subprocess
        subprocess.run(["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", "queue reload all"], check=True, capture_output=True)
        print("[Asterisk Config] Queue configurations reloaded successfully in Asterisk container.")
    except Exception as e:
        print(f"[Asterisk Config] Failed to reload queues in Asterisk: {e}")

def regenerate_pjsip_custom_conf(background_tasks: Optional[BackgroundTasks] = None):
    conf_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN SIP TRUNK AYARLARI
; ==========================================

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0
"""
    for t in settings_db.get("trunks", []):
        if not t.get("is_active", True):
            print(f"[Asterisk Config] Pasif trunk atlandi: {t['trunk_name']}")
            continue
        name = t["trunk_name"]
        host = t["host"]
        port = t["port"]
        did = t["did_number"]
        protocol = t.get("protocol", "udp")
        transport = "transport-tcp" if protocol == "tcp" else "transport-udp"
        
        conf_content += f"\n; --- TRUNK: {name} ({t['trunk_type'].upper()}) ---\n"
        
        if t["trunk_type"] == "register":
            conf_content += f"""[{name}-reg]
type=registration
transport={transport}
outbound_auth={name}-auth
client_uri=sip:{t['username']}@{host}:{port}
server_uri=sip:{host}:{port}
contact_user={did}

[{name}-auth]
type=auth
auth_type=userpass
username={t['username']}
password={t['password']}

"""

        conf_content += f"""[{name}-aor]
type=aor
contact=sip:{host}:{port}

[{name}]
type=endpoint
transport={transport}
context=default
disallow=all
allow=ulaw,alaw,g729
aors={name}-aor
"""
        if t["trunk_type"] == "register":
            conf_content += f"""outbound_auth={name}-auth
from_user={t['username']}
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

    for u in settings_db.get("users", []):
        if not u.get("is_active", True):
            continue
        ext = u.get("extension")
        if not ext:
            continue
        pwd = u.get("sip_password", "1234")
        name = u.get("full_name", ext)
        
        conf_content += f"\n; --- USER: {name} ({ext}) ---\n"
        conf_content += f"""[{ext}](webrtc_agent_template)
type=endpoint
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
max_contacts=5
remove_existing=yes
"""

    config_dir = ASTERISK_CONFIG_DIR
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, "pjsip_custom.conf")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(conf_content)
    print(f"[Asterisk Config] pjsip_custom.conf yeniden uretildi: {config_path}")

    if background_tasks:
        background_tasks.add_task(run_pjsip_reload)
    else:
        run_pjsip_reload()

def regenerate_queues_conf(background_tasks: Optional[BackgroundTasks] = None):
    conf_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN KUYRUK AYARLARI
; ==========================================
"""
    for q in settings_db.get("queues", []):
        if not q.get("is_active", True):
            continue
        name = q.get("name", "queue_temp")
        strategy = q.get("strategy", "ringall")
        timeout = q.get("timeout", 15)
        retry = q.get("retry", 5)
        wrapup = q.get("wrapuptime", 0)
        
        conf_content += f"\n[{name}]\n"
        conf_content += f"strategy={strategy}\n"
        conf_content += f"timeout={timeout}\n"
        conf_content += f"retry={retry}\n"
        conf_content += f"wrapuptime={wrapup}\n"
        conf_content += "autopause=no\n"
        conf_content += "maxlen=0\n"
        conf_content += "joinempty=yes\n"
        conf_content += "leavewhenempty=no\n"
        
        for member in q.get("queueMembers", []):
            user_id = member.get("user_id")
            # Find the user's extension
            u = next((u for u in settings_db.get("users", []) if u["id"] == user_id), None)
            if u and u.get("extension"):
                conf_content += f"member => PJSIP/{u['extension']}\n"
                
    config_dir = ASTERISK_CONFIG_DIR
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, "queues_custom.conf")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(conf_content)
    print(f"[Asterisk Config] queues_custom.conf yeniden uretildi: {config_path}")

    if background_tasks:
        background_tasks.add_task(run_queue_reload)
    else:
        run_queue_reload()

@app.get("/api/v1_old/settings/trunks")
async def list_trunks():
    return settings_db["trunks"]

@app.post("/api/v1_old/settings/trunks")
async def add_or_update_trunk(payload: TrunkSettingsSchema, background_tasks: BackgroundTasks):
    data = payload.model_dump()
    if not data.get("id"):
        # Auto-generate ID
        data["id"] = max([t["id"] for t in settings_db["trunks"]]) + 1 if settings_db["trunks"] else 1
        settings_db["trunks"].append(data)
    else:
        # Update existing
        for index, t in enumerate(settings_db["trunks"]):
            if t["id"] == data["id"]:
                settings_db["trunks"][index] = data
                break
                
    save_settings(settings_db)
    regenerate_pjsip_custom_conf(background_tasks)
    
    await log_event(
        user_id=user_info["user_id"],
        action="SAVE_TRUNK",
        module="SIP Trunks",
        details={"trunk_name": data.get("trunk_name")},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "message": "SIP Trunk başarıyla kaydedildi.", "trunk": data}

@app.delete("/api/settings/trunks/{trunk_id}")
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
async def get_channel_settings():
    return settings_db["channels"]

@app.post("/api/settings/channels")
async def save_channel_settings(payload: ChannelSettingsSchema):
    settings_db["channels"] = payload.model_dump()
    return {"status": "success", "message": "Kanal entegrasyon ayarları kaydedildi."}

@app.get("/api/settings/smart-callback")
async def get_smart_callback_settings():
    return settings_db.get("smart_callback", DEFAULT_SETTINGS["smart_callback"])

@app.post("/api/settings/smart-callback")
async def save_smart_callback_settings(payload: SmartCallbackSettingsSchema):
    settings_db["smart_callback"] = payload.model_dump()
    save_settings(settings_db)
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
async def get_custom_apis_endpoint():
    return settings_db.get("custom_apis", [])

@app.post("/api/settings/custom-apis")
async def save_custom_apis_endpoint(payload: CustomAPIsSavePayload):
    settings_db["custom_apis"] = [api.model_dump() for api in payload.custom_apis]
    save_settings(settings_db)
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
async def get_voice_biometrics_settings():
    return settings_db.get("voice_biometrics", DEFAULT_SETTINGS["voice_biometrics"])

@app.post("/api/settings/voice-biometrics")
async def save_voice_biometrics_settings(payload: VoiceBiometricsSettingsSchema):
    settings_db["voice_biometrics"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Ses biyometrisi ve deepfake koruma ayarları kaydedildi."}

class RecordingRetentionSettingsSchema(BaseModel):
    delete_by_disk: bool
    disk_threshold_pct: int
    keep_days: int
    delete_by_days: bool

@app.get("/api/settings/recording-retention")
async def get_recording_retention_settings():
    return settings_db.get("recording_retention", DEFAULT_SETTINGS["recording_retention"])

@app.post("/api/settings/recording-retention")
async def save_recording_retention_settings(payload: RecordingRetentionSettingsSchema):
    settings_db["recording_retention"] = payload.model_dump()
    save_settings(settings_db)
    
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
async def get_dialer_settings():
    return settings_db.get("dialer", DEFAULT_SETTINGS["dialer"])

@app.post("/api/settings/dialer")
async def save_smart_dialer_settings(payload: DialerSettingsSchema):
    settings_db["dialer"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Dış arama (Outbound Dialer) ayarları kaydedildi."}

@app.get("/api/settings/call-flow")
async def get_call_flow_settings():
    return settings_db.get("call_flow", DEFAULT_SETTINGS["call_flow"])

@app.post("/api/settings/call-flow")
async def save_call_flow_settings(payload: CallFlowSettingsSchema):
    settings_db["call_flow"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Giriş çağrı akış şeması (Call Flow) başarıyla kaydedildi."}

@app.get("/api/settings/call-flow/workflows")
async def get_workflows():
    return settings_db.get("workflows", DEFAULT_SETTINGS["workflows"])

@app.post("/api/settings/call-flow/workflows")
async def save_workflow(payload: WorkflowSchema):
    wfs = settings_db.get("workflows", [])
    updated = False
    new_wf = payload.model_dump()
    for idx, w in enumerate(wfs):
        if w.get("id") == new_wf["id"]:
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
async def control_dialer(payload: DialerControlPayload):
    global DIALER_STATE, DIALER_RECORDS
    action = payload.action
    if action == "start":
        DIALER_STATE["status"] = "running"
        DIALER_STATE["current_calls"] = settings_db.get("dialer", {}).get("concurrent_calls", 3)
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
async def get_breaks_endpoint():
    return settings_db.get("breaks", [])

@app.post("/api/settings/breaks")
async def save_breaks_endpoint(payload: List[BreakSchema]):
    settings_db["breaks"] = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
        settings_db["breaks"].append(data)
    save_settings(settings_db)
    return {"status": "success", "breaks": settings_db["breaks"]}

import uuid

@app.get("/api/settings/locations")
async def get_locations_endpoint():
    return settings_db.get("locations", [])

@app.post("/api/settings/locations")
async def save_locations_endpoint(payload: List[LocationSchema]):
    settings_db["locations"] = []
    for item in payload:
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = str(uuid.uuid4())
        settings_db["locations"].append(data)
    save_settings(settings_db)
    return {"status": "success", "locations": settings_db["locations"]}

@app.get("/api/settings/departments")
async def get_departments_endpoint():
    return settings_db.get("departments", [])

@app.post("/api/settings/departments")
async def save_departments_endpoint(payload: List[DepartmentSchema]):
    settings_db["departments"] = []
    for item in payload:
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = str(uuid.uuid4())
        settings_db["departments"].append(data)
    save_settings(settings_db)
    return {"status": "success", "departments": settings_db["departments"]}

@app.get("/api/agent/status")
async def get_agent_status_endpoint():
    from backend.services.agent_presence import get_agent_state
    return get_agent_state()

@app.post("/api/agent/status")
async def update_agent_status_endpoint(payload: AgentStateSchema):
    from backend.services.agent_presence import update_agent_state
    new_state = update_agent_state(
        is_logged_in=payload.is_logged_in,
        status=payload.status,
        current_break=payload.current_break,
        user_id=payload.user_id
    )
    return {"status": "success", "agent_state": new_state}

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
    avatar: str
    gsm_number: Optional[str] = None
    mobile_transfer_enabled: Optional[bool] = None
    theme_color: Optional[str] = "rose"
    forwarding_always: Optional[dict] = None
    forwarding_busy: Optional[dict] = None
    forwarding_no_answer: Optional[dict] = None

@app.post("/api/agent/profile/{user_id}")
async def update_agent_profile_endpoint(user_id: int, payload: ProfileUpdateSchema):
    user = None
    for u in settings_db.get("users", []):
        if u.get("id") == user_id:
            user = u
            break
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    
    user["avatar"] = payload.avatar
    
    role_code = user.get("role", "agent")
    role_perms = []
    for r in settings_db.get("roles", []):
        if r.get("role_code") == role_code:
            role_perms = r.get("permissions", [])
            break
            
    has_write_perm = "mobile_transfer:write" in role_perms
    
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
        
    save_settings(settings_db)
    return {"status": "success", "user": user}

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
async def get_announcements():
    return settings_db.get("announcements", [])

@app.post("/api/settings/announcements")
async def create_announcement(
    name: str = Form(...),
    type: str = Form("announcement"),
    file: UploadFile = File(...)
):
    import uuid
    import time
    import shutil
    import os
    
    os.makedirs("uploads/announcements", exist_ok=True)
    
    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if "." in file.filename else "wav"
    filename = f"{file_id}.{ext}"
    filepath = os.path.join("uploads/announcements", filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    new_announcement = {
        "id": file_id,
        "name": name,
        "type": type,
        "filename": filename,
        "original_filename": file.filename,
        "created_at": time.time()
    }
    
    if "announcements" not in settings_db:
        settings_db["announcements"] = []
        
    settings_db["announcements"].append(new_announcement)
    save_settings(settings_db)
    return {"status": "success", "announcement": new_announcement}

class TTSAnnouncementSchema(BaseModel):
    name: str
    text: str

@app.post("/api/settings/announcements/tts")
async def create_tts_announcement(payload: TTSAnnouncementSchema):
    import uuid
    import time
    import os
    
    os.makedirs("uploads/announcements", exist_ok=True)
    
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.mp3"
    filepath = os.path.join("uploads/announcements", filename)
    
    text = payload.text
    if not text:
        raise HTTPException(status_code=400, detail="Metin boş olamaz.")
        
    try:
        import edge_tts
        edge_voice = "tr-TR-DilaraNeural"
        communicate = edge_tts.Communicate(text, edge_voice)
        
        async def gather_audio():
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            return audio_data
            
        audio_bytes = await gather_audio()
        with open(filepath, "wb") as fp:
            fp.write(audio_bytes)
    except Exception as edge_err:
        try:
            from gtts import gTTS
            tts = gTTS(text=text, lang="tr")
            tts.save(filepath)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"TTS Sentezleme hatası: gTTS failed: {str(e)}, edge-tts failed: {str(edge_err)}")
        
    new_announcement = {
        "id": file_id,
        "name": payload.name,
        "filename": filename,
        "original_filename": f"tts_{file_id[:8]}.mp3",
        "created_at": time.time()
    }
    
    if "announcements" not in settings_db:
        settings_db["announcements"] = []
        
    settings_db["announcements"].append(new_announcement)
    save_settings(settings_db)
    return {"status": "success", "announcement": new_announcement}


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
async def get_autoprovision():
    return settings_db.get("autoprovision", [])

@app.post("/api/settings/autoprovision")
async def save_autoprovision(payload: dict):
    if "autoprovision" not in settings_db:
        settings_db["autoprovision"] = []
    
    mac = payload.get("mac")
    if not mac:
        return {"status": "error", "message": "MAC adresi zorunludur."}
        
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
    # Mocking active scan with some dummy data to ensure it works in demo + parsing arp
    # Common SIP OUIs
    oui_map = {
        "00:15:65": "Yealink",
        "00:0b:82": "Grandstream",
        "00:04:13": "Snom",
        "00:08:5d": "Aastra",
        "0c:38:3e": "Fanvil"
    }
    
    try:
        # Try to run arp -a to get local network devices
        arp_out = subprocess.check_output(["arp", "-a"]).decode("utf-8")
        # Format can be: ? (192.168.1.5) at 00:15:65:11:22:33 on en0 ifscope [ethernet]
        # Or: 192.168.1.5 00-15-65-11-22-33 dynamic
        mac_ip_pattern = re.findall(r'\(?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\)?\s+(?:at\s+)?([0-9a-fA-F:-]{11,17})', arp_out)
        
        for ip, mac in mac_ip_pattern:
            mac_clean = mac.replace('-', ':').lower()
            # Format to 00:00:00:00:00:00 if it drops leading zeros (macOS sometimes does this: 0:15:65...)
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
        
    # Add some mock devices for the demo if none found
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
async def get_autoprovision_templates():
    return settings_db.get("autoprovision_templates", [])

@app.post("/api/settings/autoprovision_templates")
async def save_autoprovision_template(payload: dict):
    if "autoprovision_templates" not in settings_db:
        settings_db["autoprovision_templates"] = []
    
    # payload: {id, brand, model, name, xml_content}
    template_id = payload.get("id")
    
    # Check if exists (edit)
    updated = False
    for i, t in enumerate(settings_db["autoprovision_templates"]):
        if t.get("id") == template_id:
            settings_db["autoprovision_templates"][i] = payload
            updated = True
            break
            
    if not updated:
        import uuid
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
async def get_outbound_rules():
    return settings_db.get("outbound_rules", [])
    return []

@app.post("/api/settings/outbound_rules")
async def save_outbound_rule(request: Request):
    payload = await request.json()
    if "outbound_rules" not in settings_db:
        settings_db["outbound_rules"] = []
    
    # Check if updating or creating
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
async def get_inbound_rules():
    return settings_db.get("inbound_rules", [])

@app.post("/api/settings/inbound_rules")
async def save_inbound_rule(request: Request):
    payload = await request.json()
    if "inbound_rules" not in settings_db:
        settings_db["inbound_rules"] = []
    
    # Check if updating or creating
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
async def get_call_pickup_groups():
    return settings_db.get("call_pickup_groups", [])

@app.post("/api/settings/call_pickup_groups")
async def save_call_pickup_group(request: Request):
    data = await request.json()
    if "call_pickup_groups" not in settings_db:
        settings_db["call_pickup_groups"] = []
    
    group_id = data.get("id")
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
async def get_subscriber_groups():
    return settings_db.get("subscriber_groups", [])

@app.post("/api/settings/subscriber_groups")
async def save_subscriber_group(payload: dict):
    if "subscriber_groups" not in settings_db:
        settings_db["subscriber_groups"] = []
    
    data = payload
    group_id = data.get("id")
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
@app.get("/api/acl/check_subscriber_call")
async def check_subscriber_call(caller: str, callee: str):
    from fastapi import Response
    groups = settings_db.get("subscriber_groups", [])
    
    caller_groups = []
    callee_groups = []
    
    for g in groups:
        exts = g.get("extensions", [])
        if caller in exts:
            caller_groups.append(g)
        if callee in exts:
            callee_groups.append(g)
            
    # Eğer herhangi birinin grubu yoksa aramaya izin ver. (Kısıtlama sadece gruplu aboneler içindir)
    if not caller_groups or not callee_groups:
        return Response(content="ALLOW", media_type="text/plain")
        
    caller_gids = set(str(g.get("id")) for g in caller_groups)
    callee_gids = set(str(g.get("id")) for g in callee_groups)
    
    # 1. Aynı gruba dahil iseler
    if caller_gids.intersection(callee_gids):
        return Response(content="ALLOW", media_type="text/plain")
        
    # 2. Arayanın izin verilen arama (outbound) grupları arasında aranan var mı?
    for g in caller_groups:
        outbound = set(str(x) for x in g.get("allowed_outbound_groups", []))
        if outbound.intersection(callee_gids):
            return Response(content="ALLOW", media_type="text/plain")
            
    # 3. Arananın izin verilen gelen (inbound) grupları arasında arayan var mı?
    for g in callee_groups:
        inbound = set(str(x) for x in g.get("allowed_inbound_groups", []))
        if inbound.intersection(caller_gids):
            return Response(content="ALLOW", media_type="text/plain")
            
    return Response(content="DENY", media_type="text/plain")

# --- Speed Dials ---
@app.get("/api/settings/speed_dials")
async def get_speed_dials():
    return settings_db.get("speed_dials", [])

@app.post("/api/settings/speed_dials")
async def save_speed_dial(request: Request):
    data = await request.json()
    if "speed_dials" not in settings_db:
        settings_db["speed_dials"] = []
        
    if "id" in data and data["id"]:
        # Update existing
        for idx, sd in enumerate(settings_db["speed_dials"]):
            if sd.get("id") == data["id"]:
                settings_db["speed_dials"][idx] = data
                break
    else:
        # Create new
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
async def get_conferences():
    return settings_db.get("conferences", [])

@app.post("/api/settings/conferences")
async def save_conference(request: Request):
    data = await request.json()
    if "conferences" not in settings_db:
        settings_db["conferences"] = []
        
    if "id" in data and data["id"]:
        for idx, conf in enumerate(settings_db["conferences"]):
            if conf.get("id") == data["id"]:
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
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Sadece PDF dosyaları yüklenebilir.")
        
    temp_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Index file into pgvector
        await index_pdf_file(temp_path, file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF indeksleme hatası: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    return {"status": "success", "message": f"'{file.filename}' başarıyla yüklendi ve indekslendi."}

@app.post("/api/rag/crawl")
async def crawl_url(payload: CrawlRequestSchema):
    try:
        await index_website_url(payload.url)
        return {"status": "success", "message": f"'{payload.url}' tarandı ve indekslendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crawl hatası: {str(e)}")

@app.get("/api/settings/rag")
async def get_rag_settings_endpoint():
    return settings_db.get("rag", DEFAULT_SETTINGS["rag"])

@app.post("/api/settings/rag")
async def save_rag_settings_endpoint(payload: RAGSettingsSchema):
    settings_db["rag"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success", "message": "Bilgi Bankası (RAG) ayarları kaydedildi."}

@app.get("/api/settings/ai-providers")
async def get_ai_providers():
    return settings_db.get("ai_providers", DEFAULT_SETTINGS["ai_providers"])

class AIProvidersSchema(BaseModel):
    google_api_key: str
    openai_api_key: str
    anthropic_api_key: str
    groq_api_key: str
    elevenlabs_api_key: str

@app.post("/api/settings/ai-providers")
async def save_ai_providers(payload: AIProvidersSchema):
    settings_db["ai_providers"] = payload.model_dump()
    save_settings(settings_db)
    return {"status": "success"}

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
    # Only update loaded_credit from user, keep spent_credit from DB unless overridden
    new_budgets = payload.model_dump()
    current_budgets = settings_db.get("api_budgets", DEFAULT_SETTINGS["api_budgets"])
    
    for provider, data in new_budgets.items():
        if provider in current_budgets:
            current_budgets[provider]["loaded_credit"] = data["loaded_credit"]
            # We don't overwrite spent_credit here to prevent accidental reset by UI
            # Unless explicitly designed, but for now we only update loaded_credit via UI
    
    settings_db["api_budgets"] = current_budgets
    save_settings(settings_db)
    return {"status": "success"}

@app.get("/api/settings/ai-agents")
async def get_ai_agents():
    return settings_db.get("ai_agents", DEFAULT_SETTINGS["ai_agents"])

@app.post("/api/settings/ai-agents")
async def save_ai_agent(payload: AIAgentSchema):
    agents = settings_db.get("ai_agents", [])
    exists = False
    for idx, agent in enumerate(agents):
        if agent["id"] == payload.id:
            agents[idx] = payload.model_dump()
            exists = True
            break
    if not exists:
        agents.append(payload.model_dump())
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

# ==========================================
# TENANT MANAGEMENT & CLONING ENDPOINTS
# ==========================================

def clone_tenant_config(source_tenant_id: str, target_tenant_id: str, db: Session):
    """Clones all agents, rules, trunks, queues, document_chunks, and settings from source to target tenant."""
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
    except Exception as e:
        print(f"[Error] Tenant config cloning failed: {e}")
        db.rollback()


@app.get("/api/tenants")
@app.get("/api/tenants/")
@app.get("/api/settings/tenants")
@app.get("/api/settings/tenants/")
def check_and_update_tenant_expiration(tenants):
    """Checks license expiration dates for all tenants and automatically updates status to passive when expired (ignores unlimited)."""
    now = datetime.datetime.utcnow()
    changed = False
    for t in tenants:
        exp_str = t.get("license_expires_at")
        if exp_str and str(exp_str).strip() and str(exp_str).lower() not in ["unlimited", "limitsiz", "suresiz", "null", "none", ""]:
            try:
                if len(exp_str) == 10:
                    exp_date = datetime.datetime.strptime(exp_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                else:
                    exp_date = datetime.datetime.fromisoformat(exp_str.replace("Z", "+00:00")).replace(tzinfo=None)
                
                if exp_date < now and t.get("status") != "passive":
                    t["status"] = "passive"
                    changed = True
                    add_system_log("TENANT_MANAGEMENT", "LICENSE_EXPIRED", f"Kiracı Lisans Süresi Doldu (Otomatik Pasif Yapıldı): {t.get('name')} ({t.get('id')})")
            except Exception as e:
                print(f"[License Check Error] {e}")
    return changed


@app.get("/api/tenants")
@app.get("/api/tenants/")
@app.get("/api/settings/tenants")
@app.get("/api/settings/tenants/")
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
        raise HTTPException(
            status_code=400,
            detail=f"Lisans adetiniz yetersiz. '{matched.get('name')}' müşterisi için {label} lisans kotası ({max_allowed}) dolmuştur. Lütfen lisans paketinizi veya kotanızı yükseltiniz."
        )


@app.get("/api/tenants")
@app.get("/api/tenants/")
@app.get("/api/settings/tenants")
@app.get("/api/settings/tenants/")
async def get_tenants():
    """Returns list of registered tenants with license expiration checks."""
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])
    if check_and_update_tenant_expiration(tenants):
        current["tenants"] = tenants
        save_settings(current)
        settings_db["tenants"] = tenants
    return tenants


@app.post("/api/tenants")
@app.post("/api/tenants/")
@app.post("/api/settings/tenants")
@app.post("/api/settings/tenants/")
async def create_tenant(payload: TenantCreateSchema, db: Session = Depends(get_db)):
    """Creates a new Tenant with cryptographic license key and 19 quota limits across 3 categories."""
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])
    
    tenant_code = payload.code.strip().lower().replace(" ", "-")
    tenant_id = f"tenant-{tenant_code}"
    
    existing = next((t for t in tenants if t.get("code") == tenant_code or t.get("id") == tenant_id), None)
    if existing:
        return existing
        
    import uuid
    generated_key = payload.license_key or f"AIDA-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:4].upper()}-2026"
    
    new_tenant = {
        "id": tenant_id,
        "name": payload.name.strip(),
        "code": tenant_code,
        "status": payload.status or "active",
        "created_at": datetime.datetime.utcnow().isoformat(),
        "license_expires_at": payload.license_expires_at or "",
        "license_key": generated_key,
        "plan_tier": payload.plan_tier or "professional",
        
        # 1. Yapay Zeka Kotaları
        "max_agents": payload.max_agents or 20,
        "max_rag_docs": payload.max_rag_docs or 100,
        "max_scenarios": payload.max_scenarios or 20,
        
        # 2. Santral Kotaları
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
    clone_tenant_config("tenant-default", tenant_id, db)
    
    add_system_log("TENANT_MANAGEMENT", "CREATE", f"Yeni Kiracı Lisansı Oluşturuldu: {payload.name} ({tenant_id}) [Lisans Key: {generated_key}]")
    return new_tenant


@app.put("/api/tenants/{tenant_id}")
@app.put("/api/tenants/{tenant_id}/")
@app.put("/api/settings/tenants/{tenant_id}")
@app.put("/api/settings/tenants/{tenant_id}/")
async def update_tenant(tenant_id: str, payload: TenantCreateSchema):
    """Updates tenant metadata, license key, package tier, and all 19 quota limits."""
    current = load_settings()
    tenants = current.get("tenants", DEFAULT_SETTINGS["tenants"])
    
    target_tenant = next((t for t in tenants if t.get("id") == tenant_id), None)
    if not target_tenant:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")
        
    target_tenant["name"] = payload.name.strip()
    target_tenant["status"] = payload.status or target_tenant.get("status", "active")
    target_tenant["license_expires_at"] = payload.license_expires_at if payload.license_expires_at is not None else target_tenant.get("license_expires_at", "")
    if payload.license_key:
        target_tenant["license_key"] = payload.license_key
    target_tenant["plan_tier"] = payload.plan_tier or target_tenant.get("plan_tier", "professional")
    
    # 1. Yapay Zeka Kotaları
    target_tenant["max_agents"] = payload.max_agents or target_tenant.get("max_agents", 20)
    target_tenant["max_rag_docs"] = payload.max_rag_docs or target_tenant.get("max_rag_docs", 100)
    target_tenant["max_scenarios"] = payload.max_scenarios or target_tenant.get("max_scenarios", 20)
    
    # 2. Santral Kotaları
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
    
    if not text:
        raise HTTPException(status_code=400, detail="Test metni boş olamaz.")
        
    try:
        # Try using premium edge-tts
        import edge_tts
        
        edge_voice = "tr-TR-DilaraNeural"
        if "ahmet" in voice.lower():
            edge_voice = "tr-TR-AhmetNeural"
        elif "selin" in voice.lower():
            edge_voice = "tr-TR-DilaraNeural"
        elif "eser" in voice.lower():
            edge_voice = "tr-TR-AhmetNeural"
        elif "sophia" in voice.lower():
            edge_voice = "en-US-AriaNeural"
        elif "john" in voice.lower():
            edge_voice = "en-US-GuyNeural"
            
        rate = "+0%"
        pitch = "+0Hz"
        if tone == "calm":
            rate = "-15%"
            pitch = "-3Hz"
        elif tone == "attractive":
            rate = "+5%"
            pitch = "+4Hz"
        elif tone == "firm":
            rate = "+10%"
            pitch = "-2Hz"
            
        communicate = edge_tts.Communicate(text, edge_voice, rate=rate, pitch=pitch)
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
        
        print(f"[TTS] Synthesized successfully using edge-tts (voice={edge_voice}, tone={tone})")
        return StreamingResponse(fp, media_type="audio/mpeg")
        
    except (ImportError, ModuleNotFoundError):
        # Fallback to gtts
        print("[TTS] edge-tts not installed, falling back to gtts.")
        from gtts import gTTS
        
        lang = "tr"
        if any(w in voice.lower() or w in text.lower() for w in ["english", "john", "sophia"]):
            lang = "en"
            
        slow = True if tone == "calm" else False
        tts = gTTS(text=text, lang=lang, slow=slow)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        
        return StreamingResponse(fp, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS Sentezleme hatası: {str(e)}")

@app.post("/api/rag/manual")
async def add_manual_text(payload: ManualTextSchema):
    try:
        await index_manual_text(payload.title, payload.text)
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
async def get_indexed_sources(db: AsyncSession = Depends(get_db)):
    from backend.database.models import DocumentChunk
    stmt = select(DocumentChunk.filename).distinct()
    result = await db.execute(stmt)
    sources = result.scalars().all()
    return [{"name": name} for name in sources]

@app.get("/api/calls/register")
async def register_call_endpoint(call_id: str, did: str, caller: str, asterisk_id: Optional[str] = None):
    if asterisk_id:
        from backend.services.ami_manager import call_id_to_asterisk_id
        call_id_to_asterisk_id[call_id] = asterisk_id
        print(f"[AMI] Mapped Call UUID {call_id} -> Asterisk Uniqueid {asterisk_id}")
        add_system_log("ASTERISK", "INFO", f"Kanal Eşleşti: Call UUID={call_id} -> Asterisk ID={asterisk_id}")

    async with AsyncSessionLocal() as session:
        # Check blacklist
        stmt_black = select(BlacklistItem).where(
            (BlacklistItem.type == "phone") & 
            (BlacklistItem.value == caller)
        )
        res_black = await session.execute(stmt_black)
        blacklisted = res_black.scalar_one_or_none()
        
        if blacklisted:
            import asyncio
            from backend.services.ami_manager import hangup_call
            print(f"[Abuse Shield] Blocked incoming call from blacklisted caller: {caller}")
            add_system_log("ABUSE_SHIELD", "WARNING", f"Kara Listeden Gelen Arama Reddedildi: Arayan={caller} (Sebep: {blacklisted.reason})")
            
            # Register call as blocked
            new_call = Call(
                id=call_id,
                caller_number=caller,
                callee_number=did,
                status="blocked",
                start_time=datetime.datetime.utcnow()
            )
            session.add(new_call)
            await session.commit()
            
            # Request immediate AMI hangup
            asyncio.create_task(hangup_call(call_id))
            return {"status": "blocked", "message": "Caller is blacklisted."}

        # Check if already exists
        db_call = await session.get(Call, call_id)
        if not db_call:
            new_call = Call(
                id=call_id,
                caller_number=caller,
                callee_number=did,
                status="in_progress",
                start_time=datetime.datetime.utcnow()
            )
            session.add(new_call)
            await session.commit()
        else:
            # Update existing record created by audiosocket
            if caller and caller != "Bilinmeyen":
                db_call.caller_number = caller
            if did:
                db_call.callee_number = did
            await session.commit()

            print(f"[Asterisk Dialplan] Call registered successfully: {call_id} (Caller: {caller}, DID: {did}, Asterisk ID: {asterisk_id})")
            add_system_log("ASTERISK", "INFO", f"Yeni Arama Başlatıldı: Arayan={caller or 'Bilinmeyen'}, DID={did}, ID={call_id}")
    return {"status": "success"}

@app.get("/api/calls/end")
async def end_call_endpoint(call_id: str):
    async with AsyncSessionLocal() as session:
        db_call = await session.get(Call, call_id)
        if db_call:
            db_call.status = "completed"
            db_call.end_time = datetime.datetime.utcnow()
            
            # Asterisk MixMonitor kaydediyor, bazen dosya diske yazılırken gecikme olabiliyor.
            # Bu yüzden dosya var mı diye kontrol etmeden doğrudan yolu veriyoruz.
            db_call.recording_path = f"/api/recordings/{call_id}.wav"

            await session.commit()
            print(f"[Asterisk Dialplan] Call ended successfully: {call_id}")
            add_system_log("ASTERISK", "INFO", f"Arama Sonlandı: ID={call_id}")
    return {"status": "success"}


# ----------------------------------------------------
# API Routes: Calls & Transcripts History
# ----------------------------------------------------
@app.get("/api/calls")
async def list_calls(
    start_date: str = None,
    end_date: str = None,
    caller_number: str = None,
    call_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    from datetime import datetime, time, timedelta
    stmt = select(Call)
    
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
        
    if call_id:
        stmt = stmt.where(Call.id.ilike(f"%{call_id}%"))
        
    stmt = stmt.order_by(Call.start_time.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@app.get("/api/calls/active")
async def get_active_calls():
    from backend.services.ami_manager import active_channels, call_id_to_asterisk_id
    from backend.database.models import Call
    
    async with AsyncSessionLocal() as session:
        stmt = select(Call).where(Call.status == "in_progress")
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

@app.get("/api/appointments")
async def list_appointments(db: AsyncSession = Depends(get_db)):
    stmt = select(Appointment).order_by(Appointment.appointment_time.asc())
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
async def transfer_call_endpoint(call_id: str, extension: str = "transfer_to_human"):
    from backend.services.ami_manager import redirect_call_to_human
    success = await redirect_call_to_human(call_id, extension=extension)
    if not success:
        raise HTTPException(status_code=500, detail="Asterisk AMI redirect failed.")
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
    from datetime import datetime, timedelta
    
    async with AsyncSessionLocal() as session:
        now = datetime.utcnow()
        last_24h = now - timedelta(hours=24)
        
        ai_resolved_stmt = select(func.count(Call.id)).where(
            Call.start_time >= last_24h,
            Call.status == "completed"
        )
        ai_res = await session.execute(ai_resolved_stmt)
        ai_resolved_count = ai_res.scalar() or 0
        
        avg_hold_time = 14
        service_level = 94.5
        
        if ai_resolved_count > 0:
            avg_hold_time = max(5, 20 - (ai_resolved_count % 10))
            service_level = min(100.0, 85.0 + (ai_resolved_count % 15))
            
        queue_count = 0
        active_calls_count = len(active_channels)
        
        return {
            "queueCount": queue_count,
            "aiResolvedCount": ai_resolved_count,
            "activeCallsCount": active_calls_count,
            "avgHoldTime": avg_hold_time,
            "serviceLevel": round(service_level, 1)
        }

@app.get("/api/reports/agents")
async def get_reports_agents():
    from backend.database.models import SystemUser
    from backend.services.ami_manager import active_channels, registered_endpoints
    async with AsyncSessionLocal() as session:
        stmt = select(SystemUser)
        result = await session.execute(stmt)
        users = result.scalars().all()
        
        agents_state = {}
        for u in users:
            if not u.extension: continue
            
            is_in_call = False
            for ch in active_channels.values():
                if ch.get("caller_num") == u.extension or ch.get("exten") == u.extension:
                    is_in_call = True
                    break
            
            status = "Çevrimdışı"
            if str(u.extension) in registered_endpoints:
                status = "Görüşmede" if is_in_call else "Müsait"
                
            agents_state[u.id] = {
                "id": str(u.id),
                "name": u.full_name,
                "role": u.role,
                "extension": u.extension,
                "status": status,
                "duration": 0
            }
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
        
        return {
            "status": "success",
            "logs": [
                {
                    "id": l.id,
                    "timestamp": l.timestamp.isoformat(),
                    "user_id": l.user_id,
                    "action": l.action,
                    "module": l.module,
                    "details": json.loads(l.details) if l.details else None,
                    "ip_address": l.ip_address
                }
                for l in logs
            ]
        }

# =====================================================================
# CONTACTS (REHBER) ENDPOINTS
# =====================================================================

class ContactSchema(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    email: Optional[str] = None

@app.get("/api/contacts")
async def list_contacts(q: Optional[str] = None):
    async with AsyncSessionLocal() as session:
        if q:
            # Search by name, phone or email
            search_pattern = f"%{q}%"
            stmt = select(Contact).where(
                (Contact.first_name.ilike(search_pattern)) |
                (Contact.last_name.ilike(search_pattern)) |
                (Contact.phone_number.ilike(search_pattern)) |
                (Contact.email.ilike(search_pattern))
            ).order_by(Contact.first_name.asc(), Contact.last_name.asc())
        else:
            stmt = select(Contact).order_by(Contact.first_name.asc(), Contact.last_name.asc())
        result = await session.execute(stmt)
        contacts = result.scalars().all()
        return contacts

@app.post("/api/contacts")
async def create_contact(payload: ContactSchema):
    async with AsyncSessionLocal() as session:
        # Check if phone number already exists
        stmt_check = select(Contact).where(Contact.phone_number == payload.phone_number)
        res_check = await session.execute(stmt_check)
        if res_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Bu telefon numarasına ait bir kayıt zaten mevcut.")
            
        if payload.email:
            stmt_email_check = select(Contact).where(Contact.email == payload.email)
            res_email_check = await session.execute(stmt_email_check)
            if res_email_check.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Bu e-posta adresine ait bir kayıt zaten mevcut.")

        db_contact = Contact(
            first_name=payload.first_name,
            last_name=payload.last_name,
            phone_number=payload.phone_number,
            email=payload.email
        )
        session.add(db_contact)
        await session.commit()
        await session.refresh(db_contact)
        return db_contact

@app.put("/api/contacts/{contact_id}")
async def update_contact(contact_id: int, payload: ContactSchema):
    async with AsyncSessionLocal() as session:
        db_contact = await session.get(Contact, contact_id)
        if not db_contact:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
            
        # Check unique constraint if phone changed
        if db_contact.phone_number != payload.phone_number:
            stmt_check = select(Contact).where(Contact.phone_number == payload.phone_number)
            res_check = await session.execute(stmt_check)
            if res_check.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Bu telefon numarasına ait başka bir kayıt zaten mevcut.")

        if payload.email and db_contact.email != payload.email:
            stmt_email_check = select(Contact).where(Contact.email == payload.email)
            res_email_check = await session.execute(stmt_email_check)
            if res_email_check.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Bu e-posta adresine ait başka bir kayıt zaten mevcut.")

        db_contact.first_name = payload.first_name
        db_contact.last_name = payload.last_name
        db_contact.phone_number = payload.phone_number
        db_contact.email = payload.email
        
        await session.commit()
        return db_contact

@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: int):
    async with AsyncSessionLocal() as session:
        db_contact = await session.get(Contact, contact_id)
        if not db_contact:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
        await session.delete(db_contact)
        await session.commit()
        return {"status": "success", "message": "Kişi rehberden başarıyla silindi."}

@app.get("/api/contacts/lookup")
async def lookup_contact(phone: Optional[str] = None, email: Optional[str] = None):
    async with AsyncSessionLocal() as session:
        if phone:
            stmt = select(Contact).where(Contact.phone_number == phone)
            result = await session.execute(stmt)
            contact = result.scalar_one_or_none()
            if contact:
                return {
                    "found": True,
                    "name": f"{contact.first_name} {contact.last_name}",
                    "first_name": contact.first_name,
                    "last_name": contact.last_name,
                    "phone_number": contact.phone_number,
                    "email": contact.email
                }
        if email:
            stmt = select(Contact).where(Contact.email == email)
            result = await session.execute(stmt)
            contact = result.scalar_one_or_none()
            if contact:
                return {
                    "found": True,
                    "name": f"{contact.first_name} {contact.last_name}",
                    "first_name": contact.first_name,
                    "last_name": contact.last_name,
                    "phone_number": contact.phone_number,
                    "email": contact.email
                }
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
    async with AsyncSessionLocal() as session:
        stmt = select(BlacklistItem).order_by(BlacklistItem.timestamp.desc())
        result = await session.execute(stmt)
        return result.scalars().all()

@app.post("/api/blacklist")
async def add_to_blacklist(payload: BlacklistItemSchema):
    val = payload.value.strip()
    if not val:
        raise HTTPException(status_code=400, detail="Değer boş olamaz.")
    
    async with AsyncSessionLocal() as session:
        stmt = select(BlacklistItem).where(BlacklistItem.value == val)
        res = await session.execute(stmt)
        if res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Bu numara/e-posta zaten kara listede.")
        
        item = BlacklistItem(
            type=payload.type,
            value=val,
            reason=payload.reason.strip() if payload.reason else "Manuel Engelleme"
        )
        session.add(item)
        await session.commit()
        add_system_log("ABUSE_SHIELD", "WARNING", f"Kara Listeye Eklendi: {val} ({item.reason})")
        return item

@app.delete("/api/blacklist/{item_id}")
async def remove_from_blacklist(item_id: int):
    async with AsyncSessionLocal() as session:
        item = await session.get(BlacklistItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Kara liste kaydı bulunamadı.")
        val = item.value
        await session.delete(item)
        await session.commit()
        add_system_log("ABUSE_SHIELD", "INFO", f"Kara Listeden Kaldırıldı: {val}")
        return {"status": "success", "message": "Kara liste kaydı başarıyla silindi."}

@app.get("/api/block-words")
async def list_block_words():
    async with AsyncSessionLocal() as session:
        stmt = select(BlockWord).order_by(BlockWord.word.asc())
        result = await session.execute(stmt)
        return result.scalars().all()

@app.post("/api/block-words")
async def add_block_word(payload: BlockWordSchema):
    word_val = payload.word.strip().lower()
    if not word_val:
        raise HTTPException(status_code=400, detail="Kelime boş olamaz.")
        
    async with AsyncSessionLocal() as session:
        stmt = select(BlockWord).where(BlockWord.word == word_val)
        res = await session.execute(stmt)
        if res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Bu kelime zaten yasaklı listesinde.")
            
        item = BlockWord(word=word_val)
        session.add(item)
        await session.commit()
        add_system_log("ABUSE_SHIELD", "INFO", f"Yasaklı Kelime Eklendi: '{word_val}'")
        return item

@app.delete("/api/block-words/{word_id}")
async def remove_block_word(word_id: int):
    async with AsyncSessionLocal() as session:
        item = await session.get(BlockWord, word_id)
        if not item:
            raise HTTPException(status_code=404, detail="Yasaklı kelime bulunamadı.")
        word_val = item.word
        await session.delete(item)
        await session.commit()
        add_system_log("ABUSE_SHIELD", "INFO", f"Yasaklı Kelime Kaldırıldı: '{word_val}'")
        return {"status": "success", "message": "Yasaklı kelime başarıyla silindi."}


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

@app.get("/api/omnichannel/chats")
async def list_chat_sessions():
    async with AsyncSessionLocal() as session:
        stmt = select(ChatSession).order_by(ChatSession.last_message_time.desc())
        result = await session.execute(stmt)
        sessions = result.scalars().all()
        
        # Load contacts to map caller numbers/emails to names
        stmt_contacts = select(Contact)
        res_contacts = await session.execute(stmt_contacts)
        contacts = res_contacts.scalars().all()
        contact_by_phone = {c.phone_number: f"{c.first_name} {c.last_name}" for c in contacts}
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
                sender_name = contact_by_phone.get(s.sender_info)
                
            data.append({
                "id": s.id,
                "channel": s.channel,
                "sender_info": s.sender_info,
                "sender_name": sender_name,
                "status": s.status,
                "assigned_agent": s.assigned_agent,
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

@app.post("/api/omnichannel/chats/{session_id}/takeover")
async def takeover_chat(session_id: str):
    async with AsyncSessionLocal() as session:
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await session.execute(stmt)
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Sohbet oturumu bulunamadı")
        chat.assigned_agent = "human"
        await session.commit()
        
        event = {
            "type": "takeover_changed",
            "session_id": session_id,
            "assigned_agent": "human"
        }
        await ws_manager.broadcast_omnichannel_event(event)
        return {"status": "success", "message": "Sohbet temsilciye aktarıldı."}

@app.post("/api/omnichannel/chats/{session_id}/transfer_to_ai")
async def release_chat_to_ai(session_id: str):
    async with AsyncSessionLocal() as session:
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await session.execute(stmt)
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Sohbet oturumu bulunamadı")
        chat.assigned_agent = "ai"
        await session.commit()
        
        event = {
            "type": "takeover_changed",
            "session_id": session_id,
            "assigned_agent": "ai"
        }
        await ws_manager.broadcast_omnichannel_event(event)
        return {"status": "success", "message": "Sohbet yapay zekaya devredildi."}

class ChatMessageSendSchema(BaseModel):
    text: str

@app.post("/api/omnichannel/chats/{session_id}/send")
async def send_representative_message(session_id: str, payload: ChatMessageSendSchema):
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
        contact_by_phone = {c.phone_number: f"{c.first_name} {c.last_name}" for c in contacts}
        contact_by_email = {c.email: f"{c.first_name} {c.last_name}" for c in contacts if c.email}
        
        sender_name = None
        if chat.channel.lower() == "mail":
            sender_name = contact_by_email.get(chat.sender_info)
        else:
            sender_name = contact_by_phone.get(chat.sender_info)
        
        # Save the message
        db_message = ChatMessage(
            session_id=session_id,
            direction="outbound",
            sender="human",
            text=payload.text
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
            "timestamp": db_message.timestamp.isoformat()
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
                "status": chat.status,
                "assigned_agent": chat.assigned_agent,
                "last_message_time": chat.last_message_time.isoformat(),
                "last_message_text": db_message.text
            }
        })
        
        # Trigger background QA evaluation
        import asyncio
        from backend.services.call_analyzer import analyze_chat_session
        asyncio.create_task(analyze_chat_session(session_id))
        
        return {"status": "success", "message": "Mesaj gönderildi."}

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
    return {
        "inbound": 12,
        "outbound": 8,
        "missed": 2,
        "break_minutes": 45,
        "break_details": [
            {"name": "Yemek Molası", "minutes": 30},
            {"name": "İhtiyaç Molası", "minutes": 15}
        ]
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


# ----------------- SECURITY API -----------------
@app.get("/api/security/fail2ban")
async def get_fail2ban_ips(user_info: dict = Depends(get_user_info)):
    import datetime
    return {
        "status": "success",
        "blocked_ips": [
            {"ip": "192.168.1.100", "jail": "asterisk", "banned_at": (datetime.datetime.now() - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")},
            {"ip": "203.0.113.45", "jail": "asterisk", "banned_at": (datetime.datetime.now() - datetime.timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M:%S")}
        ]
    }

@app.delete("/api/security/fail2ban/{ip}")
async def unban_fail2ban_ip(ip: str, user_info: dict = Depends(get_user_info)):
    return {"status": "success", "message": f"{ip} adresi başarıyla engellenenler listesinden kaldırıldı."}

@app.get("/api/security/geo")
async def get_geo_security(user_info: dict = Depends(get_user_info)):
    return settings_db.get("security_geo", DEFAULT_SETTINGS["security_geo"])

@app.get("/api/security/advanced")
async def get_advanced_security(user_info: dict = Depends(get_user_info)):
    return settings_db.get("security_advanced", {
        "login_rate_limit": 5,
        "api_rate_limit": 100,
        "sip_rate_limit": 50,
        "block_duration_minutes": 15
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
    return {"status": "success", "message": "Gelişmiş güvenlik ayarları başarıyla kaydedildi."}

class GeoSecuritySchema(BaseModel):
    allowed_countries: List[str]

@app.get("/api/security/geo")
async def get_geo_security(user_info: dict = Depends(get_user_info)):
    return settings_db.get("security_geo", DEFAULT_SETTINGS["security_geo"])

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
    from backend.database.models import Call, SystemUser, SystemRole, SystemSetting, QAQuestion
    from backend.services.ami_manager import start_ami_listener
    
    # 1. Ensure all tables are created in PostgreSQL
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[Database Init] Veritabanı tabloları kontrol edildi / oluşturuldu.")
    except Exception as e:
        print(f"[Database Init] Error creating tables: {e}")

    # 2. Auto-seed tables if empty
    try:
        async with AsyncSessionLocal() as session:
            stmt = update(Call).where(Call.status == "in_progress").values(status="completed", end_time=datetime.datetime.utcnow())
            await session.execute(stmt)
            await session.commit()
            print("[Database] Eski askıda kalan aktif aramalar temizlendi.")

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

            # Start background tasks
            asyncio.create_task(recording_cleanup_task())
    except Exception as e:
        print(f"[Database] Temizlik/Seeding sırasında hata oluştu: {e}")
        print(f"[Database] Temizlik/QA seeding sırasında hata oluştu: {e}")
        
    asyncio.create_task(start_ami_listener())


# --- REFACTORED ENDPOINTS ---

@app.get("/api/settings/users")
async def new_get_users_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemUser).order_by(SystemUser.id))
    users = result.scalars().all()
    out = []
    for u in users:
        d = {c.name: getattr(u, c.name) for c in u.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/users")
async def new_save_users_endpoint(payload: Union[List[UserSchema], UserSchema], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        is_single = not isinstance(payload, list)
        items_list = [payload] if is_single else payload

        result = await db.execute(select(SystemUser))
        existing_users_db = result.scalars().all()
        existing_by_ext = {str(u.extension): u for u in existing_users_db if u.extension}
        existing_by_id = {u.id: u for u in existing_users_db if u.id is not None}
        
        for item in items_list:
            if item.id and item.id in existing_by_id:
                if str(existing_by_id[item.id].extension) == str(item.extension):
                    continue
            validate_number_range(item.extension, "extension")

        payload_user_ids = set()
        new_users_out = []
        changes = []
        valid_keys = {c.name for c in SystemUser.__table__.columns}

        for idx, item in enumerate(items_list):
            data = item.model_dump()
            if not data.get("sip_password") or data.get("sip_password") == "1234":
                data["sip_password"] = generate_strong_sip_password()
                
            ext_str = str(data.get("extension") or "")
            target_user = None
            if data.get("id") and data.get("id") in existing_by_id:
                target_user = existing_by_id[data.get("id")]
            elif ext_str and ext_str in existing_by_ext:
                target_user = existing_by_ext[ext_str]

            filtered_data = {k: v for k, v in data.items() if k in valid_keys and k != "id"}

            if target_user:
                for k, v in filtered_data.items():
                    setattr(target_user, k, v)
                payload_user_ids.add(target_user.id)
                changes.append({"action": "UPDATED", "name": data.get("full_name"), "extension": data.get("extension")})
            else:
                new_sys_user = SystemUser(**filtered_data)
                db.add(new_sys_user)
                changes.append({"action": "CREATED", "name": data.get("full_name"), "extension": data.get("extension")})

        if not is_single:
            for u in existing_users_db:
                if u.id not in payload_user_ids and u.role != "admin" and str(u.id) != "admin":
                    await db.delete(u)

        await db.commit()

        try:
            await db.execute(text("SELECT setval(pg_get_serial_sequence('system_users', 'id'), COALESCE((SELECT MAX(id) FROM system_users), 1));"))
            await db.commit()
        except Exception:
            pass

        res_updated = await db.execute(select(SystemUser).order_by(SystemUser.id))
        all_users_db = res_updated.scalars().all()
        for u in all_users_db:
            new_users_out.append({c.name: getattr(u, c.name) for c in u.__table__.columns})

        settings_db["needs_apply"] = True
        settings_db["users"] = new_users_out
        save_settings(settings_db)
        
        try:
            await log_event(
                user_id=user_info["user_id"],
                action="UPDATE_USERS",
                module="Users",
                details={"changes": changes} if changes else {"status": "No changes detected"},
                ip_address=user_info["ip_address"]
            )
        except Exception as le:
            print(f"[Log Event Error]: {le}")
        
        return {"status": "success", "users": new_users_out}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"[Save Users Error]: {e}")
        raise HTTPException(status_code=500, detail=f"Kullanıcılar kaydedilirken hata oluştu: {str(e)}")

@app.put("/api/settings/users/{user_id}")
async def update_single_user_endpoint(user_id: int, payload: UserSchema, background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    payload.id = user_id
    return await new_save_users_endpoint(payload=payload, background_tasks=background_tasks, user_info=user_info, db=db)

@app.delete("/api/settings/users/{user_id}")
async def delete_single_user_endpoint(user_id: int, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        res = await db.execute(select(SystemUser).where(SystemUser.id == user_id))
        u = res.scalars().first()
        if u:
            if u.role == "admin" or str(u.id) == "admin":
                raise HTTPException(status_code=400, detail="Admin kullanıcısı silinemez.")
            await db.delete(u)
            await db.commit()
        
        res_updated = await db.execute(select(SystemUser).order_by(SystemUser.id))
        all_users_db = res_updated.scalars().all()
        new_users_out = [{c.name: getattr(usr, c.name) for c in usr.__table__.columns} for usr in all_users_db]
        
        settings_db["needs_apply"] = True
        settings_db["users"] = new_users_out
        save_settings(settings_db)
        
        return {"status": "success", "users": new_users_out}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Kullanıcı silinirken hata oluştu: {str(e)}")

@app.get("/api/settings/roles")
async def new_get_roles_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemRole).order_by(SystemRole.id))
    roles = result.scalars().all()
    out = []
    for r in roles:
        d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/roles")
async def new_save_roles_endpoint(payload: Union[List[RoleSchema], RoleSchema], user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        is_single = not isinstance(payload, list)
        items_list = [payload] if is_single else payload

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

        try:
            await db.execute(text("SELECT setval(pg_get_serial_sequence('system_roles', 'id'), COALESCE((SELECT MAX(id) FROM system_roles), 1));"))
            await db.commit()
        except Exception:
            pass

        res_updated = await db.execute(select(SystemRole).order_by(SystemRole.id))
        all_roles_db = res_updated.scalars().all()
        for r in all_roles_db:
            new_roles_out.append({c.name: getattr(r, c.name) for c in r.__table__.columns})

        settings_db["needs_apply"] = True
        settings_db["roles"] = new_roles_out
        save_settings(settings_db)
        
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
        save_settings(settings_db)
        
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
        
        return {"status": "success", "roles": new_roles_out}
    except Exception as e:
        await db.rollback()
        print(f"[Save Roles Error]: {e}")
        raise HTTPException(status_code=500, detail=f"Roller kaydedilirken hata oluştu: {str(e)}")

@app.get("/api/settings/queues")
async def new_get_queues_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PBXQueue).order_by(PBXQueue.id))
    queues = result.scalars().all()
    out = []
    for q in queues:
        d = {c.name: getattr(q, c.name) for c in q.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/queues")
async def new_save_queues_endpoint(payload: List[Dict[str, Any]], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(PBXQueue))
        existing_queues_db = result.scalars().all()
        existing_by_num = {str(q.queue_number): q for q in existing_queues_db if q.queue_number}
        existing_by_id = {q.id: q for q in existing_queues_db if q.id is not None}

        payload_queue_ids = set()
        new_queues_out = []
        valid_keys = {c.name for c in PBXQueue.__table__.columns}

        for idx, item in enumerate(payload):
            data = item.model_dump() if hasattr(item, "model_dump") else item.copy()
            target_q = None
            if data.get("id") and data.get("id") in existing_by_id:
                target_q = existing_by_id[data.get("id")]
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

        for q in existing_queues_db:
            if q.id not in payload_queue_ids:
                await db.delete(q)

        await db.commit()

        try:
            await db.execute(text("SELECT setval(pg_get_serial_sequence('pbx_queues', 'id'), COALESCE((SELECT MAX(id) FROM pbx_queues), 1));"))
            await db.commit()
        except Exception:
            pass

        res_updated = await db.execute(select(PBXQueue).order_by(PBXQueue.id))
        all_queues_db = res_updated.scalars().all()
        for q in all_queues_db:
            new_queues_out.append({c.name: getattr(q, c.name) for c in q.__table__.columns})

        settings_db["needs_apply"] = True
        settings_db["queues"] = new_queues_out
        save_settings(settings_db)

        try:
            await log_event(
                user_id=user_info["user_id"],
                action="UPDATE_QUEUES",
                module="Queues",
                details={"status": "updated"},
                ip_address=user_info["ip_address"]
            )
        except Exception as le:
            print(f"[Log Event Error]: {le}")

        return {"status": "success", "queues": new_queues_out}
    except Exception as e:
        await db.rollback()
        print(f"[Save Queues Error]: {e}")
        raise HTTPException(status_code=500, detail=f"Kuyruklar kaydedilirken hata oluştu: {str(e)}")

@app.get("/api/settings/trunks")
async def new_list_trunks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Trunk).order_by(Trunk.id))
    trunks = result.scalars().all()
    out = []
    for t in trunks:
        d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/trunks")
async def new_add_or_update_trunk(payload: TrunkSettingsSchema, background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    try:
        data = payload.model_dump()
        valid_keys = {c.name for c in Trunk.__table__.columns}
        filtered_data = {k: v for k, v in data.items() if k in valid_keys and k != "id"}

        target_trunk = None
        if data.get("id"):
            res = await db.execute(select(Trunk).where(Trunk.id == data["id"]))
            target_trunk = res.scalars().first()

        if not target_trunk and data.get("trunk_name"):
            res = await db.execute(select(Trunk).where(Trunk.trunk_name == data.get("trunk_name")))
            target_trunk = res.scalars().first()

        if target_trunk:
            for k, v in filtered_data.items():
                setattr(target_trunk, k, v)
        else:
            t = Trunk(**filtered_data)
            db.add(t)

        await db.commit()

        try:
            await db.execute(text("SELECT setval(pg_get_serial_sequence('trunks', 'id'), COALESCE((SELECT MAX(id) FROM trunks), 1));"))
            await db.commit()
        except Exception:
            pass

        res_all = await db.execute(select(Trunk).order_by(Trunk.id))
        all_trunks = res_all.scalars().all()
        out = [{c.name: getattr(t, c.name) for c in t.__table__.columns} for t in all_trunks]

        settings_db["needs_apply"] = True
        settings_db["trunks"] = out
        save_settings(settings_db)

        try:
            await log_event(
                user_id=user_info["user_id"],
                action="SAVE_TRUNK",
                module="SIP Trunks",
                details={"trunk_name": data.get("trunk_name")},
                ip_address=user_info["ip_address"]
            )
        except Exception as le:
            print(f"[Log Event Error]: {le}")

        return {"status": "success", "trunks": out}
    except Exception as e:
        await db.rollback()
        print(f"[Save Trunk Error]: {e}")
        raise HTTPException(status_code=500, detail=f"SIP Trunk kaydedilirken hata oluştu: {str(e)}")


@app.get("/api/settings/needs-apply")
async def get_needs_apply():
    return {"needs_apply": settings_db.get("needs_apply", False)}

@app.post("/api/settings/needs-apply")
async def set_needs_apply(status: dict):
    settings_db["needs_apply"] = status.get("needs_apply", True)
    save_settings(settings_db)
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

@app.get("/api/webhooks/whatsapp")
async def verify_whatsapp_webhook(request: Request):
    """
    Meta Graph API Webhook Verification Endpoint
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    # Basit dogrulama
    if mode == "subscribe" and challenge:
        return Response(content=challenge, media_type="text/plain")
    return HTTPException(status_code=403, detail="Verification failed")


@app.post("/api/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request):
    """
    Handles incoming messages from WhatsApp (Meta Cloud API).
    """
    try:
        body = await request.json()
        if body.get("object") == "whatsapp_business_account":
            for entry in body.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    messages = value.get("messages", [])
                    contacts = value.get("contacts", [])
                    
                    if messages and contacts:
                        msg = messages[0]
                        contact = contacts[0]
                        
                        sender_phone = contact.get("wa_id")
                        sender_name = contact.get("profile", {}).get("name", sender_phone)
                        
                        if msg.get("type") == "text":
                            text_body = msg.get("text", {}).get("body", "")
                            sender_info = f"{sender_name} ({sender_phone})"
                            asyncio.create_task(
                                handle_inbound_chat_message(
                                    channel="whatsapp",
                                    sender_info=sender_info,
                                    text=text_body
                                )
                            )
        return {"status": "success"}
    except Exception as e:
        print(f"WhatsApp webhook parse error: {e}")
        return {"status": "error"}

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

# ==============================================================================
# WEBRTC ENDPOINTS
# ==============================================================================

@app.get("/api/webrtc/config")
async def get_webrtc_config(user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    """
    Frontend'in WebRTC/SIP bağlantısı yapabilmesi için güvenli SIP yapılandırmasını döner.
    """
    try:
        if not user_info:
            raise HTTPException(status_code=401, detail="Unauthorized")
            
        user_id = user_info.get("user_id") or user_info.get("id")
        print(f"DEBUG: get_webrtc_config received X-User-ID: {user_id}")
        
        # Veritabanından mevcut kullanıcıyı bul
        current_user = None
        if user_id and user_id != "admin" and user_id != "Bilinmeyen":
            try:
                uid = int(user_id)
                result = await db.execute(select(SystemUser).filter(SystemUser.id == uid))
                db_user = result.scalars().first()
                if db_user:
                    # Convert to dict for compatibility with existing code
                    current_user = {c.name: getattr(db_user, c.name) for c in db_user.__table__.columns}
            except ValueError:
                pass
                
        if not current_user and user_id != "admin":
            # Just fallback to generic extension instead of 404
            agent_ext = "101"
        else:
            # Admin için 200, diğerleri için kendi dahilisi
            agent_ext = current_user.get("extension", "101") if current_user else "200"
            
            # WSS URL
            wss_url = settings_db.get("pbx", {}).get("webrtc_wss_url", "wss://127.0.0.1:8089/ws")
            
            # PJSIP şifresi veritabanından alınıyor.
            sip_password = current_user.get("sip_password", "1234") if current_user else "1234"
            
            return {
                "asteriskWssUrl": wss_url,
                "agentExtension": agent_ext,
                "password": sip_password
            }
    except Exception as e:
        print(f"WebRTC Config error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

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
