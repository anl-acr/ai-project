import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from license_center.backend.database import Base

class MasterUser(Base):
    __tablename__ = "master_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="admin") # admin, operator, viewer
    is_active = Column(Boolean, default=True)
    avatar = Column(String, nullable=True)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    email_2fa_enabled = Column(Boolean, default=False)
    two_factor_mode = Column(String, default="single")  # single | all | any
    two_factor_methods_json = Column(Text, default="[]")  # ["email", "google_auth", "microsoft_auth"]
    two_factor_secrets_json = Column(Text, default="{}")  # {"google_auth": {"secret": "...", "enrolled": true}, ...}
    expiring_soon_days = Column(Integer, default=15)  # 7, 15, 30, 60, 90, 120
    auto_logout_minutes = Column(Integer, default=15)  # 0=off, 5, 15, 30, 60...
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class MasterBlockedIP(Base):
    __tablename__ = "master_blocked_ips"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String, unique=True, index=True, nullable=False)
    reason = Column(String, nullable=False, default="Brute-Force Hatalı Giriş Engeli")
    failed_attempts = Column(Integer, default=0)
    blocked_until = Column(DateTime, nullable=True)
    is_permanent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class MasterSecurityPolicy(Base):
    __tablename__ = "master_security_policy"

    id = Column(Integer, primary_key=True, index=True)
    max_failed_attempts = Column(Integer, default=5)
    block_duration_minutes = Column(Integer, default=60)
    auto_logout_minutes = Column(Integer, default=15) # 0 = disabled
    whitelisted_ips_json = Column(Text, default="[]")
    smtp_host = Column(String, default="")
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String, default="")
    smtp_password = Column(String, default="")
    smtp_from_email = Column(String, default="")
    smtp_use_tls = Column(Boolean, default=True)
    collective_shield_enabled = Column(Boolean, default=True)
    collective_shield_ttl_days = Column(Integer, default=7)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class GlobalThreatIP(Base):
    """Fleet-wide collective threat intelligence: attacker IPs banned by any PBX are shared with all PBXs."""
    __tablename__ = "global_threat_ips"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String, unique=True, index=True, nullable=False)
    jail = Column(String, default="asterisk-pjsip")
    reason = Column(String, default="SIP Brute-Force / Yetkisiz Deneme")
    source = Column(String, default="pbx_auto")  # pbx_auto | pbx_manual | panel_manual
    status = Column(String, default="active", index=True)  # active | revoked
    hit_count = Column(Integer, default=1)
    reporting_pbx_count = Column(Integer, default=1)
    first_reported_by = Column(String, default="")
    reporters_json = Column(Text, default="[]")  # [{hardware_id, tenant_code, company_name, reported_at}]
    is_permanent = Column(Boolean, default=False)
    first_seen_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(String, nullable=True)


class MasterAuditLog(Base):
    __tablename__ = "master_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String, nullable=False)
    action = Column(String, nullable=False)   # LICENSE_GENERATE, CLIENT_CREATE, CLIENT_SUSPEND, USER_CREATE, USER_LOGIN
    details = Column(Text, nullable=False)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ClientServer(Base):
    __tablename__ = "client_servers"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    tenant_code = Column(String, unique=True, index=True, nullable=False)
    tenant_serial_number = Column(String, index=True, nullable=True) # e.g. SN-TNT-2026-0100-A4F91C
    system_serial_number = Column(String, index=True, nullable=True) # e.g. SN-SRV-2026-361BF973-8A4C
    hardware_id = Column(String, index=True, nullable=True) # e.g. HW-361B-F973
    ip_address = Column(String, nullable=True)
    domain_name = Column(String, nullable=True)
    connect_subdomain = Column(String, index=True, nullable=True) # Locked Nornia Connect subdomain (e.g. merkez)
    remote_ssh_enabled = Column(Boolean, default=True) # Centrally managed SSH & Web SSH switch (True=Open, False=Locked/Closed)
    wg_public_key = Column(String, nullable=True) # Auto-provisioned WireGuard public key from PBX
    wg_tunnel_ip = Column(String, index=True, nullable=True) # Allocated 10.200.x.y private SIP/Media tunnel IP
    sip_edge_enabled = Column(Boolean, default=True) # Per-PBX SIP 5060/5061 + RTP Edge routing toggle
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    plan_tier = Column(String, default="professional") # trial, starter, professional, enterprise
    status = Column(String, default="active") # active, suspended, expired, dev
    current_license_key = Column(String, nullable=True)
    license_expires_at = Column(String, nullable=True) # YYYY-MM-DD or unlimited
    
    # Telemetry metrics
    last_heartbeat_at = Column(DateTime, nullable=True)
    software_version = Column(String, default="v2.4.8")
    update_channel = Column(String, default="stable") # stable, beta, pinned
    self_update_allowed = Column(Boolean, default=False) # Centrally managed PBX self-update switch
    update_status = Column(String, default="idle") # idle, waiting_calls, updating, success, failed, rolled_back
    update_progress = Column(Integer, default=0)
    update_step = Column(String, default="")
    update_target_version = Column(String, default="")
    update_last_error = Column(Text, default="")
    update_updated_at = Column(DateTime, nullable=True)
    cpu_usage_percent = Column(Float, default=0.0)
    ram_usage_percent = Column(Float, default=0.0)
    disk_usage_percent = Column(Float, default=0.0)
    failed_services_json = Column(Text, default="[]")
    active_calls_count = Column(Integer, default=0)
    total_users_count = Column(Integer, default=0)
    whatsapp_status = Column(String, default="offline")
    
    custom_quotas = Column(Text, nullable=True) # JSON string of custom quota overrides
    
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


class MasterPackageTemplate(Base):
    __tablename__ = "master_package_templates"

    id = Column(Integer, primary_key=True, index=True)
    tier_key = Column(String, unique=True, index=True, nullable=False)  # trial, starter, professional, enterprise, unlimited
    name = Column(String, nullable=False)
    tagline = Column(String, nullable=True)
    config_json = Column(Text, default="{}")  # allowed_features, allowed_sub_features, stt/tts/llm, unlicensed_module_mode
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class SystemRelease(Base):
    __tablename__ = "system_releases"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True, index=True, nullable=False)  # e.g. v3.6.3
    commit_hash = Column(String, default="")  # exact git commit hash pinned for this release
    channel = Column(String, default="stable", index=True)  # stable, beta
    release_date = Column(String, default="")
    title = Column(String, default="")
    summary = Column(Text, default="")
    features_json = Column(Text, default="[]")  # JSON list of features (strings or {title, desc})
    fixes_json = Column(Text, default="[]")  # JSON list of bug fixes
    is_published = Column(Boolean, default=True)
    is_mandatory = Column(Boolean, default=False)
    requires_asterisk_reload = Column(Boolean, default=True)
    created_by = Column(String, default="admin")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    published_at = Column(DateTime, default=datetime.datetime.utcnow)
