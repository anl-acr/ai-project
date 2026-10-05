import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from license_center.backend.database import Base

class ClientServer(Base):
    __tablename__ = "client_servers"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    tenant_code = Column(String, unique=True, index=True, nullable=False)
    hardware_id = Column(String, index=True, nullable=True) # e.g. HW-361B-F973
    ip_address = Column(String, nullable=True)
    domain_name = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    plan_tier = Column(String, default="professional") # trial, starter, professional, enterprise
    status = Column(String, default="active") # active, suspended, expired, dev
    current_license_key = Column(String, nullable=True)
    license_expires_at = Column(String, nullable=True) # YYYY-MM-DD or unlimited
    
    # Telemetry metrics
    last_heartbeat_at = Column(DateTime, nullable=True)
    software_version = Column(String, default="v2.4.8")
    cpu_usage_percent = Column(Float, default=0.0)
    ram_usage_percent = Column(Float, default=0.0)
    active_calls_count = Column(Integer, default=0)
    total_users_count = Column(Integer, default=0)
    whatsapp_status = Column(String, default="offline")
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    licenses = relationship("LicenseRecord", back_populates="client", cascade="all, delete-orphan")
    telemetry_logs = relationship("TelemetryLog", back_populates="client", cascade="all, delete-orphan")


class LicenseRecord(Base):
    __tablename__ = "license_records"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_servers.id", ondelete="CASCADE"), nullable=False)
    tenant_code = Column(String, nullable=False)
    hardware_id = Column(String, nullable=True)
    license_key = Column(String, unique=True, nullable=False)
    expires_at = Column(String, nullable=False) # YYYY-MM-DD or unlimited
    plan_tier = Column(String, default="professional")
    is_active = Column(Boolean, default=True)
    created_by = Column(String, default="admin")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    client = relationship("ClientServer", back_populates="licenses")


class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_servers.id", ondelete="CASCADE"), nullable=False)
    tenant_code = Column(String, nullable=False)
    hardware_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    software_version = Column(String, nullable=True)
    cpu_percent = Column(Float, default=0.0)
    memory_percent = Column(Float, default=0.0)
    active_calls = Column(Integer, default=0)
    whatsapp_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    client = relationship("ClientServer", back_populates="telemetry_logs")
