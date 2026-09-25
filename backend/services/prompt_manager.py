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
            
        tone = agent.get("tone", "normal")
        tone_map = {
            "normal": "Kibar, profesyonel, net ve yardımsever bir konuşma üslubu kullan.",
            "calm": "Çok sakin, sabırlı, yavaş tempoda, yapıcı ve rahatlatıcı bir konuşma üslubu kullan.",
            "attractive": "Enerjik, neşeli, çekici, canlı ve samimi bir konuşma üslubu kullan.",
            "firm": "Ciddi, net, kararlı, kısa ve sonuç odaklı bir üslup kullan."
        }
        tone_instruction = tone_map.get(tone, tone_map["normal"])
        base_prompt += f"\n\n[KONUŞMA ÜSLUBU VE TONU]: {tone_instruction}"
    else:
        base_prompt = DEFAULT_SYSTEM_PROMPT.replace("{time_farewell}", time_farewell)
        
    prompt = base_prompt
    
    # Human Conversational Realism & Verbal Fillers
    human_realism_prompt = """

[DOĞAL İNSAN KONUŞMA VE GERÇEKÇİLİK KURALLARI]:
- Yapay zeka gibi kusursuz, soğuk veya kalıplaşmış yanıtlar verme. Tıpkı canlı bir insan müşteri temsilcisi gibi doğal konuş.
- Cümle aralarında ve düşünürken insanlara özgü doğal aradoldurma ifadeleri ve duraksamalar kullan (Örnekler: 'Hımm...', 'Anladım...', 'Şöyle ki...', 'Bir saniye kontrol ediyorum...', 'Hemen bakıyorum, çok kısa bekleteceğim...').
- Bir bilgiye bakacağın veya sorgulama yapacağın zaman doğrudan cevaba atlama, önce 'Hemen sistemden kontrol ediyorum...', 'Bir saniye bakayım...' diyerek müşteriyle canlı iletişimde kal.
- Duraksamak istediğin veya nefes alacağın yerlere '...' (üç nokta) koy. Bu sayede ses motoru gerçekçi insan nefes arası verecektir.
"""
    prompt += human_realism_prompt
    
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

        # Inject active system users directory for dynamic name-based extension transfer
        try:
            from backend.main import load_settings
            user_list = []
            try:
                from backend.database.models import SystemUser
                stmt = select(SystemUser).where(SystemUser.is_active == True)
                res = await session.execute(stmt)
                db_users = res.scalars().all()
                if db_users:
                    for u in db_users:
                        user_list.append({"full_name": u.full_name, "extension": u.extension, "role": u.role})
            except Exception:
                pass
            
            if not user_list:
                s_data = load_settings()
                for u in s_data.get("users", []):
                    if u.get("is_active", True):
                        user_list.append({"full_name": u.get("full_name"), "extension": u.get("extension"), "role": u.get("role")})

            if user_list:
                dir_prompt = "\n\n--- SİSTEM DAHİLİ VE PERSONEL REHBERİ (İSİMLE TRANSFER) ---\n"
                dir_prompt += "Arayan kişi sistemdeki bir yöneticinin, temsilcinin veya personelin adını/soyadını söyleyerek aktarılmak isterse (Örn: 'Anıl Acar ile görüşmek istiyorum', 'Ahmet Bey'e bağlar mısın'), aşağıdaki rehberden kişinin dahili numarasını bularak aktar:\n\n"
                for u in user_list:
                    fname = u.get("full_name")
                    ext = u.get("extension")
                    role = u.get("role", "temsilci")
                    if fname and ext:
                        dir_prompt += f"• {fname} -> Dahili: {ext} (Görev: {role})\n"
                dir_prompt += "\nTALİMAT: Müşteri yukarıdaki kişilerden birini talep ettiğinde:\n"
                dir_prompt += "1. 'Sizi [Kullanıcı Adı] kişisine yönlendiriyorum, lütfen ayrılmayınız.' cümlesini kur.\n"
                dir_prompt += "2. Cümlenin sonuna hemen transfer eylemini ekle: '[ACTION: TRANSFER:<DAHILI_NO>]' (örn: '[ACTION: TRANSFER:1000]').\n"
                prompt += dir_prompt
        except Exception as u_err:
            print(f"[Prompt Manager] Dahili rehber yükleme hatası: {u_err}")

    except Exception as e:
        print(f"[Prompt Manager] Kural derleme hatasi: {e}. Varsayilan prompt kullaniliyor.")
        
    return prompt.strip()
