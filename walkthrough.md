# Automated Quality Assurance (QA) and Coaching Report Walkthrough

We have successfully designed, built, and integrated the **Automated QA & Agent Coaching** system. The changes cover database schema expansions, Gemini-powered LLM evaluation services, automated trigger hooks, settings views, and dashboard quality display widgets.

---

## 🛠️ Work Accomplished

### 1. Database Schema Updates (`models.py` & `init_db.py`)
* Modified `Call` and `ChatSession` models to store:
  * `qa_score`: Integer (0-100) representing agent performance.
  * `qa_report`: JSON Text containing rule-by-rule breakdown analysis and coaching feedback.
* Created the `QAQuestion` table to manage custom criteria questions:
  * `id`: Auto-increment primary key.
  * `question`: Evaluation question string (e.g., "Did agent read KVKK text?").
  * `max_score`: Weight of the criteria (potential penalty point deduction).
  * `is_active`: Toggle activation boolean.
* Configured startup migration hooks in [init_db.py](file:///Users/anilacar/ai-project/backend/database/init_db.py)

## 4. Arama Akış Yönetimi (Call Flow Editor) Güncellemeleri
1. **[CallFlowEditor.js](file:///Users/anilacar/ai-project/frontend/components/settings/CallFlowEditor.js) & [main.py](file:///Users/anilacar/ai-project/backend/main.py):**
   * **DID Node (Gelen DID Eşleme):**
     * Sistem girişinin ilk katmanı olarak trunk-bağımsız DID filtresi eklendi.
     * Özellik denetçisinde wildcard toggle'ı (`x.`) ve tekil/virgüllü DID numarası giriş alanları sunuldu. Giriş portu kapatıldı ve başlangıç düğümü yapıldı.
    * **TIMERULE Node (Senaryo Düğümü):**
      * Mesai saatlerini (Başlangıç/Bitiş), aktif günleri ve Resmi Tatil/Özel Gün tarihlerini kontrol eden zaman kontrol modülü.
      * `"active"` (Mesai Saatleri), `"inactive"` (Mesai Dışı) ve `"holiday"` (Resmi Tatil) adında **üç çıkış kapısı (branch)** eklenerek akış yönlendirmesi sağlandı.
      * Ayarlar popup modalı içine "Özel Günler / Resmi Tatiller" listeleme ve tarih ekleme paneli entegre edilerek yöneticilerin GG.AA veya GG.AA.YYYY formatında özel tatil tarihleri girmesi sağlandı.
   * **AI AGENT Node (Müşteri Temsilcisi AI):**
     * Gemini yapay zeka asistanını temsil eden düğüm entegre edildi. Sistemde tanımlı tüm AI Agent'lar API'den çekilerek Özellik Denetçisinde dropdown olarak seçilebilir kılındı.
   * **Akış Şablonu:** Yeni oluşturulan akışlar varsayılan olarak bir DID düğümüyle başlamaktadır. Ayrıca database `settings.json` migrasyonu ile `wf-2` ID'li DID -> Zaman Kontrolü -> Yapay Zeka / Mesai Dışı Anonsu yönlendirme şablonu kullanıma hazır olarak yüklenmektedir.

2. **Gelişmiş Arayüz ve UX İyileştirmeleri (Sidebar Kaldırılması & Merkezî Popup Sistemi):**
   * **Sidebar Kaldırılması:** Sağ tarafta yer alan sabit özellik denetçisi (`320px`) kaldırıldı ve kanvas ekranın tamamını (%100 genişlik) kaplayacak şekilde genişletildi.
   * **Merkezî Ayarlar Popup'ı (Modal):** Tüm düğümler için (Play, TTS, AI Agent, SR, Compare, Timerule, DID, vb.) ortak, ekran ortasında açılan şık bir `backdrop-blur-sm` özellik ayarları popup'ı entegre edildi.
   * **Sürükleme ve Tıklama Yalıtımı:** Kanvas üzerindeki kartlar serbestçe sürüklenebilir; ayar popup'ı ise **sadece düğümün ismine tıklandığında** açılacak şekilde yalıtıldı.
   * **Bağlantıyı Sil Butonu:** Seçili bir bağlantı çizgisi olduğunda üst araç çubuğunda (toolbar) beliren dinamik bir `"Bağlantıyı Sil"` butonu eklendi.
   * **Port Hizalaması & Giriş/Çıkış Portlarının Ortalanması (Dikey Hizalama Revizyonu):**
     * **CSS / Yerleşim Gotcha Çözümü:** Mutlak konumlandırılmış (`absolute`) düğüm kartlarının inline style özelliklerine `height: dims.h` (yükseklik) değeri eklenerek tarayıcının yüzde bazlı yerleşimleri (`top-1/2`) doğru hesaplaması sağlandı.
     * **Giriş Portları:** Sol taraftaki kırmızı giriş portu tüm düğümler için (Senaryo, Anons, Transfer, AI Agent, Menü vb.) dikeyde tam olarak ortalandı (`top-1/2` konumuna alındı) ve koordinat hesaplaması `node.y + dims.h / 2` olarak güncellenerek çizgilerle senkronize edildi.
     * **Çıkış Portları (Tek Çıkışlı Düğümler):** Sağ taraftaki mavi çıkış portu da (Anons, Transfer, Set Value, DID) dikeyde tam ortaya çekildi (`top-1/2` / `node.y + dims.h / 2` hizalamasıyla) ve bağlantı çizgilerinin kayması tamamen engellendi.
     * **Dinamik Yükseklik Entegrasyonu:** Anons ve Transfer düğümlerinin yükseklikleri (`getNodeDimensions`), eklenen anons bilgi rozetlerinin kapladığı ek alanları da (`86px` veya `92px` şeklinde) dinamik hesaba katarak kusursuz bir port oturması sağlandı.
   * **Çoklu Çıkış Bağlantı Desteği (Drag-to-Connect Fix):** Menü (`menu`) ve Senaryo (`timerule`) gibi birden fazla çıkış portuna sahip düğümlerde sürükle-bırak (drag-to-connect) özelliğinin çalışmasını engelleyen eksik olay dinleyicileri giderildi; portlara `onMouseDown` ve `onMouseUp` tetikleyicileri eklenerek bağlantı kurma özelliği başarılı kılındı.
   * **Trunk Seçici Kaldırılması:** Görsel editör üst araç çubuğundaki (toolbar) trunk seçici açılır listesi kaldırıldı, böylece akışın tüm gelen hatlara (trunk-independent) uygulanması sağlandı.
   * **Buton Güncellemesi:** Üst bar üzerindeki "KAYDET VE DAĞIT (DEPLOY)" buton metni sadeleştirilerek sadece "KAYDET" olarak güncellendi.
   * **Kart Listesi Revizyonu:** Akış şemaları listesindeki kartlarda yer alan "Bağlı Hat: ..." göstergesi, "Hat Yönlendirme: Tüm Gelen Aramalar (DID Tabanlı)" olarak güncellendi.
    * **Düğüm Menüsü ve İsim Revizyonları:**
      * `Play Node` -> `+ Anons` olarak güncellendi ve varsayılan başlığı "Anons" yapıldı. Düz metin kutusu yerine:
        * **Kayıtlı Anons Seçimi:** Sistemdeki anons ses dosyalarını (`.wav`) listeyen bir dropdown.
        * **Ses Sentezleme (TTS) Desteği:** Kullanıcının dinamik olarak okunacak metni girebileceği bir textarea alanı.
      * `Menu Node` -> `+ Menü` olarak güncellendi ve varsayılan başlığı "Menü" yapıldı. Ayrıca:
        * **Kapsamlı Tuş Matrisi Seçici:** Kullanıcının hangi tuşları (0-9, *, #, Zaman Aşımı, Hata) aktif edeceğini belirlediği interaktif bir seçim paneli eklendi. Seçilen tuşlara göre kanvas üzerindeki çıkış portları ve düğümün yüksekliği dinamik ve otomatik olarak güncellenir.
        * **Temizleme Güvencesi:** Bir tuş pasif hale getirildiğinde, o tuşun çıkış portundan diğer düğümlere uzanan bağlantılar otomatik olarak silinir.
        * **Entegre Karşılama Anonsu:** Menü düğümü içerisine de Ses Sentezleme (TTS) metin girişi veya sistemde kayıtlı anons seçimi yapabilen anons alanı entegre edildi.
        * **Gelişmiş Kart Tasarımı:** Menü kartı üstünde anons türü belirten şık rozet eklendi.
      * `setValue Node` -> Kaldırıldı.
      * `Transfer Node` -> `+ Transfer` olarak güncellendi ve varsayılan başlığı "Transfer" yapıldı. Ayrıca düz metin girişi yerine:
        * **Hedef Türü Seçimi:** Dahili Abone veya Kuyruk seçimi.
        * **Dinamik Dropdown Listeleri:** Dahili abone (1001-1004) ve kuyruk (8001-8003) listeleri arasından seçim yapabilme.
        * **Transfer Öncesi Anons Desteği:** Çağrı aktarılmadan önce arayana anons çalma opsiyonu (Ses sentezleme (TTS) metin girişi veya sistemde kayıtlı anons seçimi).
      * `TTS Node` -> Kaldırıldı (Menü içine taşınacağı için).
      * `SR Node` -> Kaldırıldı.
      * `Compare Node` -> Kaldırıldı.
      * `DID Node` -> `+ DID` olarak güncellendi ve varsayılan başlığı "DID" yapıldı.
      * `timerule Node` -> `+ Senaryo` olarak güncellendi ve varsayılan başlığı "Senaryo" yapıldı.
      * `AI Agent Node` -> `+ AI Agent` olarak güncellendi ve varsayılan başlığı "AI Agent" yapıldı. Ayrıca:
        * **Çağrı Aktarma Kuralları (Intent Routing):** Yapay zekanın görüşme esnasında belirli bir talep (Örn: `satış`, `teknik destek`) algıladığında aramayı yönlendireceği hedefleri doğrudan modal içinden ekleme paneli eklendi.
        * **Dinamik Hedef Seçici:** Aktarma kurallarında hedef türü (Dahili veya Kuyruk) ve hedef numarası (Ahmet Yılmaz, Satış Kuyruğu vb.) dinamik olarak seçilebilir.
        * **Kart Üstü Listeleme:** Eklenen transfer kuralları kanvas üzerindeki AI Agent kartının altında (`satış ➔ Dahili: 1002` şeklinde) şık bir liste halinde gösterilir ve düğümün yüksekliği bu listenin boyutuna göre otomatik/dinamik olarak uzar.
      * **`hangup` (Kapat Düğümü):** `+ Kapat` olarak toolbar'a eklendi. Çağrıyı sonlandırmak için kullanılır. Sadece **Giriş Portu** vardır (Çıkış portu yoktur).
      * **`stargate_in` / `stargate_out` (Yıldız Geçidi Portalları):** `+ YG Girişi` ve `+ YG Çıkışı` olarak toolbar'a eklendi. Aynı portal ismine (Örn: `"Ana Menü"`) sahip giriş ve çıkış düğümleri arka planda **birbiriyle eşleşir**:
        * **Görsel Bağlantı İndikatörü:** Eşleşme başarılı ise, kanvasta YG Giriş kartı etrafında cyan (turkuaz) renkli, YG Çıkış kartı etrafında ise teal (yeşilimsi mavi) renkli **şık ve parıldayan (glowing border/shadow) görsel bir aura** belirir.
        * YG Giriş düğümünde sadece **Giriş Portu**, YG Çıkış düğümünde ise sadece **Çıkış Portu** yer alır; böylece aradaki karmaşık bağlantı kabloları ortadan kaldırılarak şema görsel olarak temiz tutulur.


* Implemented automatic startup seeding in [main.py](file:///Users/anilacar/ai-project/backend/main.py) to populate standard QA questions if the database is initially empty.

### 2. LLM Evaluation Engine (`call_analyzer.py` & `main.py`)
* Updated the voice call analyzer to fetch active rules from the database, build a comprehensive prompt for Gemini (`gemini-2.5-flash`), deduct penalty scores based on violations, and write a coaching summary report.
* Designed the `analyze_chat_session` function to evaluate text message threads for social channels (Omnichannel inbox).
* Injected background tasks inside representatives' outbound message endpoints to trigger quality evaluations dynamically as they communicate.
* Exposed CRUD endpoints for QA question management:
  * `GET /api/qa/questions`
  * `POST /api/qa/questions`
  * `PUT /api/qa/questions/{id}`
  * `DELETE /api/qa/questions/{id}`
* Exposed chat session quality data query endpoint: `GET /api/omnichannel/chats/{session_id}/qa`.

### 3. Frontend Settings & Dashboard UI Panels
* Created the premium [QASettings.js](file:///Users/anilacar/ai-project/frontend/components/settings/QASettings.js) view under System Settings to edit, add, delete, and toggle QA evaluation criteria, fully adopting the application's design system tokens and custom confirm delete modals.
* Updated [SettingsPanel.js](file:///Users/anilacar/ai-project/frontend/components/settings/SettingsPanel.js) to import and present the newly registered Quality Rules panel.
* Injected the Quality Evaluation details collapsible widget inside [ReportsPanel.js](file:///Users/anilacar/ai-project/frontend/components/dashboard/ReportsPanel.js) to present quality scores, penalty points breakdowns, and constructive coaching cards.
* Enriched [OmnichannelPanel.js](file:///Users/anilacar/ai-project/frontend/components/dashboard/OmnichannelPanel.js) to show active chat QA score badges and comprehensive criteria breakdowns in the right-hand panel.
* **Akordiyon Sol Menü Sistemi:** Sol menüdeki bağlantılar, dikey sadeleşme amacıyla 5 ana gruba ayrıldı:
  * **Operasyon & İzleme:** Gerçek Zamanlı AI Pano, Canlı İzleme Paneli, Temsilci Çağrı Paneli, Ortak Gelen Kutusu.
  * **Yapay Zeka & Bilgi:** AI Temsilcileri, Bilgi Bankası (RAG), Kural & Senaryo Editörü.
  * **Çağrı & Yönlendirme:** Arama Akış Yönetimi, Dış Arama (Dialer), Randevu Takvimi, Rehber.
  * **Çağrı Raporları & Analiz:** Çağrı detaylarını modüler olarak gösteren 5 ayrı rapor seçeneği eklendi:
    * **CDR:** Arama kayıtlarının temel listesi, durumu, süresi ve temsilci not düzenleme alanları.
    * **Ses Kayıtları:** Görüşmelerin wav ses dosyalarını dinlemek üzere entegre edilmiş ses oynatıcısı paneli.
    * **Çağrı Transkripti:** Görüşmelerin müşteri, yapay zeka ve insan temsilci diyaloglarını timeline formatında sunan transkript paneli.
    * **Duygu Analizi:** Müşterinin duygu durumunu (Pozitif, Öfkeli, Nötr vs.) ve yapay zeka tarafından hazırlanan arama özetini gösteren panel.
    * **Kalite Değerlendirmeleri (QA):** Yapay zeka değerlendirme kriterleri, ceza puanı kırılımları ve yapıcı koçluk tavsiyelerini listeleyen panel.
  * **Yönetim & Ayarlar:** Sistem Ayarları, Sistem Panosu & Sağlık.
  * Grupların yanına durum belirten dönen mini chevron ikonları yerleştirildi. Tıklanarak akordiyon şeklinde daraltılıp genişletilebilir hale getirilerek menünün görsel karmaşası tamamen giderildi.

---

## 🔍 Verification & Integrity Checks
* Ran migrations and verified database seeding.
* Sent test requests to endpoint routes and successfully verified automated seed responses:
  ```json
  [
    {"id":1,"question":"Temsilci görüşme başında KVKK aydınlatma metnini okudu mu veya onay aldı mı?","max_score":15,"is_active":true},
    {"id":2,"question":"Temsilci müşterinin sözünü kesti mi veya konuşmasını böldü mü?","max_score":10,"is_active":true},
    {"id":3,"question":"Temsilci profesyonel, nazik ve yardımsever bir üslup kullandı mı?","max_score":15,"is_active":true},
    {"id":4,"question":"Temsilci müşterinin sorununu doğru anlayıp çözüm odaklı yönlendirmeler yaptı mı?","max_score":20,"is_active":true},
    {"id":5,"question":"Temsilci görüşme sonunda başka bir talebi olup olmadığını sordu mu?","max_score":10,"is_active":true}
  ]
  ```
* Checked compilation status on next.js dev server indicating clean builds without warnings or module failures.
