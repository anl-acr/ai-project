# Evrensel API ve Webhook Sihirbazı (Low-Code) Kullanım ve Yapılandırma Kılavuzu

Bu kılavuz, yapay zeka santral ve omnichannel mesajlaşma sistemimize entegre ettiğimiz **Evrensel API ve Webhook Sihirbazı (Low-Code)** modülünün nasıl kullanılacağını, alanların işlevlerini ve farklı entegrasyon senaryolarına göre yapılması gereken yapılandırmaları ayrıntılı şekilde açıklar.

---

## 1. Sihirbaz Arayüzündeki Alanlar ve İşlevleri

Low-Code Sihirbazı, yazılım kodlaması yapmaya gerek kalmadan dış sistemlerinizdeki verileri yapay zekaya bağlamanızı sağlar. Form üzerindeki alanların detayları şu şekildedir:

| Alan Adı | Türü | Açıklama / Önem Derecesi | Örnek Değer |
| :--- | :--- | :--- | :--- |
| **API Anahtarı (ID)** | Metin | Yapay zekanın arka planda çağıracağı fonksiyonun benzersiz slug adıdır. Sadece küçük harf, rakam ve alt çizgi (`_`) içerebilir. Türkçe karakter veya boşluk içeremez. | `kargo_takip`, `borc_sorgula` |
| **API Adı (Başlık)** | Metin | Arayüzde listeleme yaparken insan tarafından kolayca anlaşılmasını sağlayan başlıktır. | `MNG Kargo Entegrasyonu` |
| **Metot** | Seçim | API servisinizin kabul ettiği HTTP metodunu belirtir. En sık kullanılanlar `GET` ve `POST`'tur. | `GET` veya `POST` |
| **Endpoint URL** | Metin | API servisinizin web adresi. Dinamik parametreleri URL içine gömmek için `{parametre_adi}` şeklinde süslü parantez (Path Parameter) şablonu kullanabilirsiniz. | `https://api.kargo.com/v1/status/{kargo_no}` |
| **Yapay Zeka Açıklaması (LLM Instruction)** | Uzun Metin | **Kritik Alan!** Yapay zekanın bu aracı (tool) ne zaman, hangi durumlarda ve hangi parametreleri toplayarak çağıracağını anlatan yönergedir. | *"Müşteri kargo durumunu veya kargosunun nerede olduğunu sorduğunda bu fonksiyonu çağırın. Kargo takip numarasını müşteriden almanız gerekir."* |
| **Headers (Başlıklar)** | Liste (Key-Value) | API servisinizin kimlik doğrulama (auth) veya özel başlık gereksinimleri için kullanılır. | Key: `Authorization`, Value: `Bearer crm_token_998877` |
| **API Parametreleri** | Dinamik Liste | Yapay zekanın müşteriden alıp API'ye göndereceği verilerin şemasıdır. | (Bkz. Alt Bölüm - Parametre Detayları) |

### API Parametre Detayları
Her parametre için şu özellikleri belirlemelisiniz:
1. **Parametre Adı:** API'nin beklediği tam değişken adı (örn: `tckn`, `siparis_id`).
2. **Parametre Tipi:** `STRING` (Metin), `NUMBER` (Sayı) veya `BOOLEAN` (Doğru/Yanlış).
3. **Parametre Yeri (Location):**
   * `Path Parameter`: URL içerisindeki `{parametre_adi}` alanına dinamik yerleştirilir.
   * `Query Parameter`: URL'nin sonuna soru işaretinden sonra eklenir (örn: `?siparis_id=123`).
   * `Body JSON Field`: İstek gövdesine (Request Body) JSON formatında eklenir (özellikle `POST` isteklerinde kullanılır).
4. **Parametre Açıklaması:** Yapay zekaya bu parametrenin neyi temsil ettiğini anlatır (örn: *"11 haneli TC Kimlik Numarası"*).
5. **Zorunlu:** İşaretlenirse, yapay zeka bu parametreyi müşteriden almadan API'yi tetikleyemez. Eksikse müşteriye sorup öğrenir.

---

## 2. Entegrasyon Senaryoları ve Örnek Konfigürasyonlar

### Senaryo A: Kargo Durumu Sorgulama (GET & Path Parameter)
Müşteri sesli aramada *"Kargom nerede?"* dediğinde veya WhatsApp'tan *"kargo durumunu öğrenmek istiyorum"* yazdığında tetiklenir.

* **API ID:** `kargo_durum`
* **API Adı:** `Kargo Durumu Getir`
* **Yapay Zeka Açıklaması:** `Müşteri kargosunun nerede olduğunu sorduğunda veya kargo takip sorgulaması yapmak istediğinde bu fonksiyonu çağırın. Müşteriden kargo takip numarasını almanız zorunludur.`
* **Metot:** `GET`
* **Endpoint URL:** `https://api.mngkargo.com/v2/shipments/{kargo_no}/track`
* **Headers:**
  * `X-API-Key`: `mng_secure_token_123`
* **Parametreler:**
  * Adı: `kargo_no`
  * Tipi: `STRING`
  * Yeri: `Path Parameter`
  * Açıklama: `Müşterinin belirttiği kargo takip numarası`
  * Zorunlu: `Evet` (İşaretli)

---

### Senaryo B: Borç / Fatura Sorgulama (POST & JSON Body)
Müşterinin borç bilgilerini çekmek için arka planda CRM sistemine POST isteği gönderilmesi.

* **API ID:** `fatura_sorgula`
* **API Adı:** `Müşteri Fatura Borcu Sorgulama`
* **Yapay Zeka Açıklaması:** `Müşteri borcunu öğrenmek, güncel fatura tutarını sorgulamak veya ödemesi gereken tutarı sormak istediğinde bu fonksiyonu çağırın. Müşteriden T.C. Kimlik numarasını almanız zorunludur.`
* **Metot:** `POST`
* **Endpoint URL:** `https://api.crm.sirketim.com/v1/billing/inquiry`
* **Headers:**
  * `Authorization`: `Bearer crm_key_abcde12345`
* **Parametreler:**
  * Adı: `tckn`
  * Tipi: `STRING`
  * Yeri: `Body JSON Field`
  * Açıklama: `Müşterinin 11 haneli T.C. Kimlik Numarası`
  * Zorunlu: `Evet`

*İstek Atıldığında Arka Planda Oluşan Request Body:*
```json
{
  "tckn": "12345678901"
}
```

---

### Senaryo C: Randevu / Kayıt Kontrolü (GET & Query Parameter)
Müşterinin telefon veya e-posta adresiyle sistemde kayıtlı bir randevusu olup olmadığını kontrol etme.

* **API ID:** `randevu_kontrol`
* **API Adı:** `Müşteri Randevu Sorgulama`
* **Yapay Zeka Açıklaması:** `Müşteri randevusunu sorgulamak istediğinde veya randevu durumunu kontrol ettirmek istediğinde bu fonksiyonu çağırın. Müşterinin telefon numarasını parametre olarak gönderin.`
* **Metot:** `GET`
* **Endpoint URL:** `https://api.randevum.com/inquire`
* **Headers:** (Boş bırakılabilir)
* **Parametreler:**
  * Adı: `phone`
  * Tipi: `STRING`
  * Yeri: `Query Parameter`
  * Açıklama: `Müşterinin telefon numarası`
  * Zorunlu: `Evet`

*İstek Atıldığında Gönderilen URL:*
`https://api.randevum.com/inquire?phone=05051234567`

---

## 3. Entegrasyon Asistanı (Copilot Chatbot) Nasıl Çalışır?

Arayüzün sağ sütununda yer alan **Entegrasyon Asistanı**, doğrudan Gemini API ile entegre bir yapay zeka yardımcı kılavuzudur. 
* Teknik olarak karmaşık bir API dökümanınız varsa, dökümandaki örnek **cURL** isteğini kopyalayıp asistana gönderebilirsiniz.
* Asistan, cURL isteğini otomatik olarak ayrıştırarak:
  1. Sihirbaz arayüzünde hangi URL'yi yazmanız gerektiğini,
  2. Hangi HTTP metodunu seçmeniz gerektiğini,
  3. Header tanımlarını nereye ve hangi anahtarlarla yapıştırmanız gerektiğini,
  4. Parametre tanımlarını ve bunların tiplerini/yerlerini (Query, Body, Path)
  size Türkçe olarak adım adım listeler.

---

## 4. API Test Sandbox Modülü

API tanımlarını yapıp "Kaydet" demeden önce entegrasyonun çalışıp çalışmadığını test edebilirsiniz.
1. Sihirbazın altındaki **API Test Sandbox** alanına gidin.
2. Formda tanımladığınız parametreler için test değerleri girin (örn: `kargo_no` alanına `987654321` yazın).
3. **İsteği Çalıştır** butonuna basın.
4. Sistem, backend üzerinden hedef API sunucunuza güvenli bir istek gönderir ve dönen **HTTP Durum Kodunu** ile **JSON yanıt içeriğini** altındaki panelde gösterir. Dönen yanıtı inceleyerek parametre yerleşimlerinizin doğruluğunu teyit edebilirsiniz.
5. Yapay zeka, API'den dönen tüm ham JSON verisini analiz edebilecek kapasitededir. Bu nedenle dönen JSON yanıtın karmaşık olması sorun teşkil etmez; LLM bu veriyi okuyup müşteriye anlaşılır bir Türkçe ile seslendirecektir.
