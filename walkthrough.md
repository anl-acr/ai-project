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
  - Her akış satırı zaman damgası ve durum koduna (Başarılı: yeşil, Uyarı/Yanıtsız: sarı, Başarısız: kırmızı, Sistem: mavi) göre görselleştirilmiştir.

### 11. Çağrı Transkriptleri Tablo Düzeni ve Görüşme/Özet Popup Modalları (Call Transcript Full-Width & Popups)
- Çağrı Transkriptleri sekmesi (`viewMode === "transcripts"`) eski dar liste düzeninden çıkarılıp **CDR Raporu ile aynı tam ekran (full-width) tablo yapısına** kavuşturuldu.
- Sütun görünürlüğü yönetimi ("Sütunlar" butonu) ve Excel/CSV dışa aktarım özellikleri bu ekranda da aktif hale getirildi.
- Tablonun en sağ sütununa büyüteç yerine iki adet yan yana, görsel yapıları tamamen aynı olan buton entegre edildi:
  - **Görüşme Metni Butonu (MessageSquare):** Tıklatıldığında arka uçtan (`/api/calls/:id/transcripts`) ilgili çağrıya ait konuşma dökümünü canlı olarak çeker. Müşteri, AI Asistan ve Müşteri Temsilcisi konuşmalarını sohbet balonları halinde kronolojik olarak gösteren şık bir popup modal açar.
  - **Görüşme Özet Butonu (FileText):** Tıklatıldığında çağrının veritabanındaki yapay zeka özetini (`selectedCall.summary`) gösteren aynı yapıda bir popup modal açar.

## Dosya Değişiklikleri
- [main.py](file:///Users/anilacar/ai-project/backend/main.py): `/api/calls` endpoint'ine `start_date`, `end_date`, `caller_number`, `call_id` parametreleri eklendi ve veritabanı seviyesinde dinamik filtre sorguları yazıldı. Ayrıca `/api/settings/recording-retention` GET/POST endpoint'leri eklendi. `DEFAULT_SETTINGS` ve `load_settings` rolleri ile veri migrasyonu tamamlandı.
- [index.js](file:///Users/anilacar/ai-project/frontend/pages/index.js): Sol menüye "Temsilci Notları" butonu eklendi, sekme yönlendirmeleri yapıldı ve yeni tab kaydedildi.
- [ReportsPanel.js](file:///Users/anilacar/ai-project/frontend/components/dashboard/ReportsPanel.js): CDR tablosunun sütunları güncellendi, otomatik arka plan güncelleme mantığı yazıldı, filtreleme paneli açılır popup modal haline getirildi. Sütun görünürlük checklist'i, Excel export fonksiyonu, Grafik (Analiz) paneli, Ses kayıtları tablosu, Yüzer ses oynatıcısı (Floating Player), Arama Akış Zaman Çizelgesi (Timeline Popup Modal), Çağrı Transkripti Tam Ekran Tablo Görünümü, Canlı Görüşme Metni Çekimi ve Sohbet Balonlu Transcript Popup Modal'ı ile Yapay Zeka Görüşme Özet Popup Modalı entegre edildi.
- [SettingsPanel.js](file:///Users/anilacar/ai-project/frontend/components/settings/SettingsPanel.js): Sol menüye "Ses Kayıt Ayarları" sub-tab'ı eklendi, yetki kontrolleri yapıldı ve ilgili panel entegre edildi.
- [RecordingRetentionSettings.js](file:///Users/anilacar/ai-project/frontend/components/settings/RecordingRetentionSettings.js): Ses kayıtlarının disk doluluğuna ve gün sayısına göre saklanma politikalarını yöneten modern, cam efektli ve yetki duyarlı form arayüzü yazıldı.
- [RoleSettings.js](file:///Users/anilacar/ai-project/frontend/components/settings/RoleSettings.js): `recording_retention` özelliği `SYSTEM_FEATURES` metadatasına kaydedildi.

## Doğrulama
- Frontend derleme durumu kontrol edildi. Dev sunucu başarıyla derlendi ve sıfır hata ile çalışır durumda.
- Backend FastAPI sunucusu /api/calls filtreleme sorguları, /api/settings/recording-retention API'leri ve AMI entegrasyonu ile başarıyla çalışıyor.
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

### 12. Duygu Analizi Raporu Tablo Düzeni (Sentiment Full-Width Table Layout)
- Duygu Analizi sekmesi (`viewMode === "sentiment"`) de diğer tüm rapor modülleri gibi **CDR ile aynı tam ekran (full-width) tablo yapısına** uyarlandı.
- **Duygu Durumu İndikatör Sütunu:** Tablonun en sağ tarafına **"Duygu Durumu"** başlığı altında yeni bir sütun eklenmiştir.
- **Dinamik Renk ve Görsel Kodlama:** Arama duygu durumları, premium tasarım dilimize uygun renkli rozetlerle (Pozitif/Memnun: yeşil, Negatif/Öfkeli: kırmızı, Şüpheli: sarı, Nötr: gri) doğrudan tablo hücresi içinde görselleştirilmiştir.

### 13. Kalite Değerlendirmeleri (QA) Tam Ekran Düzeni ve Manuel Düzeltme Modalı
- Kalite Değerlendirmeleri sekmesi (`viewMode === "qa"`) de **CDR ile aynı tam ekran tablo yapısına** getirilmiştir.
- **Kalite Puanı ve Detay Büyüteç Butonu:** En sağ sütuna çağrının kalite puanı (Örn: `85 / 100`) ve yanına büyüteç butonu eklenmiştir.
- **Kalite Değerlendirme & Manuel Düzeltme Modalı (Correction Popup):** Büyüteç butonuna tıklandığında açılan modalda:
  - Yapay zekanın "Evet" veya "Hayır" olarak değerlendirdiği kurallar liste halinde görünür.
  - Yöneticiler, **"Evet (Uyumlu)"** veya **"Hayır (Uyumsuz)"** seçenekleri arasında manuel düzeltme yapabilir. Seçim değiştikçe toplam kalite puanı anında gerçek zamanlı olarak yeniden hesaplanır.
  - "Hayır" durumunda kural uyumsuzluk gerekçesi ve genel yapıcı koçluk notu el ile düzenlenebilir.
  - **"Değerlendirmeyi Kaydet"** butonuna basıldığında veriler veritabanına kaydedilir ve ana tablo anında sayfa yenilenmeden güncellenir.
- **Sistem Ayarları Tab İsim Değişikliği:** Sistem Ayarlarındaki otomatik QA kuralları tabının adı kullanıcının talebi üzerine **"Kalite Değerlendirme Soruları"** olarak güncellenmiştir.

### 14. Temsilci Notları Tam Ekran Düzeni ve Konu/Not Düzenleme Modalı
- Temsilci Notları sekmesi (`viewMode === "notes"`) de **CDR ile birebir aynı tam ekran tablo düzenine** uyarlandı.
- **Temsilci Notu İndikatör Sütunu:** En sağ tarafta yer alan sütuna şık bir not defteri (Clipboard) butonu eklenmiştir.
- **Konu / Not Detay ve Düzenleme Modalı (Notes Popup Modal):** Not defteri butonuna tıklandığında açılan modalda:
  - Görüşmeye ait arayan numara ve Çağrı ID bilgileri listelenir.
  - Temsilcinin seçtiği **"Görüşme Konusu (Kategori)"** dropdown listesi (Destek, Satış, Bilgi Talebi, Şikayet, Ödeme, Diğer) görüntülenebilir ve değiştirilebilir.
  - "Diğer" seçildiğinde özel konu başlığı girişi için ek alan dinamik olarak belirir.
  - Temsilcinin yazdığı **"Temsilci Notu"** textarea alanı görüntülenebilir ve doğrudan el ile düzeltilebilir.
  - **"Notu Kaydet"** butonuna basıldığında veriler veritabanına (`POST /api/calls/{call_id}/notes` endpoint'i üzerinden) kaydedilir ve ana tablo sayfa yenilenmesine gerek kalmadan anında güncellenir.

### 15. 19 Adet Yeni Rapor Modülü ve Menü Geliştirmeleri
- Talep edilen 19 adet yeni rapor başlığı, sol menüde yer alan **"Çağrı Raporları & Analiz"** akordiyon kategorisinin altına sırasıyla eklendi.
- **Scrollable Alt Menü Tasarımı:** Menünün dikey olarak kontrolsüzce uzamasını engellemek için rapor listesi container'ı `max-h-[300px]` ve `overflow-y-auto` sınıfları ile sınırlandırılıp şık bir dikey kaydırma çubuğuna (scroll) kavuşturuldu.
- **Premium Rapor Yer Tutucuları (Placeholder Cards):** Menüden yeni raporlar seçildiğinde, her bir rapor için özel tasarlanmış cam efektli (glassmorphic) kartlar, modern Lucide simgeleri, rapor tanıtım açıklamaları ve "Çok Yakında" ibaresi barındıran zengin tasarımlı yer tutucu ekranlar görüntülenmektedir.

### 16. Gelişmiş Analiz ve KPI Panosu (Dashboard) Entegrasyonu
- **Üst Kısım Özet Sayaçları (Top KPIs):** Toplam çağrı, AI çözüm oranı (FCR), SLA uyum yüzdesi, kaçan çağrı sayısı, ortalama görüşme süresi ve toplam konuşma süresi olmak üzere 6 adet premium görsel sayaç kartı tasarlandı.
- **CEO Yönetici Özeti (AI Analizi):** Filtrelenmiş çağrı verilerine (toplam arama sayısı, başarı oranları, FCR, SLA uyumu ve en yoğun konu eğilimleri) dayalı olarak reaktif ve dinamik olarak değişen yapay zeka özet paragrafı kutusu entegre edildi.
- **Orta Operasyon Bölümü (Line Charts):**
  - **Saatlik Çağrı Yoğunluğu:** Gelen vs. Cevaplanan çağrı adetlerini gösteren çift hatlı dinamik SVG çizgi grafiği.
  - **SLA Uyum Trendi:** Hedef çizgisi (%85) içeren saatlik SLA uyum yüzdesi eğilimi çizgi grafiği.
- **AI ve Temsilci Kalite Analitiği (Bottom Section):**
  - **AI vs. İnsan Performansı:** Ortalama çağrı süresi (AHT) ve İlk aramada çözüm (FCR) oranlarını yan yana karşılaştıran interaktif bar grafiği.
  - **Kuyruk Terk Süresi Dağılımı:** 0-10sn, 10-30sn, 30-60sn, +60sn bekleme sürelerine göre yatay ilerleme çubuğu grafiği.
  - **Müşteri Duygu Dağılımı:** Pozitif, Nötr ve Öfkeli durumlarını gösteren 3 renkli Donut/Dairesel grafik ve alt kilit kartları.
  - **Çağrı Kök Neden Dağılımı:** Müşteri sorunlarının kategorilere (Kargo, İade, Fatura, Bilgi, Destek) göre ağırlıklı gösterimi.
  - **AI & Temsilci Kalite Kriterleri:** KVKK Uyum, Söz Kesmeme, Nezaket ve Ürün Bilgisi uyum skorları gösterge çubukları.
- **İnovatif Görseller:**
  - **Konu Trendleri Word Cloud (Kelime Bulutu):** Görüşmelerde geçen sıcak kelimeleri ("Kargo Gecikti", "İade Talebi", "AI Agent") boyutlarına göre görselleştiren dinamik bulut.
  - **Müşteri Çile Huni Grafiği (Friction Funnel):** IVR Giriş, Menü Tuşlama, AI Bağlantısı ve Terk adımlarını gösteren görsel huni (funnel) grafiği.
- **Granular Permission Yetkilendirme Entegrasyonu:**
  - `SYSTEM_FEATURES` metadatasına `reports` (Gelişmiş Çağrı Raporları ve KPI Panosu) modülü access yetkisi (`reports:access`) eklendi.
  - Backend settings loader `load_settings()` içine otomatik migration kodları eklenerek mevcut `admin`, `supervisor` ve `agent` rollerine `reports:access` yetkisi tanımlandı.
  - Frontend sol menüsündeki tüm Çağrı Raporları & Analiz sekmesi yetkilendirme kontrolüne (`hasReportsPermission`) bağlandı.
- **Pano Görünümü İyileştirmeleri:**
  - Pano görünümünde "Excel'e Aktar" butonu kaldırıldı.
  - Gün içinde hiç çağrı olmasa bile (boş veri kümesi durumunda) "Kayıt bulunamadı" uyarısı yerine, tüm grafiklerin sıfır/boş değerlerle reaktif olarak render edilmesi sağlandı.
  - **Pencereler Seçim Paneli Entegrasyonu:** Pano moduna özel bir "Pencereler" açılır paneli eklenerek kullanıcının istediği grafikleri veya özet pencerelerini (CEO Yönetici Özeti, Saatlik Çağrı Yoğunluğu, SLA Trendi, AI vs İnsan, Terk Süreleri, Duygu Dağılımı, Kök Nedenler, Kalite Kriterleri, Kelime Bulutu, Çile Hunisi) tek bir tıklamayla dinamik olarak açıp kapatabilmesi sağlandı.
  - **SLA Uyum Trendi Grafiği Düzeltmeleri:**
    * **Örtüşme Hatası Giderildi:** Sağ tarafta yer alan kırmızı "SLA Hedefi (%85)" etiketinin, %90 değerindeki veri çizgisiyle çakışarak okunmaz hale gelmesi engellendi; etiket sol tarafa (`textAnchor="start"`) kaydırıldı.
    * **Varsayılan Değer İyileştirmesi:** Gün içerisinde hiç çağrı olmaması durumunda grafiğin boş olması (0%) yerine suni %90 gösteren düz çizgi çizmesi düzeltildi; çağrı olmayan saatlerde uyum oranı %0 olarak güncellendi.
    * **Nokta Renkleri Düzeltildi:** CSS sınıf adındaki yazım hatası (`fill-indigo-650`) düzeltilerek grafik noktalarının siyah yerine premium mor/indigo (`fill-indigo-600`) renk tonuyla parlaması sağlandı.
  - **AI vs. İnsan Performansı Grafiği Düzeltmeleri:**
    * **Taşma ve Kırpılma Sorunu Giderildi:** Değerlerin 0 olması durumunda (örneğin AHT 0sn veya FCR %0), genişlik değeri sıfır olan bar sütunları içerisindeki metinlerin ("AI", "İnsan") kutunun sol kenarına taşarak üst üste binmesi (`overflow-hidden`) ve koşullu metin render etme (`AHT > 0`, `FCR > 0`) yöntemleriyle tamamen giderildi.
- **Santral Sidebar Menü Yeniden Yapılandırması:**
  - Sol menüye "Yapay Zeka & Bilgi" ile "Çağrı & Yönlendirme" başlıkları arasına gelecek şekilde **Santral** ana kategorisi eklendi.
  - **Eski Alanların Taşınması:**
    * **Kullanıcılar:** "Sistem Ayarları" (`SettingsPanel`) içinden çıkarılarak Santral menüsü altına birinci sıraya taşındı.
    * **Rehber:** "Çağrı & Yönlendirme" altından çıkarılarak Santral menüsü altına taşındı.
    * **Dış Hat Tanımı:** "Sistem Ayarları" (`SettingsPanel.js`) altındaki "Dış Hat Entegrasyonu" (`PBXSettings viewMode="trunks"`) Santral altına taşındı.
    * **Numara Engelleme:** "Sistem Ayarları" (`SettingsPanel.js`) altındaki "Kara Liste" (`BlacklistSettings`) Santral altına "Numara Engelleme" başlığıyla taşındı.
  - **Yeni Eklenen Boş Şablonlar:** Aşağıdaki özellikler için geçici olarak premium "Çok Yakında" boş şablonları eklendi:
    * Anons Yönetimi, ACD Kuyruk, Oto Provizyon, Giden Arama Kuralı, Gelen Arama Kuralı, Çağrı Toplama Grubu, Konferans, Hızlı Arama.
- **Yönetim & Ayarlar Menüsü Altına Olay Günlükleri Eklendi:**
  - Sol menüdeki **Yönetim & Ayarlar** grubunun altına üçüncü seçenek olarak **Olay Günlükleri** butonu yerleştirildi.
  - Tıklandığında gösterilmek üzere premium tasarım diliyle uyumlu reaktif "Çok Yakında" boş şablon alanı entegre edildi.

## Dosya Değişiklikleri
- [main.py](file:///Users/anilacar/ai-project/backend/main.py): `/api/calls` endpoint'ine `start_date`, `end_date`, `caller_number`, `call_id` parametreleri eklendi ve veritabanı seviyesinde dinamik filtre sorguları yazıldı. `load_settings` rolleri ile veri migrasyonu (`reports:access` yetki entegrasyonu) tamamlandı.
- [index.js](file:///Users/anilacar/ai-project/frontend/pages/index.js): Sol menüye Santral kategorisi, 12 alt sekme, pbxGroup reaktif state'leri, renderPlaceholderSantral şablon oluşturucusu, taşınan bileşenlerin (UserSettings, PBXSettings, BlacklistSettings) import ve conditional rendering blokları eklendi. Yönetim & Ayarlar altına "Olay Günlükleri" butonu ve placeholder render alanı tanımlandı.
- [ReportsPanel.js](file:///Users/anilacar/ai-project/frontend/components/dashboard/ReportsPanel.js): `getChartData()` fonksiyonu genişletilerek SLA uyumu, FCR, terk süreleri, duygu ve kategori dağılımları eklendi. `viewMode === "pano"` durumunda render edilmek üzere premium KPI kartları, AI CEO Yönetici Özeti, SVG Çizgi Grafikleri (Saatlik çağrı yoğunluğu & SLA trendi), AI vs İnsan bar grafikleri, yatay terk barı, donut grafikler, kelime bulutu ve çile hunisi grafikleri entegre edildi. Pano modunda Excel butonu kaldırıldı, boş durum toleransı sağlandı ve pencereleri dinamik gizleyip açan `visiblePanels` kontrol paneli yerleştirildi.
- [SettingsPanel.js](file:///Users/anilacar/ai-project/frontend/components/settings/SettingsPanel.js): Sistem ayarlarından Dış Hat Entegrasyonu, Kullanıcılar ve Kara Liste sub-tab'leri, butonları ve rendering conditional'ları tamamen kaldırılarak kod sadeleştirildi.
- [RoleSettings.js](file:///Users/anilacar/ai-project/frontend/components/settings/RoleSettings.js): `reports` özelliği `SYSTEM_FEATURES` metadatasına kaydedildi.

## Doğrulama
- Frontend derleme durumu kontrol edildi. Dev sunucu başarıyla derlendi ve sıfır hata ile çalışır durumda.
- Backend FastAPI sunucusu /api/calls filtreleme sorguları, AMI entegrasyonu ve rol yetkilendirme migrasyonları ile başarıyla çalışıyor.
