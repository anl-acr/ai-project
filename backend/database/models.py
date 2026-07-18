import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from backend.database.config import Base

class Call(Base):
    __tablename__ = "calls"

    id = Column(String, primary_key=True, index=True)  # Asterisk Unique ID
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
    rule_type = Column(String, nullable=False)  # faq, routing, prompt
    trigger_keyword = Column(String, nullable=True)  # triggers if keyword matched
    response_text = Column(Text, nullable=True)
    action_to_trigger = Column(String, nullable=True)  # transfer_to_human, book_appointment
    is_active = Column(Boolean, default=True)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
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
    filename = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=False)  # Gemini Text Embedding Dimension is 768


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)  # UUID string
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
