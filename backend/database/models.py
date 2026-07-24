import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Float
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from backend.database.config import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, index=True)  # e.g. "tenant-default", "tenant-acme"
    name = Column(String, nullable=False)
    code = Column(String, nullable=False, unique=True, index=True)
    status = Column(String, default="active")  # active, passive
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    license_expires_at = Column(DateTime, nullable=True)  # Expiration date for automatic passive locking
    license_key = Column(String, nullable=True)  # Cryptographic or unique license key code e.g. AIDA-9812-7634
    plan_tier = Column(String, default="professional")  # trial, starter, professional, enterprise
    
    # 1. Yapay Zeka Kotaları
    max_agents = Column(Integer, default=20)
    max_rag_docs = Column(Integer, default=100)
    max_scenarios = Column(Integer, default=20)
    
    # 2. Santral Kotaları
    max_users = Column(Integer, default=50)
    max_announcements = Column(Integer, default=20)
    max_queues = Column(Integer, default=10)
    max_inbound_rules = Column(Integer, default=25)
    max_outbound_rules = Column(Integer, default=25)
    max_pickup_groups = Column(Integer, default=10)
    max_subscriber_groups = Column(Integer, default=10)
    max_phonebook_contacts = Column(Integer, default=500)
    max_trunks = Column(Integer, default=5)
    max_conference_rooms = Column(Integer, default=5)
    max_speed_dials = Column(Integer, default=50)
    max_blacklist_entries = Column(Integer, default=100)
    max_locations = Column(Integer, default=5)
    max_departments = Column(Integer, default=10)
    
    # 3. Çağrı Yönlendirme & Akış Kotaları
    max_call_flows = Column(Integer, default=10)
    max_dialers = Column(Integer, default=5)


class Call(Base):
    __tablename__ = "calls"

    id = Column(String, primary_key=True, index=True)  # Asterisk Unique ID
    tenant_id = Column(String, default="tenant-default", index=True)
    caller_number = Column(String, nullable=False)
    callee_number = Column(String, nullable=False)
    status = Column(String, default="in_progress")  # in_progress, completed, transferred
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    recording_path = Column(String, nullable=True)  # Path to local NAS file
    summary = Column(Text, nullable=True)
    agent_topic = Column(String, nullable=True)
    agent_notes = Column(Text, nullable=True)
    sentiment = Column(String, nullable=True)
    qa_score = Column(Integer, nullable=True)
    qa_report = Column(Text, nullable=True)
    hangup_source = Column(String, nullable=True)

    transcripts = relationship("Transcript", back_populates="call", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="call")


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    call_id = Column(String, ForeignKey("calls.id"), nullable=False)
    speaker = Column(String, nullable=False)  # customer, ai, human
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    call = relationship("Call", back_populates="transcripts")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String, default="tenant-default", index=True)
    rule_type = Column(String, nullable=False)  # faq, routing, prompt
    trigger_keyword = Column(String, nullable=True)  # triggers if keyword matched
    response_text = Column(Text, nullable=True)
    action_to_trigger = Column(String, nullable=True)  # transfer_to_human, book_appointment
    is_active = Column(Boolean, default=True)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String, default="tenant-default", index=True)
    call_id = Column(String, ForeignKey("calls.id"), nullable=True)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_email = Column(String, nullable=True)
    appointment_time = Column(DateTime, nullable=False)
    status = Column(String, default="confirmed")  # confirmed, cancelled
    notes = Column(Text, nullable=True)

    call = relationship("Call", back_populates="appointments")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String, default="tenant-default", index=True)
    filename = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=False)  # Gemini Text Embedding Dimension is 768


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)  # UUID string
    tenant_id = Column(String, default="tenant-default", index=True)
    channel = Column(String, nullable=False)  # whatsapp, instagram, telegram, facebook, mail
    sender_info = Column(String, nullable=False)  # Phone number, username, or email
    status = Column(String, default="active")  # active, closed
    assigned_agent = Column(String, default="ai")  # ai, human
    last_message_time = Column(DateTime, default=datetime.datetime.utcnow)
    qa_score = Column(Integer, nullable=True)
    qa_report = Column(Text, nullable=True)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False)
    direction = Column(String, nullable=False)  # inbound, outbound
    sender = Column(String, nullable=False)  # customer, ai, human
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

class InternalChatMessage(Base):
    __tablename__ = "internal_chat_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sender_id = Column(String, nullable=False, index=True) # extension or username
    receiver_id = Column(String, nullable=False, index=True) # extension, username or 'broadcast'
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False, unique=True, index=True)
    email = Column(String, nullable=True, unique=True, index=True)
    voiceprint = Column(Text, nullable=True)


class CannedResponse(Base):
    __tablename__ = "canned_responses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    shortcut = Column(String, nullable=False, unique=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)


class BlacklistItem(Base):
    __tablename__ = "blacklist_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    type = Column(String, nullable=False)  # phone or email
    value = Column(String, nullable=False, unique=True, index=True)
    reason = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class BlockWord(Base):
    __tablename__ = "block_words"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    word = Column(String, nullable=False, unique=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class QAQuestion(Base):
    __tablename__ = "qa_questions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question = Column(String, nullable=False)
    max_score = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)


class EventLog(Base):
    __tablename__ = "event_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(String, nullable=True)  # Who did the action
    action = Column(String, nullable=False)  # e.g., UPDATE_USER, DELETE_QUEUE
    module = Column(String, nullable=False)  # e.g., Users, Queues, System
    details = Column(Text, nullable=True)    # JSON string of the changes
    ip_address = Column(String, nullable=True)

class SystemSetting(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(JSON, nullable=False)

class SystemUser(Base):
    __tablename__ = "system_users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String, default="tenant-default", index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    extension = Column(String, nullable=False, unique=True)
    avatar = Column(String, nullable=True)
    role = Column(String, nullable=False, default="agent")
    is_active = Column(Boolean, default=True)
    gsm_number = Column(String, nullable=True)
    mobile_transfer_enabled = Column(Boolean, default=False)
    theme_color = Column(String, default="rose")
    password = Column(String, nullable=True)
    sip_password = Column(String, nullable=True)
    outbound_caller_id = Column(String, nullable=True)
    forwarding_always = Column(JSON, nullable=True)
    forwarding_busy = Column(JSON, nullable=True)
    forwarding_no_answer = Column(JSON, nullable=True)
    voicemail_active = Column(Boolean, default=False)
    voicemail_announcement = Column(String, nullable=True)
    voicemail_pin = Column(String, nullable=True)
    voicemail_to_email = Column(Boolean, default=False)
    recording_active = Column(Boolean, default=False)
    transport = Column(String, default="UDP")
    active_sessions = Column(JSON, default=list)
    location_id = Column(String, nullable=True)
    department_id = Column(String, nullable=True)

class SystemRole(Base):
    __tablename__ = "system_roles"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    role_code = Column(String, nullable=False, unique=True)
    name = Column(String, nullable=False)
    permissions = Column(JSON, default=list)
    allowed_breaks = Column(JSON, default=list)

class Trunk(Base):
    __tablename__ = "trunks"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String, default="tenant-default", index=True)
    trunk_type = Column(String, nullable=False) # register, peer
    trunk_name = Column(String, nullable=False)
    host = Column(String, nullable=False)
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)
    port = Column(Integer, default=5060)
    did_number = Column(String, nullable=False)
    protocol = Column(String, default="udp")
    greeting_prompt = Column(String, nullable=True)
    transfer_target_type = Column(String, default="extension")
    transfer_target = Column(String, nullable=False)
    codec = Column(String, default="G711")
    is_active = Column(Boolean, default=True)

class PBXQueue(Base):
    __tablename__ = "pbx_queues"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String, default="tenant-default", index=True)
    extension = Column(String)
    name = Column(String, nullable=False)
    strategy = Column(String, default="ringall")
    timeout = Column(Integer, default=15)
    wrapuptime = Column(Integer, default=0)
    maxlen = Column(Integer, default=0)
    joinempty = Column(String, default="yes")
    leavewhenempty = Column(String, default="no")
    ringinuse = Column(String, default="no")
    queueMembers = Column(JSON, default=list)
    supervisors = Column(JSON, default=list)
    
    # Missing frontend fields
    max_calls = Column(Integer, default=0)
    ring_time = Column(Integer, default=15)
    acw_time = Column(Integer, default=5)
    join_announcement_enabled = Column(Boolean, default=False)
    join_announcement = Column(String, nullable=True)
    periodic_announcement_enabled = Column(Boolean, default=False)
    periodic_announcement = Column(String, nullable=True)
    hold_music_class = Column(String, default="default")
    position_announcement_enabled = Column(Boolean, default=False)
    position_announcement_interval = Column(Integer, default=60)
    estimated_hold_time_enabled = Column(Boolean, default=False)
    estimated_hold_time_interval = Column(Integer, default=60)
    ivr_routes = Column(JSON, default=dict)
    notify_missed_calls = Column(Boolean, default=False)

class AIAgent(Base):
    __tablename__ = "ai_agents"
    id = Column(String, primary_key=True, index=True) # UUID or string ID
    tenant_id = Column(String, default="tenant-default", index=True)
    name = Column(String, nullable=False)
    voice = Column(String, nullable=False)
    tone = Column(String, nullable=False)
    model = Column(String, nullable=False)
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=300)
    system_instruction = Column(Text, nullable=False)
    status = Column(String, default="active")
    transfer_target = Column(String, nullable=False)

class BreakType(Base):
    __tablename__ = "break_types"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)
