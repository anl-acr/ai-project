import datetime
import uuid
from sqlalchemy import select
from backend.database.config import AsyncSessionLocal
from backend.database.models import ChatSession, ChatMessage, Contact, BlacklistItem, BlockWord
from backend.services.rag_service import get_genai_client
from backend.services.websocket_manager import ws_manager

def load_settings():
    import json
    import os
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "settings.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Settings] Error loading settings in chat_service: {e}")
    return {}

async def auto_blacklist_sender(channel: str, sender_info: str, reason: str):
    from backend.main import add_system_log
    async with AsyncSessionLocal() as session:
        stmt = select(BlacklistItem).where(BlacklistItem.value == sender_info)
        res = await session.execute(stmt)
        if not res.scalar_one_or_none():
            item = BlacklistItem(
                type="email" if channel.lower() == "mail" else "phone",
                value=sender_info,
                reason=reason,
                timestamp=datetime.datetime.utcnow()
            )
            session.add(item)
            await session.commit()
            print(f"[Abuse Shield] Auto-blacklisted sender: {sender_info} (Reason: {reason})")
            add_system_log("ABUSE_SHIELD", "WARNING", f"Gönderici Kara Listeye Alındı: {sender_info} (Sebep: {reason})")

async def handle_inbound_chat_message(channel: str, sender_info: str, text: str):
    """
    Handles an incoming customer chat message from social channels (whatsapp, instagram, telegram, facebook, mail).
    Creates or loads the active session, saves the message, broadcasts it, and generates an automated AI reply
    using Gemini API if the session is currently assigned to the AI.
    """
    print(f"[Chat Service] Inbound message from {sender_info} on channel {channel}: '{text}'")
    
    async with AsyncSessionLocal() as session:
        # Check blacklist
        stmt_black = select(BlacklistItem).where(BlacklistItem.value == sender_info)
        res_black = await session.execute(stmt_black)
        blacklisted = res_black.scalar_one_or_none()
        
        if blacklisted:
            print(f"[Abuse Shield] Ignored message from blacklisted sender: {sender_info}")
            return "Görüşmeniz suistimal tespiti nedeniyle sistem tarafından otomatik olarak sonlandırılmıştır."

        # Check block words match on incoming text
        stmt_bw = select(BlockWord)
        res_bw = await session.execute(stmt_bw)
        block_words = [bw.word.lower() for bw in res_bw.scalars().all()]
        text_lower = text.lower()
        matched_word = None
        for w in block_words:
            if w in text_lower:
                matched_word = w
                break
                
        if matched_word:
            reason = f"Yasaklı Kelime Tespiti: '{matched_word}'"
            await auto_blacklist_sender(channel, sender_info, reason)
            
            # Close/create closed session
            stmt_sess = select(ChatSession).where(
                ChatSession.channel == channel,
                ChatSession.sender_info == sender_info,
                ChatSession.status == "active"
            )
            res_sess = await session.execute(stmt_sess)
            chat_session = res_sess.scalar_one_or_none()
            if not chat_session:
                chat_session = ChatSession(
                    id=str(uuid.uuid4()),
                    channel=channel,
                    sender_info=sender_info,
                    status="closed",
                    assigned_agent="ai"
                )
                session.add(chat_session)
            else:
                chat_session.status = "closed"
                
            db_message = ChatMessage(
                session_id=chat_session.id,
                direction="inbound",
                sender="customer",
                text=text
            )
            session.add(db_message)
            
            db_reply = ChatMessage(
                session_id=chat_session.id,
                direction="outbound",
                sender="ai",
                text="Görüşmeniz suistimal tespiti nedeniyle sistem tarafından otomatik olarak sonlandırılmıştır."
            )
            session.add(db_reply)
            await session.commit()
            
            # Broadcast updates
            await ws_manager.broadcast_omnichannel_event({
                "type": "session_update",
                "session": {
                    "id": chat_session.id,
                    "channel": channel,
                    "sender_info": sender_info,
                    "status": "closed",
                    "assigned_agent": "ai",
                    "last_message_time": datetime.datetime.utcnow().isoformat(),
                    "last_message_text": db_reply.text
                }
            })
            return db_reply.text
    
    async with AsyncSessionLocal() as session:
        # Resolve sender name from Contact directory
        stmt_contacts = select(Contact)
        res_contacts = await session.execute(stmt_contacts)
        contacts = res_contacts.scalars().all()
        contact_by_phone = {c.phone_number: f"{c.first_name} {c.last_name}" for c in contacts}
        contact_by_email = {c.email: f"{c.first_name} {c.last_name}" for c in contacts if c.email}
        
        sender_name = None
        if channel.lower() == "mail":
            sender_name = contact_by_email.get(sender_info)
        else:
            sender_name = contact_by_phone.get(sender_info)

        # 1. Fetch active session or create new one
        stmt = select(ChatSession).where(
            ChatSession.channel == channel,
            ChatSession.sender_info == sender_info,
            ChatSession.status == "active"
        )
        result = await session.execute(stmt)
        chat_session = result.scalar_one_or_none()
        
        is_new = False
        if not chat_session:
            is_new = True
            chat_session = ChatSession(
                id=str(uuid.uuid4()),
                channel=channel,
                sender_info=sender_info,
                status="active",
                assigned_agent="ai"
            )
            session.add(chat_session)
            await session.commit()
            print(f"[Chat Service] Created new chat session: {chat_session.id}")
        else:
            chat_session.last_message_time = datetime.datetime.utcnow()
            await session.commit()
            
        session_id = chat_session.id
        assigned_agent = chat_session.assigned_agent

        # 2. Save the inbound message from customer
        db_message = ChatMessage(
            session_id=session_id,
            direction="inbound",
            sender="customer",
            text=text
        )
        session.add(db_message)
        await session.commit()
        await session.refresh(db_message)

        # 3. Broadcast the inbound message and session updates to WebSocket
        msg_payload = {
            "id": db_message.id,
            "session_id": session_id,
            "direction": db_message.direction,
            "sender": db_message.sender,
            "text": db_message.text,
            "timestamp": db_message.timestamp.isoformat()
        }
        
        await ws_manager.broadcast_omnichannel_event({
            "type": "message",
            "message": msg_payload
        })

        await ws_manager.broadcast_omnichannel_event({
            "type": "session_update",
            "session": {
                "id": session_id,
                "channel": channel,
                "sender_info": sender_info,
                "sender_name": sender_name,
                "status": chat_session.status,
                "assigned_agent": assigned_agent,
                "last_message_time": chat_session.last_message_time.isoformat(),
                "last_message_text": text
            }
        })

        # 4. If assigned agent is AI, generate response
        if assigned_agent == "ai":
            # Fetch message history for context
            stmt_hist = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc())
            hist_res = await session.execute(stmt_hist)
            history = hist_res.scalars().all()
            
            chat_history_str = []
            for h in history:
                speaker = "Müşteri"
                if h.sender == "ai":
                    speaker = "Yapay Zeka Temsilcisi"
                elif h.sender == "human":
                    speaker = "Müşteri Temsilcisi"
                chat_history_str.append(f"{speaker}: {h.text}")
                
            history_context = "\n".join(chat_history_str)

            # Gemini client prompt
            prompt = f"""
Sen bir ortak gelen kutusu (Omnichannel) müşteri temsilcisi yapay zeka asistanısın.
Kanallar: WhatsApp, Instagram, Telegram, Facebook ve E-posta.
Şu anki kanal: {channel.upper()}
Müşteri Adresi/Bilgisi: {sender_info}

Müşterinin gönderdiği tüm geçmiş mesajları ve cevaplarımızı inceleyerek, en son mesajına uygun, nazik, net, yardımsever ve çözüm odaklı bir yanıt oluştur.
Yanıtını kesinlikle Türkçe olarak yaz.
Karşı tarafın kanal türüne (örn: mail ise biraz daha resmi/eposta formatında, whatsapp/instagram ise daha samimi ve emoji destekli) uygun bir üslup kullan.

[SOHBET GEÇMİŞİ]
{history_context}

[TALİMATLAR]
- Müşterinin son sorusuna doğrudan cevap ver.
- Temsilci devralması veya karmaşık işlemler gerekirse (örn: iade onaylama, teknik sorun) müşteriye "Sizi bir müşteri temsilcisine aktarıyorum, lütfen bekleyin." diyerek durumu belirt.
- Müşterinin son mesajında küfür, hakaret, tehdit, taciz veya bariz bir dolandırıcılık teşebbüsü (AI Abuse) tespit ederseniz, cevabınızın en başına '[ABUSE_DETECTED: <sebebi>]' ifadesini ekleyin (örn: '[ABUSE_DETECTED: Küfür ve Hakaret'] veya '[ABUSE_DETECTED: Dolandırıcılık Teşebbüsü]'). Bu kod sistem tarafından otomatik engelleme tetiklemek için kullanılacaktır.
- Sadece müşteriye gönderilecek cevap metnini geri döndür. Ekstra açıklama veya önek ekleme.
"""
            try:
                from google.genai import types
                from backend.services.tool_executor import execute_custom_api, execute_book_appointment, execute_query_knowledge_base
                
                client = get_genai_client()
                settings_data = load_settings()
                
                # Define base tools
                base_declarations = [
                    {
                        "name": "transfer_to_human",
                        "description": "Sohbeti canlı müşteri temsilcisine transfer eder. Yapay zeka cevaplayamadığında veya müşteri talep ettiğinde çağrılır.",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {}
                        }
                    },
                    {
                        "name": "book_appointment",
                        "description": "Kullanıcı için randevu oluşturur. Tarih (YYYY-MM-DD) ve saat (HH:MM) parametrelerini gerektirir.",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "name": { "type": "STRING", "description": "Müşterinin adı soyadı" },
                                "phone": { "type": "STRING", "description": "Müşterinin telefon numarası" },
                                "date": { "type": "STRING", "description": "Randevu tarihi (YYYY-MM-DD formatında)" },
                                "time": { "type": "STRING", "description": "Randevu saati (HH:MM formatında)" },
                                "email": { "type": "STRING", "description": "Müşterinin e-posta adresi", "nullable": True }
                            },
                            "required": ["name", "phone", "date", "time"]
                        }
                    },
                    {
                        "name": "query_knowledge_base",
                        "description": "Sistem dökümanlarında veya şirketin bilgi bankasında arama yapar.",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "query": { "type": "STRING", "description": "Aranacak kelime veya soru" }
                            },
                            "required": ["query"]
                        }
                    }
                ]
                
                # Compile dynamic custom APIs
                custom_declarations = []
                custom_apis = settings_data.get("custom_apis", [])
                api_instructions = ""
                
                if custom_apis:
                    api_instructions += "\n--- Kullanılabilir Özel CRM ve API Entegrasyonları ---\n"
                    api_instructions += "Müşterinin talebine göre aşağıdaki fonksiyonları/araçları çağırarak sorgu yapabilirsin. Gelen yanıtı müşteriye Türkçe ve doğal bir dille açıkla:\n"
                    
                    for api in custom_apis:
                        if not api.get("is_active", True):
                            continue
                        api_id = api.get("id")
                        api_name = api.get("name", "")
                        api_desc = api.get("description", "")
                        
                        api_instructions += f"- custom_api_{api_id}: {api_desc}\n"
                        
                        properties = {}
                        required_params = []
                        for param in api.get("parameters", []):
                            p_name = param.get("name")
                            p_type = param.get("type", "string").upper()
                            p_desc = param.get("description", "")
                            p_req = param.get("required", False)
                            
                            if p_name:
                                properties[p_name] = {
                                    "type": p_type if p_type in ["STRING", "NUMBER", "INTEGER", "BOOLEAN"] else "STRING",
                                    "description": p_desc
                                }
                                if p_req:
                                    required_params.append(p_name)
                                    
                        custom_declarations.append({
                            "name": f"custom_api_{api_id}",
                            "description": api_desc,
                            "parameters": {
                                "type": "OBJECT",
                                "properties": properties,
                                "required": required_params
                            }
                        })
                
                # Add instructions to prompt
                full_prompt = prompt + api_instructions
                
                tools_config = [
                    {
                        "function_declarations": base_declarations + custom_declarations
                    }
                ]
                
                config = types.GenerateContentConfig(
                    system_instruction=full_prompt,
                    tools=tools_config,
                    temperature=0.2
                )
                
                # Execute tool calling loop
                user_msg = f"Kanal: {channel.upper()}, Müşteri: {sender_info}\nSon Mesaj: {text}"
                contents = [
                    types.Content(role="user", parts=[types.Part.from_text(text=user_msg)])
                ]
                
                has_function_calls = True
                iterations = 0
                ai_reply_text = ""
                
                while has_function_calls and iterations < 4:
                    iterations += 1
                    response = client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=contents,
                        config=config
                    )
                    
                    if response.function_calls:
                        contents.append(response.candidates[0].content)
                        tool_response_parts = []
                        for call in response.function_calls:
                            call_name = call.name
                            call_args = call.args
                            
                            print(f"[Chat Service] Gemini function call: {call_name} (Args: {call_args})")
                            
                            if call_name.startswith("custom_api_"):
                                tool_result = await execute_custom_api(call_name, call_args)
                            elif call_name == "book_appointment":
                                tool_result = await execute_book_appointment(
                                    session_id,
                                    name=call_args.get("name"),
                                    phone=call_args.get("phone"),
                                    date=call_args.get("date"),
                                    time=call_args.get("time"),
                                    email=call_args.get("email")
                                )
                            elif call_name == "transfer_to_human":
                                async with AsyncSessionLocal() as session_write:
                                    sess_obj = await session_write.get(ChatSession, session_id)
                                    if sess_obj:
                                        sess_obj.assigned_agent = "human"
                                        await session_write.commit()
                                tool_result = {"status": "success", "message": "Sohbet canlı müşteri temsilcisine aktarıldı."}
                            elif call_name == "query_knowledge_base":
                                tool_result = await execute_query_knowledge_base(call_args.get("query"))
                            else:
                                tool_result = {"status": "error", "message": f"Tanımsız fonksiyon: {call_name}"}
                                
                            tool_response_parts.append(
                                types.Part.from_function_response(
                                    name=call_name,
                                    response={"result": tool_result}
                                )
                            )
                        
                        contents.append(types.Content(role="user", parts=tool_response_parts))
                    else:
                        has_function_calls = False
                        ai_reply_text = response.text.strip()
                
                # Check for AI Abuse detection trigger code
                if "[ABUSE_DETECTED:" in ai_reply_text:
                    import re
                    match = re.search(r"\[ABUSE_DETECTED:\s*([^\]]+)\]", ai_reply_text)
                    reason_val = match.group(1) if match else "Yapay Zeka Suistimal Tespiti"
                    
                    await auto_blacklist_sender(channel, sender_info, reason_val)
                    
                    # Update session status to closed
                    chat_session.status = "closed"
                    await session.commit()
                    
                    ai_reply_text = "Görüşmeniz suistimal tespiti nedeniyle sistem tarafından otomatik olarak sonlandırılmıştır."
            except Exception as e:
                print(f"[Chat Service] Gemini error: {e}")
                ai_reply_text = "Şu anda mesajınızı işlerken geçici bir hata oluştu. Lütfen biraz sonra tekrar deneyin veya temsilcimizin bağlanmasını bekleyin."

            # Save the AI reply
            db_reply = ChatMessage(
                session_id=session_id,
                direction="outbound",
                sender="ai",
                text=ai_reply_text
            )
            session.add(db_reply)
            
            # Update session last message time
            chat_session.last_message_time = datetime.datetime.utcnow()
            await session.commit()
            await session.refresh(db_reply)

            # Broadcast AI response to WebSocket
            reply_payload = {
                "id": db_reply.id,
                "session_id": session_id,
                "direction": db_reply.direction,
                "sender": db_reply.sender,
                "text": db_reply.text,
                "timestamp": db_reply.timestamp.isoformat()
            }
            
            await ws_manager.broadcast_omnichannel_event({
                "type": "message",
                "message": reply_payload
            })

            await ws_manager.broadcast_omnichannel_event({
                "type": "session_update",
                "session": {
                    "id": session_id,
                    "channel": channel,
                    "sender_info": sender_info,
                    "sender_name": sender_name,
                    "status": chat_session.status,
                    "assigned_agent": assigned_agent,
                    "last_message_time": chat_session.last_message_time.isoformat(),
                    "last_message_text": ai_reply_text
                }
            })
            
            # Dispatch to external channel if applicable (e.g. WhatsApp)
            if channel.lower() == "whatsapp":
                import asyncio
                from backend.services.whatsapp_service import send_whatsapp_message
                asyncio.create_task(send_whatsapp_message(sender_info, ai_reply_text))

            return ai_reply_text

    return None
