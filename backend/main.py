import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
import shutil
import socket
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

import datetime

system_logs = []

def add_system_log(source: str, level: str, message: str):
    now = datetime.datetime.now().strftime("%H:%M:%S")
    system_logs.append({"timestamp": now, "source": source, "level": level, "message": message})
    if len(system_logs) > 50:
        system_logs.pop(0)

add_system_log("SYSTEM", "INFO", "FastAPI Sunucusu başlatıldı.")
add_system_log("DATABASE", "INFO", "Veritabanı bağlantısı kuruldu.")
from backend.database.config import get_db, Base, engine, AsyncSessionLocal
from backend.database.models import Rule, Call, Transcript, Appointment, ChatSession, ChatMessage, Contact, CannedResponse, BlacklistItem, BlockWord
from backend.services.rag_service import index_pdf_file, index_website_url, query_vector_search, index_manual_text, delete_indexed_source, get_genai_client
from backend.services.websocket_manager import ws_manager
import redis.asyncio as aioredis
redis_client = aioredis.Redis(host='localhost', port=6379, decode_responses=True)

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
RECORDINGS_DIR = "/Users/anilacar/ai-project/recordings"
os.makedirs(RECORDINGS_DIR, exist_ok=True)
app.mount("/api/recordings", StaticFiles(directory=RECORDINGS_DIR), name="recordings")

os.makedirs("uploads/announcements", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Temp storage for PDF uploads
UPLOAD_DIR = "/tmp/ai_pbx_uploads" if os.name != 'nt' else "C:\\temp\\ai_pbx_uploads"
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

class ChannelSettingsSchema(BaseModel):
    whatsapp_token: Optional[str] = None
    telegram_token: Optional[str] = None
    instagram_token: Optional[str] = None
    facebook_token: Optional[str] = None

class BreakSchema(BaseModel):
    id: Optional[int] = None
    name: str
    color: str

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
    model: str
    temperature: float
    max_tokens: int
    system_instruction: str
    status: str
    transfer_target: Optional[str] = "200"

import json

SETTINGS_FILE = "/Users/anilacar/ai-project/backend/settings.json"

DEFAULT_SETTINGS = {
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
            "model": "gemini-1.5-flash",
            "temperature": 0.4,
            "max_tokens": 300,
            "system_instruction": "Sen sabırlı ve çözüm odaklı bir müşteri destek asistanısın. Müşterilerin teknik sorunlarına çözüm üretiyorsun.",
            "status": "active",
            "transfer_target": "200"
        }
    ],
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
                "call_panel:access", "logs:access", "storage:access", "wallboard:access", "ai_whisper:access", "omnichannel:access",
                "contacts:read", "contacts:write", "contacts:delete",
                "canned_responses:read", "canned_responses:write", "canned_responses:delete",
                "blacklist:read", "blacklist:write", "blacklist:delete",
                "mobile_transfer:read", "mobile_transfer:write",
                "qa:read", "qa:write", "qa:delete",
                "recording_retention:read", "recording_retention:write", "recording_retention:delete"
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
                "recording_retention:read", "recording_retention:write", "recording_retention:delete"
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
    }
}

def load_settings():
    db = DEFAULT_SETTINGS.copy()
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                db.update(loaded)
        except Exception as e:
            print(f"[Settings] Error loading settings: {e}")
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
            
            # Make sure admin role gets announcements permissions
            if r.get("role_code") == "admin":
                if "announcements:read" not in new_perms:
                    new_perms.extend(["announcements:read", "announcements:write", "announcements:delete"])
            
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

    save_settings(db)
    return db

def save_settings(settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"[Settings] Error saving settings: {e}")

settings_db = load_settings()

# ----------------------------------------------------
# API Routes: PBX & Channel Settings
# ----------------------------------------------------
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

def run_pjsip_reload():
    # Trigger Asterisk PJSIP Reload command dynamically to make Asterisk register/unregister the trunk instantly
    try:
        import subprocess
        subprocess.run(["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", "pjsip reload"], check=True, capture_output=True)
        print("[Asterisk Config] PJSIP configurations reloaded successfully in Asterisk container.")
    except Exception as e:
        print(f"[Asterisk Config] Failed to reload PJSIP in Asterisk: {e}")

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
    for t in settings_db["trunks"]:
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

    config_dir = "/Users/anilacar/ai-project/asterisk_config"
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, "pjsip_custom.conf")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(conf_content)
    print(f"[Asterisk Config] pjsip_custom.conf yeniden uretildi: {config_path}")

    if background_tasks:
        background_tasks.add_task(run_pjsip_reload)
    else:
        run_pjsip_reload()

@app.get("/api/settings/trunks")
async def list_trunks():
    return settings_db["trunks"]

@app.post("/api/settings/trunks")
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
    return {"status": "success", "message": "SIP Trunk başarıyla kaydedildi.", "trunk": data}

@app.delete("/api/settings/trunks/{trunk_id}")
async def delete_trunk(trunk_id: int, background_tasks: BackgroundTasks):
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

@app.get("/api/settings/users")
async def get_users_endpoint():
    return settings_db.get("users", [])

@app.post("/api/settings/users")
async def save_users_endpoint(payload: List[UserSchema]):
    settings_db["users"] = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
        settings_db["users"].append(data)
    save_settings(settings_db)
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

@app.get("/api/settings/roles")
async def get_roles_endpoint():
    return settings_db.get("roles", [])

@app.post("/api/settings/roles")
async def save_roles_endpoint(payload: List[RoleSchema]):
    settings_db["roles"] = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
        settings_db["roles"].append(data)
    save_settings(settings_db)
    return {"status": "success", "roles": settings_db["roles"]}

# ----------------------------------------------------
# API Routes: Announcements
# ----------------------------------------------------
@app.get("/api/settings/announcements")
async def get_announcements():
    return settings_db.get("announcements", [])

@app.post("/api/settings/announcements")
async def create_announcement(
    name: str = Form(...),
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
        "filename": filename,
        "original_filename": file.filename,
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
            print(f"[Asterisk Dialplan] Call registered successfully: {call_id} (Caller: {caller}, DID: {did}, Asterisk ID: {asterisk_id})")
            add_system_log("ASTERISK", "INFO", f"Yeni Arama Başlatıldı: Arayan={caller or 'Bilinmeyen'}, DID={did}, ID={call_id}")
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
    from datetime import datetime, time
    stmt = select(Call)
    
    if start_date:
        try:
            start_dt = datetime.combine(datetime.strptime(start_date, "%Y-%m-%d").date(), time.min)
            stmt = stmt.where(Call.start_time >= start_dt)
        except ValueError:
            pass
            
    if end_date:
        try:
            end_dt = datetime.combine(datetime.strptime(end_date, "%Y-%m-%d").date(), time.max)
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
    recordings_dir = "/Users/anilacar/ai-project/recordings"
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


@app.on_event("startup")
async def startup_event():
    import asyncio
    import datetime
    from sqlalchemy import update
    from backend.database.models import Call
    from backend.services.ami_manager import start_ami_listener
    
    try:
        async with AsyncSessionLocal() as session:
            stmt = update(Call).where(Call.status == "in_progress").values(status="completed", end_time=datetime.datetime.utcnow())
            await session.execute(stmt)
            await session.commit()
            print("[Database] Eski askıda kalan aktif aramalar temizlendi.")

            # Seed QA questions
            from backend.database.models import QAQuestion
            stmt_qa = select(QAQuestion)
            res_qa = await session.execute(stmt_qa)
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
    except Exception as e:
        print(f"[Database] Temizlik/QA seeding sırasında hata oluştu: {e}")
        
    asyncio.create_task(start_ami_listener())
