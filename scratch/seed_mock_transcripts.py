import asyncio
import datetime
import json
from backend.database.config import AsyncSessionLocal
from backend.database.models import Call, Transcript
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        # 1. Update call_test_deepfake
        call_df = await session.get(Call, "call_test_deepfake")
        if call_df:
            call_df.summary = "Müşteri hattına gelen çağrıda ses karakteristiği ve gecikmeler analiz edilmiş, yapay ses üretimi (Deepfake) benzerliği yüksek bulunarak sistem tarafından şüpheli arama uyarısı oluşturulmuştur."
            call_df.sentiment = "Şüpheli"
            call_df.qa_score = 45
            
            qa_report_df = {
                "total_score": 45,
                "breakdown": [
                    { "rule_id": 1, "question": "Temsilci görüşme başında KVKK aydınlatma metnini okudu mu veya onay aldı mı?", "satisfied": False, "penalty": 15, "reason": "Temsilci KVKK aydınlatma metnini hiç okumadı." },
                    { "rule_id": 2, "question": "Temsilci müşterinin sözünü kesti mi veya konuşmasını böldü mü?", "satisfied": False, "penalty": 10, "reason": "Temsilci müşterinin sözünü 2 kez böldü." },
                    { "rule_id": 3, "question": "Temsilci profesyonel, nazik ve yardımsever bir üslup kullandı mı?", "satisfied": False, "penalty": 15, "reason": "Temsilci şüpheli panik durumuna sert bir ses tonuyla yanıt verdi." },
                    { "rule_id": 4, "question": "Temsilci müşterinin sorununu doğru anlayıp çözüm odaklı yönlendirmeler yaptı mı?", "satisfied": False, "penalty": 15, "reason": "Temsilci güvenlik doğrulaması yapmadan işlemi sürdürmeye yeltendi." },
                    { "rule_id": 5, "question": "Temsilci görüşme sonunda başka bir talebi olup olmadığını sordu mu?", "satisfied": True, "penalty": 10, "reason": "" }
                ],
                "coaching_report": "Temsilcinin panik/şüpheli anlarında KVKK kurallarına ve güvenlik adımlarına daha sıkı bağlı kalması gerekmektedir."
            }
            call_df.qa_report = json.dumps(qa_report_df, ensure_ascii=False)
            
            # Delete existing transcripts for this call
            stmt = select(Transcript).where(Transcript.call_id == "call_test_deepfake")
            res = await session.execute(stmt)
            for t in res.scalars().all():
                await session.delete(t)
                
            # Add new transcripts
            session.add(Transcript(call_id="call_test_deepfake", speaker="ai", text="Merhaba, Test Teknoloji'ye hoş geldiniz. Ben yapay zeka asistanınız. Nasıl yardımcı olabilirim?", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=40)))
            session.add(Transcript(call_id="call_test_deepfake", speaker="customer", text="Merhaba, ben banka hesabım hakkında bilgi almak istiyorum, adım Ahmet.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=32)))
            session.add(Transcript(call_id="call_test_deepfake", speaker="ai", text="Güvenliğiniz için lütfen kayıtlı telefon numaranızı ve anne kızlık soyadınızın ilk iki harfini doğrulayabilir misiniz?", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=20)))
            session.add(Transcript(call_id="call_test_deepfake", speaker="customer", text="Şey... Evet, bir saniye... Doğrulayamıyorum şu an, ama acil işlem yapmam lazım.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=10)))

        # 2. Update call_test_regular
        call_reg = await session.get(Call, "call_test_regular")
        if call_reg:
            call_reg.summary = "Müşteri yeni bulut santral ürün özellikleri ve fiyatlandırma hakkında bilgi almak üzere aradı. AI asistan detaylı sunum yaptı, müşteri memnun kalarak e-posta ile yazılı teklif talep etti."
            call_reg.sentiment = "Pozitif"
            call_reg.qa_score = 100
            
            qa_report_reg = {
                "total_score": 100,
                "breakdown": [
                    { "rule_id": 1, "question": "Temsilci görüşme başında KVKK aydınlatma metnini okudu mu veya onay aldı mı?", "satisfied": True, "penalty": 15, "reason": "" },
                    { "rule_id": 2, "question": "Temsilci müşterinin sözünü kesti mi veya konuşmasını böldü mü?", "satisfied": True, "penalty": 10, "reason": "" },
                    { "rule_id": 3, "question": "Temsilci profesyonel, nazik ve yardımsever bir üslup kullandı mı?", "satisfied": True, "penalty": 15, "reason": "" },
                    { "rule_id": 4, "question": "Temsilci müşterinin sorununu doğru anlayıp çözüm odaklı yönlendirmeler yaptı mı?", "satisfied": True, "penalty": 20, "reason": "" },
                    { "rule_id": 5, "question": "Temsilci görüşme sonunda başka bir talebi olup olmadığını sordu mu?", "satisfied": True, "penalty": 10, "reason": "" }
                ],
                "coaching_report": "Harika bir görüşme performansı. KVKK ve müşteri memnuniyeti süreçleri kusursuz yürütülmüştür."
            }
            call_reg.qa_report = json.dumps(qa_report_reg, ensure_ascii=False)
            
            # Delete existing
            stmt = select(Transcript).where(Transcript.call_id == "call_test_regular")
            res = await session.execute(stmt)
            for t in res.scalars().all():
                await session.delete(t)
                
            session.add(Transcript(call_id="call_test_regular", speaker="ai", text="Merhaba, size nasıl yardımcı olabilirim?", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=50)))
            session.add(Transcript(call_id="call_test_regular", speaker="customer", text="Merhaba, bulut santral paketlerinizin fiyatlarını öğrenebilir miyim?", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=42)))
            session.add(Transcript(call_id="call_test_regular", speaker="ai", text="Tabii ki. Aylık 1000 dakikalı başlangıç paketimiz 299 TL, limitsiz paketimiz ise 599 TL'dir.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=30)))
            session.add(Transcript(call_id="call_test_regular", speaker="customer", text="Harika, bana e-posta ile bir teklif gönderebilir misiniz?", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=20)))
            session.add(Transcript(call_id="call_test_regular", speaker="ai", text="Elbette, sisteme kayıtlı mail adresinize teklifimiz iletildi. Başka bir sorunuz var mı?", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=12)))
            session.add(Transcript(call_id="call_test_regular", speaker="customer", text="Çok teşekkürler, iyi günler.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=5)))
            session.add(Transcript(call_id="call_test_regular", speaker="ai", text="İyi günler dileriz.", timestamp=datetime.datetime.utcnow()))

        # 3. Update test-call-uuid-123
        call_test = await session.get(Call, "test-call-uuid-123")
        if call_test:
            call_test.summary = "Müşteri santrali aradı fakat herhangi bir menü seçimi yapmadan ve müşteri temsilcisine bağlanamadan telefonu kapattı."
            call_test.sentiment = "Nötr"
            call_test.qa_score = 90
            
            qa_report_test = {
                "total_score": 90,
                "breakdown": [
                    { "rule_id": 1, "question": "Temsilci görüşme başında KVKK aydınlatma metnini okudu mu veya onay aldı mı?", "satisfied": True, "penalty": 15, "reason": "" },
                    { "rule_id": 2, "question": "Temsilci müşterinin sözünü kesti mi veya konuşmasını böldü mü?", "satisfied": True, "penalty": 10, "reason": "" },
                    { "rule_id": 3, "question": "Temsilci profesyonel, nazik ve yardımsever bir üslup kullandı mı?", "satisfied": True, "penalty": 15, "reason": "" },
                    { "rule_id": 4, "question": "Temsilci müşterinin sorununu doğru anlayıp çözüm odaklı yönlendirmeler yaptı mı?", "satisfied": True, "penalty": 20, "reason": "" },
                    { "rule_id": 5, "question": "Temsilci görüşme sonunda başka bir talebi olup olmadığını sordu mu?", "satisfied": False, "penalty": 10, "reason": "Görüşme yarıda kesildiğinden kapanış sorusu sorulamamıştır." }
                ],
                "coaching_report": "Genel süreç uyumludur. Erken sonlanan aramalar hariç tutulabilir."
            }
            call_test.qa_report = json.dumps(qa_report_test, ensure_ascii=False)
            
            # Delete existing
            stmt = select(Transcript).where(Transcript.call_id == "test-call-uuid-123")
            res = await session.execute(stmt)
            for t in res.scalars().all():
                await session.delete(t)
                
            session.add(Transcript(call_id="test-call-uuid-123", speaker="customer", text="Orada kimse var mı?", timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=10)))
            session.add(Transcript(call_id="test-call-uuid-123", speaker="ai", text="Temsilci bekleme sırasına alınıyorsunuz...", timestamp=datetime.datetime.utcnow()))

        await session.commit()
        print("Mock transcripts, summaries, and QA scores seeded successfully!")

if __name__ == "__main__":
    asyncio.run(main())
