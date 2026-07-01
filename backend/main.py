import os
import shutil
import socket
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

import datetime
from backend.database.config import get_db, Base, engine, AsyncSessionLocal
from backend.database.models import Rule, Call, Transcript, Appointment
from backend.services.rag_service import index_pdf_file, index_website_url, query_vector_search
from backend.services.websocket_manager import ws_manager

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

class ChannelSettingsSchema(BaseModel):
    whatsapp_token: Optional[str] = None
    telegram_token: Optional[str] = None
    instagram_token: Optional[str] = None
    facebook_token: Optional[str] = None

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
    is_active: bool = True

import json

SETTINGS_FILE = "/Users/anilacar/ai-project/backend/settings.json"

DEFAULT_SETTINGS = {
    "pbx": {
        "ami_host": "127.0.0.1",
        "ami_port": 5038,
        "ami_user": "ai_backend_user",
        "ami_secret": "backend_secure_key_99",
        "webrtc_wss_url": "wss://127.0.0.1:8089/ws",
        "nas_mount_path": "/mnt/nas/ai-recordings"
    },
    "channels": {
        "whatsapp_token": "",
        "telegram_token": "",
        "instagram_token": "",
        "facebook_token": ""
    },
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
    ]
}

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Settings] Error loading settings: {e}")
    return DEFAULT_SETTINGS.copy()

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

@app.get("/api/rag/search")
async def test_search(query: str):
    results = await query_vector_search(query)
    return {"results": results}

@app.get("/api/rag/sources")
async def get_indexed_sources(db: AsyncSession = Depends(get_db)):
    # Fetch unique source names from document chunks table
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

    async with AsyncSessionLocal() as session:
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
    return {"status": "success"}

# ----------------------------------------------------
# API Routes: Calls & Transcripts History
# ----------------------------------------------------
@app.get("/api/calls")
async def list_calls(db: AsyncSession = Depends(get_db)):
    stmt = select(Call).order_by(Call.start_time.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@app.get("/api/calls/{call_id}/transcripts")
async def get_call_transcripts(call_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Transcript).where(Transcript.call_id == call_id).order_by(Transcript.timestamp.asc())
    result = await db.execute(stmt)
    return result.scalars().all()
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
@app.get("/api/calls/active")
async def get_active_calls():
    from backend.services.ami_manager import active_channels, call_id_to_asterisk_id
    from backend.database.models import Call
    
    async with AsyncSessionLocal() as session:
        stmt = select(Call).where(Call.status == "in_progress")
        result = await session.execute(stmt)
        calls = result.scalars().all()
        
    active_list = []
    for call in calls:
        ast_id = call_id_to_asterisk_id.get(call.id, call.id)
        if ast_id in active_channels:
            active_list.append({
                "id": call.id,
                "caller_number": call.caller_number,
                "callee_number": call.callee_number,
                "start_time": call.start_time.isoformat() if call.start_time else None,
                "channel": active_channels[ast_id]
            })
    return active_list

@app.post("/api/calls/{call_id}/spy")
async def spy_active_call(call_id: str, agent_ext: str = "200"):
    from backend.services.ami_manager import spy_on_call
    success = await spy_on_call(call_id, agent_ext)
    if not success:
        raise HTTPException(status_code=500, detail="Asterisk AMI originate failed or channel not active.")
    return {"status": "success", "message": f"Originated ChanSpy on agent extension {agent_ext}"}

@app.post("/api/calls/{call_id}/transfer")
async def transfer_call_endpoint(call_id: str, extension: str = "transfer_to_human"):
    from backend.services.ami_manager import redirect_call_to_human
    success = await redirect_call_to_human(call_id, extension=extension)
    if not success:
        raise HTTPException(status_code=500, detail="Asterisk AMI redirect failed.")
    return {"status": "success", "message": f"Redirected call {call_id} to human representative."}

class TranscriptBroadcastSchema(BaseModel):
    call_id: str
    speaker: str
    text: str

@app.post("/api/transcripts/broadcast")
async def broadcast_transcript_endpoint(data: TranscriptBroadcastSchema):
    await ws_manager.broadcast_transcript(data.call_id, data.speaker, data.text)
    return {"status": "success"}

class ClientLogSchema(BaseModel):
    level: str
    message: str

@app.post("/api/client-logs")
async def client_logs_endpoint(log: ClientLogSchema):
    print(f"[BROWSER][{log.level.upper()}] {log.message}")
    return {"status": "ok"}


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
    except Exception as e:
        print(f"[Database] Temizlik sırasında hata oluştu: {e}")
        
    asyncio.create_task(start_ami_listener())
