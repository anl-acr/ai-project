import datetime
import hashlib
import hmac
import os
import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import text

DEFAULT_KVKK_TITLE = "6698 Sayılı KVKK Kapsamında Kullanıcı & Çalışan Aydınlatma Metni"

DEFAULT_KVKK_TEXT = """1. VERİ SORUMLUSU
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, kurumsal iletişim ve çağrı merkezi platformu ("Sistem") kapsamında işlenen kişisel verileriniz, veri sorumlusu sıfatıyla bağlı bulunduğunuz kurum ("Veri Sorumlusu") tarafından aşağıda açıklanan kapsamda işlenmektedir.

2. İŞLENEN KİŞİSEL VERİ KATEGORİLERİ
Sisteme giriş yapmanız ve kurumsal iletişim araçlarını kullanmanız süresince aşağıdaki veriler işlenebilir:
• Kimlik ve İletişim Bilgileri: Ad, soyad, kurumsal e-posta adresi, dahili numara, görev/departman bilgisi.
• Görüşme ve İletişim Kayıtları: Gelen/giden çağrı kayıtları (CDR), telefon ses kayıtları, sesli posta mesajları, çoklu kanal (WhatsApp, E-posta, Sosyal Medya) yazışmaları ve yapay zeka destekli konuşma dökümleri (transkript).
• İşlem Güvenliği ve Erişim Logları: Oturum açma/kapama zamanları, IP adresi, cihaz/tarayıcı/platform bilgisi (Web, Masaüstü, Mobil), sistem içi işlem ve denetim kayıtları.
• Operasyonel Performans Verileri: Mola/durum geçmişi, kuyruk bekleme/karşılama süreleri, kalite değerlendirme (QA) puanları ve çağrı sonuç kodları.

3. KİŞİSEL VERİLERİN İŞLENME AMAÇLARI
Kişisel verileriniz; kurumsal telefon ve iletişim hizmetlerinin yürütülmesi, müşteri talep ve şikâyet süreçlerinin kayıt altına alınması, hizmet kalitesinin ölçülmesi ve geliştirilmesi, bilgi güvenliği ve erişim denetiminin sağlanması, 5651 sayılı Kanun ve ilgili mevzuattan doğan yasal saklama/ispat yükümlülüklerinin yerine getirilmesi amaçlarıyla işlenmektedir.

4. HUKUKİ SEBEP VE AKTARIM
Verileriniz KVKK'nın 5. maddesinde belirtilen "kanunlarda açıkça öngörülmesi", "bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması", "veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi" ve "meşru menfaat" hukuki sebeplerine dayanarak elektronik ortamda otomatik yollarla işlenir; yalnızca yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarıyla paylaşılır.

5. KVKK MADDE 11 KAPSAMINDAKİ HAKLARINIZ
KVKK'nın 11. maddesi uyarınca Veri Sorumlusuna başvurarak; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmişse düzeltilmesini isteme, kanuni şartlar çerçevesinde silinmesini veya yok edilmesini talep etme haklarına sahipsiniz."""

DEFAULT_PRIVACY_TITLE = "Gizlilik, Bilgi Güvenliği ve Ses Kaydı Kullanım Politikası"

DEFAULT_PRIVACY_TEXT = """1. GİZLİLİK VE MÜŞTERİ VERİLERİNİN KORUNMASI
Sistem üzerinden eriştiğiniz tüm müşteri telefon numaraları, ses kayıtları, transkriptler, yazışmalar ve kurumsal bilgiler gizli bilgi niteliğindedir. Bu veriler yalnızca görev tanımınız kapsamında kullanılabilir; yetkisiz üçüncü kişilerle paylaşılamaz, ekran görüntüsü/ses kaydı alınarak kurum dışına çıkarılamaz veya kişisel amaçlarla kopyalanamaz.

2. HESAP VE ŞİFRE GÜVENLİĞİ
Size tahsis edilen kullanıcı hesabı, şifre, dahili numara ve iki aşamalı doğrulama (2FA) bilgileri kişiye özeldir. Hesap bilgilerinizi başka kişilerle paylaşmamak, ortak kullanılan bilgisayarlardan ayrılırken oturumu kapatmak ve şüpheli erişim fark ettiğinizde sistem yöneticisine bildirmekle yükümlüsünüz.

3. SES KAYDI VE DENETİM BİLGİLENDİRMESİ
Hizmet kalitesi, eğitim, güvenlik ve hukuki uyuşmazlıklarda delil oluşturma amaçlarıyla sistem üzerinden yapılan telefon görüşmeleri kayıt altına alınabilir, yapay zeka destekli kalite/duygu analizine tabi tutulabilir ve yetkili süpervizörler tarafından canlı olarak izlenebilir.

4. VERİ SAKLAMA VE İMHA
Ses kayıtları, çağrı detay kayıtları (CDR) ve erişim logları, kurumunuzun "Kayıt & Saklama Politikası" ve yürürlükteki yasal süreler doğrultusunda güvenli sunucularda saklanır; süresi dolduğunda otomatik olarak imha edilir veya anonimleştirilir.

5. KABUL VE YÜRÜRLÜK
Bu politikayı onaylayarak yukarıdaki gizlilik, bilgi güvenliği ve kayıt kurallarına uygun davranacağınızı beyan ve kabul etmiş olursunuz. Onay işleminiz tarih, saat, IP adresi, cihaz platformu ve metin bütünlük özeti (SHA-256) ile birlikte değiştirilemez denetim kaydı olarak saklanır."""

_KVKK_HMAC_SECRET = (
    os.getenv("AIDA_KVKK_HMAC_SECRET")
    or os.getenv("LICENSE_MASTER_SECRET")
    or "NORNIA_KVKK_IMMUTABLE_AUDIT_SEAL_2026_V1"
)


def compute_policy_hash(text_value: str) -> str:
    normalized = (text_value or "").replace("\r\n", "\n").strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def compute_consent_hmac(
    tenant_id: str,
    user_id: str,
    policy_version: str,
    kvkk_sha256: str,
    privacy_sha256: str,
    accepted_at_iso: str,
    ip_address: str,
) -> str:
    payload = "|".join([
        str(tenant_id or "tenant-default"),
        str(user_id or ""),
        str(policy_version or "v1.0"),
        str(kvkk_sha256 or ""),
        str(privacy_sha256 or ""),
        str(accepted_at_iso or ""),
        str(ip_address or ""),
    ])
    return hmac.new(
        _KVKK_HMAC_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_consent_hmac(log_row: Any) -> bool:
    try:
        accepted_at_iso = (
            log_row.accepted_at.strftime("%Y-%m-%dT%H:%M:%SZ")
            if isinstance(log_row.accepted_at, datetime.datetime)
            else str(log_row.accepted_at or "")
        )
        expected = compute_consent_hmac(
            tenant_id=log_row.tenant_id or "tenant-default",
            user_id=log_row.user_id or "",
            policy_version=log_row.policy_version or "v1.0",
            kvkk_sha256=log_row.kvkk_sha256 or "",
            privacy_sha256=log_row.privacy_sha256 or "",
            accepted_at_iso=accepted_at_iso,
            ip_address=log_row.ip_address or "",
        )
        return hmac.compare_digest(expected, str(log_row.record_hmac or ""))
    except Exception:
        return False


def bump_policy_version(current_version: str) -> str:
    v = str(current_version or "v1.0").strip()
    m = re.match(r"^v?(\d+)\.(\d+)$", v)
    if m:
        major = int(m.group(1))
        minor = int(m.group(2)) + 1
        return f"v{major}.{minor}"
    return "v1.1"


def get_default_kvkk_policy(tenant_name: str = "") -> Dict[str, Any]:
    kvkk_body = DEFAULT_KVKK_TEXT
    if tenant_name and tenant_name.strip() and tenant_name.strip() not in ("Ana Müşteri", "Default Tenant"):
        kvkk_body = kvkk_body.replace(
            'bağlı bulunduğunuz kurum ("Veri Sorumlusu")',
            f'{tenant_name.strip()} ("Veri Sorumlusu")',
        )
    return {
        "enabled": True,
        "version": "v1.0",
        "require_reconsent_version": "v1.0",
        "kvkk_title": DEFAULT_KVKK_TITLE,
        "kvkk_text": kvkk_body,
        "privacy_title": DEFAULT_PRIVACY_TITLE,
        "privacy_text": DEFAULT_PRIVACY_TEXT,
        "kvkk_sha256": compute_policy_hash(kvkk_body),
        "privacy_sha256": compute_policy_hash(DEFAULT_PRIVACY_TEXT),
        "updated_at": None,
        "updated_by": "Sistem Varsayılanı",
    }


def get_tenant_kvkk_policy(settings_db: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    tid = str(tenant_id or "tenant-default").strip() or "tenant-default"
    policies = settings_db.get("kvkk_consent_policies")
    if not isinstance(policies, dict):
        policies = {}

    tenant_name = ""
    for t in settings_db.get("tenants") or []:
        if isinstance(t, dict) and str(t.get("id") or "") == tid:
            tenant_name = str(t.get("name") or "")
            break

    base = get_default_kvkk_policy(tenant_name=tenant_name)
    stored = policies.get(tid)
    if not isinstance(stored, dict):
        return base

    merged = dict(base)
    merged["enabled"] = bool(stored.get("enabled", True))
    merged["version"] = str(stored.get("version") or "v1.0").strip() or "v1.0"
    merged["require_reconsent_version"] = (
        str(stored.get("require_reconsent_version") or "v1.0").strip() or "v1.0"
    )
    merged["kvkk_title"] = str(stored.get("kvkk_title") or base["kvkk_title"]).strip()
    merged["kvkk_text"] = str(stored.get("kvkk_text") or base["kvkk_text"]).strip()
    merged["privacy_title"] = str(stored.get("privacy_title") or base["privacy_title"]).strip()
    merged["privacy_text"] = str(stored.get("privacy_text") or base["privacy_text"]).strip()
    merged["kvkk_sha256"] = compute_policy_hash(merged["kvkk_text"])
    merged["privacy_sha256"] = compute_policy_hash(merged["privacy_text"])
    merged["updated_at"] = stored.get("updated_at")
    merged["updated_by"] = stored.get("updated_by") or "Sistem Yöneticisi"
    return merged


def parse_version_tuple(version_str: str) -> Tuple[int, int]:
    m = re.match(r"^v?(\d+)\.(\d+)$", str(version_str or "v1.0").strip())
    if m:
        return (int(m.group(1)), int(m.group(2)))
    return (1, 0)


def is_consent_sufficient(accepted_version: Optional[str], required_version: str) -> bool:
    if not accepted_version:
        return False
    return parse_version_tuple(accepted_version) >= parse_version_tuple(required_version)


async def ensure_user_consent_table_async(db_session) -> None:
    """Safely creates user_consent_logs table in PostgreSQL if not present yet."""
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS user_consent_logs (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR DEFAULT 'tenant-default',
            user_id VARCHAR NOT NULL,
            username VARCHAR,
            full_name VARCHAR,
            email VARCHAR,
            extension VARCHAR,
            policy_version VARCHAR NOT NULL DEFAULT 'v1.0',
            kvkk_sha256 VARCHAR NOT NULL,
            privacy_sha256 VARCHAR NOT NULL,
            kvkk_snapshot_text TEXT NOT NULL,
            privacy_snapshot_text TEXT NOT NULL,
            accepted_kvkk BOOLEAN NOT NULL DEFAULT TRUE,
            accepted_privacy BOOLEAN NOT NULL DEFAULT TRUE,
            ip_address VARCHAR,
            user_agent TEXT,
            client_platform VARCHAR DEFAULT 'web_phone',
            record_hmac VARCHAR NOT NULL,
            accepted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_consent_logs_tenant_user ON user_consent_logs (tenant_id, user_id);",
        "CREATE INDEX IF NOT EXISTS ix_user_consent_logs_accepted_at ON user_consent_logs (accepted_at DESC);",
    ]
    for stmt in ddl_statements:
        await db_session.execute(text(stmt))
    await db_session.commit()
