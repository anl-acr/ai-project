from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from backend.database.config import AsyncSessionLocal
from backend.database.models import Rule

DEFAULT_SYSTEM_PROMPT = """Sen şirketimizi temsil eden güler yüzlü yapay zeka asistanı Anıl'sın. Karşındaki kişiyle canlı bir telefon görüşmesindesin. Müşterilerle doğal bir ses tonuyla, kısa ve net Türkçe cümlelerle konuş. Yazılı metin (text) çıktılarında kesinlikle İngilizce açıklamalar, planlama başlıkları, 'Initiating', 'Concluding', 'Acknowledge' gibi düşünce süreçleri veya meta-yorumlar üretme; sadece seslendirdiğin Türkçe cümlelerin birebir yazılı transkriptini üret. Müşterinin bilgi bankasında yer alan sorularını yanıtlamak için 'query_knowledge_base' aracını çalıştır. Müşterinin sorusunu yanıtladıktan veya bilgi verdikten sonra hemen arkasından mutlaka 'Yardımcı olabileceğim başka bir konu var mı?' veya benzeri bir takip sorusu yönelterek sözü müşteriye bırak. Müşteri randevu almak isterse adını, soyadını, telefon numarasını, tarih ve saat bilgilerini alarak 'book_appointment' aracını çalıştır. Müşteri yetkiliye bağlanmak isterse veya çözemediğin bir durum olursa 'transfer_to_human' aracını çalıştır. Müşterinin başka bir talebi kalmadığında vedalaşırken mutlaka '{time_farewell}' dileğinde bulun ve 'hangup_call' aracını çalıştırarak telefonu kapat."""

async def compile_system_prompt(agent: dict = None) -> str:
    """
    Fetches active rules and FAQ from the database, 
    and compiles them into a single system instruction string.
    """
    # Türkiye saatine göre dinamik vedalaşma mesajı belirleme (UTC+3)
    tz_turkey = timezone(timedelta(hours=3))
    now_tr = datetime.now(timezone.utc).astimezone(tz_turkey)
    hour = now_tr.hour
    
    if 5 <= hour < 12:
        time_farewell = "iyi günler dilerim"
    elif 12 <= hour < 18:
        time_farewell = "iyi günler dilerim"
    elif 18 <= hour < 22:
        time_farewell = "iyi akşamlar dilerim"
    else:
        time_farewell = "iyi geceler dilerim"
        
    if agent and agent.get("system_instruction"):
        base_prompt = agent["system_instruction"]
        greeting_text = agent.get("greeting_prompt", "")
        if greeting_text:
            base_prompt += f"\n\nÖNEMLİ: Müşteri telefonu açıp ilk sinyali/sesi ('Merhaba' vb.) gönderdiğinde, İLK CÜMLE OLARAK tam olarak şu şekilde yanıt ver: '{greeting_text}'"
    else:
        base_prompt = DEFAULT_SYSTEM_PROMPT.replace("{time_farewell}", time_farewell)
        
    prompt = base_prompt
    
    try:
        async with AsyncSessionLocal() as session:
            # Fetch active prompt adjustments and FAQ rules
            stmt = select(Rule).where(Rule.is_active == True)
            result = await session.execute(stmt)
            rules = result.scalars().all()
            
            if rules:
                prompt += "\n--- Yönetici Tarafından Tanımlanan Özel Kurallar ---\n"
                
                faqs = []
                routings = []
                custom_prompts = []
                
                for rule in rules:
                    if rule.rule_type == "prompt" and rule.response_text:
                        custom_prompts.append(rule.response_text)
                    elif rule.rule_type == "faq" and rule.trigger_keyword and rule.response_text:
                        faqs.append(f"- Soru/Konu: {rule.trigger_keyword} -> Cevap: {rule.response_text}")
                    elif rule.rule_type == "routing" and rule.trigger_keyword and rule.action_to_trigger:
                        routings.append(f"- Konu: {rule.trigger_keyword} -> Aksiyon: {rule.action_to_trigger} aracını çalıştır.")

                if custom_prompts:
                    prompt += "\nKarakter ve Davranış Yönergeleri:\n"
                    prompt += "\n".join(custom_prompts) + "\n"
                    
                if faqs:
                    prompt += "\nSıkça Sorulan Sorular ve Cevap Politikaları:\n"
                    prompt += "\n".join(faqs) + "\n"
                    
                if routings:
                    prompt += "\nÖzel Yönlendirme Kuralları:\n"
                    prompt += "\n".join(routings) + "\n"
                    
    except Exception as e:
        print(f"[Prompt Manager] Kural derleme hatasi: {e}. Varsayilan prompt kullaniliyor.")
        
    return prompt.strip()
