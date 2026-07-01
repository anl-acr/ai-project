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
