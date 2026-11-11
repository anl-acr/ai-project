# AIDA PBX — Kurumsal Dış API (External REST API v1) Entegrasyon Kılavuzu

Bu doküman, dış yazılımların (**CRM, ERP, Çağrı Merkezi Uygulamaları, Mobil Uygulamalar**) AIDA PBX santral sistemi ile güvenli bir şekilde haberleşmesi için hazırlanmıştır.

---

## 1. API Nedir ve Nasıl Çalışır? (Temel Kavramlar)

Dış bir yazılımın santralden bilgi alması veya santrale komut göndermesi **HTTP İstekleri (Requests)** ile yapılır. Her isteğin başında **ne yapmak istediğinizi belirten bir işlem türü (HTTP Metodu)** yer alır:

| Türkçe İşlem Adı | Teknik İbaresi (HTTP Metodu) | Santraldeki Karşılığı ve Açıklaması |
| :--- | :--- | :--- |
| **Okuma / Görüntüleme (GET)** | `GET` | Santralde **hiçbir ayarı değiştirmez**. Sadece bilgi, liste, çağrı raporu (CDR) veya ses kaydı çekmek için kullanılır. |
| **Yeni Ekleme / İşlem Başlatma (POST)** | `POST` | Santrale **yeni bir kayıt eklemek** (yeni abone, rehber kişisi, randevu) veya **anlık bir eylem tetiklemek** (Tıkla-Ara çağrı başlatma, WhatsApp mesajı gönderme, canlı çağrıyı aktarma) için kullanılır. |
| **Güncelleme / Düzenleme (PUT)** | `PUT` | Sistemde **zaten var olan bir kaydın ayarlarını değiştirmek** (örneğin 1001 nolu abonenin ses kaydını kapatmak veya kuyruk süresini değiştirmek) için kullanılır. |
| **Kayıt Silme (DELETE)** | `DELETE` | Sistemdeki **mevcut bir kaydı silmek** (abone silme, rehberden kişi silme) için kullanılır. |

---

## 2. Güvenlik ve Kimlik Doğrulama (Authentication / Token)

AIDA PBX Dış API katmanı **Zero-Trust (Sıfır Güven)** mimarisiyle korunmaktadır:

1. **API Anahtarı (Token) Alma**:
   - Yönetim panelinden **Sistem Ayarları > Kanallar & Entegrasyon > Kurumsal Dış API & Token Yönetimi** ekranına gidin.
   - Sağ üstteki **`+`** butonuna tıklayarak yeni bir anahtar oluşturun.
   - Anahtar formatı: `aida_live_<musteri>_<40_karakter_kriptografik_kod>`
   - Güvenlik nedeniyle üretilen anahtar veritabanında **SHA-256** özetleme (hash) ile saklanır ve ekranda **sadece oluşturulduğu an 1 kez** gösterilir.
2. **İsteklerde Anahtarın Gönderilmesi**:
   - Dış yazılım, yaptığı her istekte bu anahtarı `X-API-Key` veya `Authorization: Bearer <token>` başlığı (Header) içinde göndermek zorundadır:
   ```http
   X-API-Key: aida_live_default_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a
   Content-Type: application/json
   ```
3. **IP Beyaz Liste (IP Whitelist) ve Hız Sınırı (Rate Limit)**:
   - Anahtar oluşturulurken **İzin Verilen IP Adresleri** tanımlanmışsa, sadece o sunucu IP'lerinden gelen istekler kabul edilir; diğer tüm IP'ler `HTTP 403 Forbidden` ile reddedilir.
   - Her anahtarın dakikalık istek limiti (varsayılan `120 istek/dakika`) bulunur.

---

## 3. Yetki Kapsamları (Scopes)

Her API Anahtarı sadece kendisine izin verilen modüllere ve işlem türlerine erişebilir:

| Yetki Kodu (Scope) | Türkçe & Teknik Anlamı |
| :--- | :--- |
| `calls:read` | Canlı Çağrıları Okuma / Görüntüleme (`GET`) |
| `calls:write` | Tıkla-Ara Başlatma, Çağrı Aktarma ve Sonlandırma (`POST / PUT`) |
| `cdr:read` | Çağrı Raporları (CDR), Ses Kayıtları ve Transkript Okuma (`GET`) |
| `extensions:read` | Dahili Aboneleri ve Durumlarını Okuma / Görüntüleme (`GET`) |
| `extensions:write` | Yeni Abone Ekleme, Ayar Değiştirme ve Mola Yönetimi (`POST / PUT`) |
| `extensions:delete` | Dahili Abone Silme (`DELETE`) |
| `queues:read` | ACD Kuyrukları ve Abone Gruplarını Okuma (`GET`) |
| `queues:write` | Kuyruk Oluşturma, Güncelleme ve Temsilci Ekleme/Çıkarma (`POST / PUT`) |
| `queues:delete` | Kuyruk Silme (`DELETE`) |
| `routing:read` | Gelen/Giden Arama Kuralları ve SIP Trunk Okuma (`GET`) |
| `routing:write` | Arama Kuralı Güncelleme ve Toplu Konfigürasyon Uygulama (`POST / PUT`) |
| `crm:read` | Rehber (Kişiler), Kara Liste ve Randevu Okuma (`GET`) |
| `crm:write` | Rehbere Kişi Ekleme, Numara Engelleme ve Randevu Oluşturma (`POST / PUT`) |
| `crm:delete` | Rehber Kişisi Silme (`DELETE`) |
| `ai_omnichannel:read` | Yapay Zeka Asistanlarını Listeleme (`GET`) |
| `ai_omnichannel:write` | WhatsApp Mesajı Gönderme ve AI Dış Arama Başlatma (`POST`) |

---

## 4. API Uç Noktaları (Endpoints) ve Örnek Kullanımlar

### 4.1. Canlı Çağrı & Santral Kontrolü

#### A) Tıkla-Ara (Click-to-Call) Çağrı Başlatma — Yeni İşlem Başlatma (`POST`)
- **Adres**: `POST /api/v1/calls/originate`
- **Gereken Yetki**: `calls:write`
- **Açıklama**: Önce temsilcinin dahili telefonunu (`extension`) çaldırır; temsilci telefonu açtığında otomatik olarak müşteri numarasını (`destination`) arar.
```bash
curl -X POST "https://SANTRAL_ADRESINIZ/api/v1/calls/originate" \
  -H "X-API-Key: aida_live_default_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "extension": "1000",
    "destination": "05321234567",
    "caller_id": "908503607390",
    "timeout": 30
  }'
```

#### B) Aktif (Canlı) Çağrıları Listeleme — Okuma / Görüntüleme (`GET`)
- **Adres**: `GET /api/v1/calls/active`
- **Gereken Yetki**: `calls:read`

#### C) Canlı Çağrıyı Başka Dahiliye / Kuyruğa Aktarma — İşlem Başlatma (`POST`)
- **Adres**: `POST /api/v1/calls/{call_id}/transfer`
- **Gereken Yetki**: `calls:write`
```json
{
  "target_extension": "1002",
  "context": "webrtc_agents"
}
```

#### D) Aktif Çağrıyı Sonlandırma — İşlem Başlatma (`POST`)
- **Adres**: `POST /api/v1/calls/{call_id}/hangup`
- **Gereken Yetki**: `calls:write`

---

### 4.2. Çağrı Raporları (CDR), Ses Kayıtları & Transkript

#### A) Detaylı Çağrı Geçmişi (CDR) Listeleme — Okuma / Görüntüleme (`GET`)
- **Adres**: `GET /api/v1/cdr?limit=50&direction=inbound&search=0532`
- **Gereken Yetki**: `cdr:read`
- **Dönen Veri**: Çağrının ana bilgileri, tam ses kaydı URL'i (`recording_url`) ve varsa transfer/pickup alt görüşmelerinin (`call_legs`) ayrı ayrı ses kayıtları.

#### B) Tekil Çağrı Detayı ve Konuşma Dökümü (Transcript) — Okuma / Görüntüleme (`GET`)
- **Adres**: `GET /api/v1/cdr/{call_id}`
- **Gereken Yetki**: `cdr:read`

#### C) Ses Kaydı Dosyasını (WAV) İndirme — Okuma / İndirme (`GET`)
- **Tam Çağrı Ses Kaydı**: `GET /api/v1/cdr/{call_id}/recording`
- **Belirli Bir Transfer Bacağının Ses Kaydı**: `GET /api/v1/cdr/{call_id}/recording?leg_index=1`

---

### 4.3. Dahili Aboneler (Kullanıcılar) & Mola Yönetimi

- **Tüm Aboneleri Listeleme (`GET`)**: `GET /api/v1/extensions`
- **Yeni Dahili Abone Ekleme (`POST`)**: `POST /api/v1/extensions`
- **Abone Ayarlarını (Ses Kaydı / Yönlendirme) Güncelleme (`PUT`)**: `PUT /api/v1/extensions/{extension}`
- **Temsilciyi Molaya Çıkarma / Müsait Yapma (`POST`)**: `POST /api/v1/extensions/{extension}/status`
  ```json
  {
    "status": "break",
    "break_reason": "Yemek Molası"
  }
  ```
- **Dahili Aboneyi Silme (`DELETE`)**: `DELETE /api/v1/extensions/{extension}`

---

### 4.4. ACD Arama Kuyrukları, Arama Kuralları & Toplu Konfigürasyon

- **Kuyrukları Listeleme (`GET`)**: `GET /api/v1/queues`
- **Yeni Kuyruk Oluşturma (`POST`)**: `POST /api/v1/queues`
- **Kuyruk Ayarlarını / Üyelerini Güncelleme (`PUT`)**: `PUT /api/v1/queues/{queue_id}`
- **Abone Gruplarını Listeleme (`GET`)**: `GET /api/v1/subscriber-groups`
- **Gelen Arama Kurallarını Listeleme (`GET`)**: `GET /api/v1/inbound-rules`
- **Giden Arama Kurallarını Listeleme (`GET`)**: `GET /api/v1/outbound-rules`
- **SIP Trunk Listesi (`GET`)**: `GET /api/v1/trunks`
- **Toplu Konfigürasyon Uygulama (`POST`)**: `POST /api/v1/bulk-config/apply`
  ```json
  {
    "module": "users",
    "target_mode": "all",
    "changes": {
      "recording_active": false
    }
  }
  ```

---

### 4.5. CRM Rehber, Kara Liste, Randevu & Omnichannel (WhatsApp)

- **Rehber Kişilerini Listeleme (`GET`)**: `GET /api/v1/contacts`
- **Rehbere Yeni Kişi Ekleme (`POST`)**: `POST /api/v1/contacts`
- **Rehberden Kişi Silme (`DELETE`)**: `DELETE /api/v1/contacts/{contact_id}`
- **Kara Liste Sorgulama (`GET`) ve Numara Engelleme (`POST`)**: `/api/v1/blacklist`
- **Randevuları Listeleme (`GET`) ve Yeni Randevu Oluşturma (`POST`)**: `/api/v1/appointments`
- **WhatsApp Mesajı Gönderme (`POST`)**: `POST /api/v1/omnichannel/whatsapp/send`
  ```json
  {
    "phone": "905321234567",
    "message": "Sayın müşterimiz, randevunuz onaylanmıştır."
  }
  ```
- **AI Sesli Asistan ile Otomatik Arama Başlatma (`POST`)**: `POST /api/v1/ai-calls/originate`
