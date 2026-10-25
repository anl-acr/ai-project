import os
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from backend.database.config import AsyncSessionLocal
from backend.database.models import Rule

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SETTINGS_FILE = os.path.join(_BACKEND_DIR, "settings.json")

DEFAULT_SYSTEM_PROMPT = """Sen şirketimizi temsil eden güler yüzlü yapay zeka asistanı Anıl'sın. Karşındaki kişiyle canlı bir telefon görüşmesindesin. Müşterilerle doğal bir ses tonuyla, kısa ve net Türkçe cümlelerle konuş. Yazılı metin (text) çıktılarında kesinlikle İngilizce açıklamalar, planlama başlıkları, 'Initiating', 'Concluding', 'Acknowledge' gibi düşünce süreçleri veya meta-yorumlar üretme; sadece seslendirdiğin Türkçe cümlelerin birebir yazılı transkriptini üret. Müşterinin sorularını öncelikle sana verilen ZORUNLU KURAL VE SORU-CEVAP (FAQ) LİSTESİNDEN, Senaryo Kurallarından ve Bilgi Bankasından yararlanarak doğrudan yanıtla. Sorusunu yanıtladıktan veya bilgi verdikten sonra hemen arkasından mutlaka 'Yardımcı olabileceğim başka bir konu var mı?' veya benzeri bir takip sorusu yönelterek sözü müşteriye bırak. Müşterinin başka bir talebi kalmadığında vedalaşırken mutlaka '{time_farewell}' dileğinde bulun."""


def _load_settings_json() -> dict:
    if os.path.exists(_SETTINGS_FILE):
        try:
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Prompt Manager] settings.json okuma hatasi: {e}")
    return {}


def _compile_scenario_flow(scenario_flow: dict) -> str:
    if not scenario_flow or not isinstance(scenario_flow, dict):
        return ""
    nodes = scenario_flow.get("nodes", [])
    if not nodes:
        return ""
    compiled_parts = ["=== AI TEMSİLCİ SENARYO VE DAVRANIŞ AKIŞ KURALLARI ==="]
    greeting_nodes = [n for n in nodes if n.get("type") == "greeting"]
    if greeting_nodes:
        g_text = greeting_nodes[0].get("data", {}).get("text", "")
        if g_text:
            compiled_parts.append(f"• KARŞILAMA VE AÇILIŞ: Görüşme başladığında doğrudan şu cümle ile başla: '{g_text}'")
    dialogue_nodes = [n for n in nodes if n.get("type") == "dialogue"]
    if dialogue_nodes:
        compiled_parts.append("\n• KONUŞMA REHBERİ VE CEVAP ŞABLONLARI:")
        for idx, dn in enumerate(dialogue_nodes, 1):
            title = dn.get("title", f"Adım {idx}")
            script = dn.get("data", {}).get("script", "")
            if script:
                compiled_parts.append(f"  - [{title}]: {script}")
    intent_nodes = [n for n in nodes if n.get("type") == "intent_branch"]
    if intent_nodes:
        compiled_parts.append("\n• MÜŞTERİ NİYETİNE GÖRE DALLANMA VE YÖNLENDİRME:")
        for in_node in intent_nodes:
            intents = in_node.get("data", {}).get("intents", [])
            for intent in intents:
                lbl = intent.get("label", "")
                if lbl:
                    compiled_parts.append(f"  - Eğer {lbl}: Bu senaryo adımına uygun rehberliği takip et.")
    dir_nodes = [n for n in nodes if n.get("type") == "directory_lookup"]
    for dn in dir_nodes:
        announcement = dn.get("data", {}).get("announcement", "Sizi aradığınız kişiye yönlendiriyorum, lütfen hatta kalınız.")
        fallback = dn.get("data", {}).get("fallback_target", "1000")
        compiled_parts.append("\n• İSİMLE DAHİLİ VE PERSONEL REHBERİ TRANSFERİ (AKTİF):")
        compiled_parts.append("  - Arayan kişi belirli bir temsilcinin, kullanıcının veya personelin adını/soyadını söylediğinde:")
        compiled_parts.append("    1. Sistem Dahili Rehberindeki ismi eşleştir.")
        compiled_parts.append(f"    2. Müşteriye kibarca '{announcement}' de.")
        compiled_parts.append("    3. Hemen '[ACTION: TRANSFER:<DAHILI_NO>]' eylemini tetikle (örn: '[ACTION: TRANSFER:1000]').")
        compiled_parts.append(f"    4. Eğer aranan kişi rehberde bulunamazsa '{fallback}' dahili numarasına aktar ('[ACTION: TRANSFER:{fallback}]').")
    kvkk_nodes = [n for n in nodes if n.get("type") == "kvkk"]
    for kn in kvkk_nodes:
        c_text = kn.get("data", {}).get("consent_text", "")
        if c_text:
            compiled_parts.append(f"\n• KVKK & KİŞİSEL VERİ ONAYI: İşlem öncesinde müşteriye açıkça sor: '{c_text}' ve müşterinin sözlü onayını al.")
    form_nodes = [n for n in nodes if n.get("type") == "form_capture"]
    for fn in form_nodes:
        fields = fn.get("data", {}).get("fields", [])
        if fields:
            fields_str = ", ".join([str(f) for f in fields])
            compiled_parts.append(f"\n• BİLGİ TOPLAMA VE FORM DOLDURMA: Müşteriden sırasıyla şu bilgileri iste ve kaydet: {fields_str}.")
    transfer_nodes = [n for n in nodes if n.get("type") == "transfer"]
    for tn in transfer_nodes:
        target = tn.get("data", {}).get("target", "200")
        announcement = tn.get("data", {}).get("announcement", "Aktarılıyor...")
        compiled_parts.append(f"\n• ARAMA TRANSFERİ: Müşteri temsilciye bağlanmak istediğinde veya çözülemeyen bir konuda önce '{announcement}' de ve hemen '[ACTION: TRANSFER:{target}]' tetikle. Transfer Hedefi: {target}")
    hangup_nodes = [n for n in nodes if n.get("type") == "hangup"]
    for hn in hangup_nodes:
        farewell = hn.get("data", {}).get("farewell", "İyi günler dileriz.")
        compiled_parts.append(f"\n• ÇAĞRI KAPATMA: Görüşme tamamlandığında '{farewell}' de ve hemen '[ACTION: HANGUP]' tetikle.")
    return "\n".join(compiled_parts)


async def get_active_rules_list() -> list:
    """
    Fetches active rules from both PostgreSQL Rule table and settings.json fallback,
    returning a deduplicated list of dicts.
    """
    collected = []
    seen_keys = set()

    # 1. Fetch from PostgreSQL / SQLite database
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Rule).where(Rule.is_active == True).order_by(Rule.id.asc())
            result = await session.execute(stmt)
            db_rules = result.scalars().all()
            for r in db_rules:
                item = {
                    "id": r.id,
                    "rule_type": (r.rule_type or "faq").strip(),
                    "trigger_keyword": (r.trigger_keyword or "").strip(),
                    "response_text": (r.response_text or "").strip(),
                    "action_to_trigger": (r.action_to_trigger or "").strip(),
                    "is_active": bool(r.is_active) if r.is_active is not None else True
                }
                dedup_key = (item["rule_type"], item["trigger_keyword"].lower(), item["response_text"].lower(), item["action_to_trigger"])
                if dedup_key not in seen_keys:
                    seen_keys.add(dedup_key)
                    collected.append(item)
    except Exception as e:
        print(f"[Prompt Manager] DB Rule okuma hatasi: {e}")

    # 2. Merge any active rules from settings.json fallback
    try:
        s_data = _load_settings_json()
        for sr in s_data.get("rules", []):
            if not isinstance(sr, dict) or not sr.get("is_active", True):
                continue
            item = {
                "id": sr.get("id"),
                "rule_type": (sr.get("rule_type") or "faq").strip(),
                "trigger_keyword": (sr.get("trigger_keyword") or "").strip(),
                "response_text": (sr.get("response_text") or "").strip(),
                "action_to_trigger": (sr.get("action_to_trigger") or "").strip(),
                "is_active": True
            }
            dedup_key = (item["rule_type"], item["trigger_keyword"].lower(), item["response_text"].lower(), item["action_to_trigger"])
            if dedup_key not in seen_keys:
                seen_keys.add(dedup_key)
                collected.append(item)
    except Exception as e:
        print(f"[Prompt Manager] settings.json Rule okuma hatasi: {e}")

    return collected


def build_mandatory_rules_block(rules: list, agent: dict = None) -> str:
    """
    Formats visual scenario instructions and Rule Editor rules (FAQ, Prompt, Routing)
    into a high-priority instruction block that overrides generic 'bilmiyorum' responses.
    """
    blocks = []

    # 1. Agent Scenario Flow (from Visual Scenario Editor)
    if agent and isinstance(agent, dict):
        scenario_inst = (agent.get("compiled_scenario_instruction") or "").strip()
        if not scenario_inst and agent.get("scenario_flow"):
            scenario_inst = _compile_scenario_flow(agent.get("scenario_flow"))
        if scenario_inst:
            blocks.append(f"\n{scenario_inst}\n")

    # 2. Rules from Kural & Senaryo Editörü
    if rules:
        faqs = []
        routings = []
        custom_prompts = []

        for rule in rules:
            r_type = rule.get("rule_type")
            kw = rule.get("trigger_keyword", "")
            resp = rule.get("response_text", "")
            act = rule.get("action_to_trigger", "")

            if r_type == "prompt" and resp:
                custom_prompts.append(f"• {resp}")
            elif r_type == "faq" and kw and resp:
                faqs.append(f"• [Soru / Anahtar Kelime / Konu]: \"{kw}\"\n  -> [VERİLECEK KESİN CEVAP]: {resp}")
            elif r_type == "routing" and kw and act:
                if act == "transfer_to_human":
                    routings.append(
                        f"• Müşteri \"{kw}\" konusundan bahsettiğinde veya bu talebi ilettiğinde: "
                        f"Müşteriye kibarca canlı müşteri temsilcisine aktardığını söyle ve yanıtının sonuna '[ACTION: TRANSFER]' ekle."
                    )
                elif act == "book_appointment":
                    routings.append(
                        f"• Müşteri \"{kw}\" konusundan bahsettiğinde: "
                        f"Müşteriden Ad Soyad, Telefon, Tarih ve Saat bilgilerini isteyerek randevu kaydı oluştur "
                        f"('[ACTION: TOOL_CALL name=\"randevu_olustur\" date=\"YYYY-MM-DD\" time=\"HH:MM\" customer_name=\"...\"]')."
                    )
                else:
                    routings.append(f"• Konu: \"{kw}\" -> Aksiyon: {act}")

        if custom_prompts:
            blocks.append(
                "\n=== YÖNETİCİ TARAFINDAN TANIMLANAN ZORUNLU KARAKTER, DAVRANIŞ VE SENARYO KURALLARI ===\n"
                "Aşağıdaki talimatlar Kural ve Senaryo Editörü üzerinden tanımlanmıştır. Bu kurallara harfiyen uymak ZORUNDASIN:\n"
                + "\n".join(custom_prompts) + "\n"
            )

        if faqs:
            blocks.append(
                "\n=== ZORUNLU SORU-CEVAP (FAQ) VE KESİN BİLGİ KURAL TABANI (EN YÜKSEK ÖNCELİK) ===\n"
                "ÇOK ÖNEMLİ KESİN TALİMAT: Müşteri aşağıdaki anahtar kelimeleri, soruları, konuları veya bunlarla aynı/benzer anlama gelen ifadeleri sorduğunda "
                "KESİNLİKLE 'bilmiyorum', 'bu konuda bilgim yok' veya 'sistemde göremiyorum' DEME! "
                "Doğrudan aşağıda ilgili sorunun karşısında yer alan [VERİLECEK KESİN CEVAP] bilgisini esas alarak Türkçe, doğal ve net bir şekilde yanıtla:\n\n"
                + "\n\n".join(faqs) + "\n"
            )

        if routings:
            blocks.append(
                "\n=== ZORUNLU ÖZEL YÖNLENDİRME VE AKSİYON KURALLARI ===\n"
                + "\n".join(routings) + "\n"
            )

    return "\n".join(blocks)


async def compile_system_prompt(agent: dict = None) -> str:
    """
    Fetches active rules, FAQ, and scenario flow from the database and settings,
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
        role_title = agent.get("role_title", "")
        if role_title:
            base_prompt = f"[TEMSİLCİ UNVANI / GÖREVİ: {role_title}]\n" + base_prompt

        greeting_text = agent.get("greeting_prompt", "")
        if greeting_text:
            base_prompt += f"\n\nÖNEMLİ: Müşteri telefonu açıp ilk sinyali/sesi ('Merhaba' vb.) gönderdiğinde, İLK CÜMLE OLARAK tam olarak şu şekilde yanıt ver: '{greeting_text}'"

        farewell_text = agent.get("farewell_prompt", "")
        if farewell_text:
            base_prompt += f"\n\n[KAPANIŞ VE VEDALAŞMA CÜMLESİ]: Görüşme tamamlandığında ve vedalaşırken şu kapanış ifadesini kullan: '{farewell_text}'"

        tone = agent.get("tone", "normal")
        tone_map = {
            "normal": "Kibar, profesyonel, net ve yardımsever bir konuşma üslubu kullan.",
            "calm": "Çok sakin, sabırlı, yavaş tempoda, yapıcı ve rahatlatıcı bir konuşma üslubu kullan.",
            "attractive": "Enerjik, neşeli, çekici, canlı ve samimi bir konuşma üslubu kullan.",
            "firm": "Ciddi, net, kararlı, kısa ve sonuç odaklı bir üslup kullan."
        }
        tone_instruction = tone_map.get(tone, tone_map["normal"])
        base_prompt += f"\n\n[KONUŞMA ÜSLUBU VE TONU]: {tone_instruction}"

        speaking_rate = float(agent.get("speaking_rate", 1.0) or 1.0)
        if speaking_rate < 0.92:
            base_prompt += "\n[KONUŞMA HIZI]: Normalden daha yavaş, tane tane ve anlaşılır bir tempoda konuş."
        elif speaking_rate > 1.08:
            base_prompt += "\n[KONUŞMA HIZI]: Dinamik, seri ve akıcı bir tempoda konuş."
    else:
        base_prompt = DEFAULT_SYSTEM_PROMPT.replace("{time_farewell}", time_farewell)

    prompt = base_prompt

    # Human Conversational Realism & Verbal Fillers (Configurable per Agent)
    human_fillers_enabled = True if not agent else agent.get("human_fillers_enabled", True)
    backchannel_enabled = True if not agent else agent.get("backchannel_enabled", True)
    allow_directory_transfer = True if not agent else agent.get("allow_directory_transfer", True)

    if human_fillers_enabled:
        human_realism_prompt = """

[DOĞAL İNSAN KONUŞMA VE GERÇEKÇİLİK KURALLARI]:
- Yapay zeka gibi kusursuz, soğuk veya kalıplaşmış yanıtlar verme. Tıpkı canlı bir insan müşteri temsilcisi gibi doğal konuş.
- Cümle başlarında ve geçişlerde insanlara özgü doğal ifadeler kullan (Örnekler: 'Tabii, hemen bilgi vereyim...', 'Memnuniyetle paylaşayım...', 'Şöyle ki...').
- Müşteri bir soru sorduğunda cevabı geciktirmeden, aynı konuşma turu içinde net ve eksiksiz olarak ver.
- Duraksamak istediğin veya nefes alacağın yerlere '...' (üç nokta) koy. Bu sayede ses motoru gerçekçi insan nefes arası verecektir.
"""
        prompt += human_realism_prompt

    if backchannel_enabled:
        prompt += "\n[AKTİF DİNLEME VE ONAYLAMA (BACKCHANNELING)]: Müşterinin söylediklerini dikkatle dinlediğini hissettirmek için yanıtlarına doğal onaylama ifadeleriyle ('Anlıyorum', 'Tabii ki', 'Çok haklısınız', 'Memnuniyetle') başla.\n"

    try:
        active_rules = await get_active_rules_list()
        rules_block = build_mandatory_rules_block(active_rules, agent)
        if rules_block:
            prompt += "\n" + rules_block
            print(f"[Prompt Manager] {len(active_rules)} aktif kural ve senaryo talimatı sisteme işlendi.")

        # Inject active system users directory for dynamic name-based extension transfer
        if allow_directory_transfer:
            try:
                user_list = []
                try:
                    from backend.database.models import SystemUser
                    async with AsyncSessionLocal() as session:
                        stmt = select(SystemUser).where(SystemUser.is_active == True)
                        res = await session.execute(stmt)
                        db_users = res.scalars().all()
                        if db_users:
                            for u in db_users:
                                user_list.append({"full_name": u.full_name, "extension": u.extension, "role": u.role})
                except Exception:
                    pass

                if not user_list:
                    s_data = _load_settings_json()
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

