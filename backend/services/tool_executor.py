import datetime
from sqlalchemy import select
from backend.database.config import AsyncSessionLocal
from backend.database.models import Appointment, Call, Transcript
from backend.services.ami_manager import redirect_call_to_human
from backend.services.rag_service import query_vector_search, get_genai_client

async def execute_book_appointment(call_id: str, name: str, phone: str, date: str, time: str, email: str = None) -> dict:
    """Creates a local appointment in the database."""
    try:
        # Parse datetime
        appt_time_str = f"{date} {time}"
        appt_datetime = datetime.datetime.strptime(appt_time_str, "%Y-%m-%d %H:%M")
        
        async with AsyncSessionLocal() as session:
            # Create appointment record
            appointment = Appointment(
                call_id=call_id,
                customer_name=name,
                customer_phone=phone,
                customer_email=email,
                appointment_time=appt_datetime,
                status="confirmed"
            )
            session.add(appointment)
            await session.commit()
            
        print(f"[Tool] Randevu Kaydedildi: {name} - {appt_datetime}")
        return {
            "status": "success",
            "message": f"Randevunuz {date} günü saat {time} için başarıyla oluşturuldu."
        }
    except Exception as e:
        print(f"[Tool] Randevu hatasi: {e}")
        return {
            "status": "error",
            "message": f"Randevu oluşturulurken bir hata oluştu: {str(e)}"
        }

def is_business_hours() -> bool:
    import datetime
    from backend.main import settings_db
    time_schedule = settings_db.get("call_flow", {}).get("time_schedule", {})
    if not time_schedule.get("enabled", True):
        return True
    
    now = datetime.datetime.now()
    day_name = now.strftime("%A").lower()
    if day_name not in time_schedule.get("days", []):
        return False
        
    current_time = now.strftime("%H:%M")
    start = time_schedule.get("start_time", "09:00")
    end = time_schedule.get("end_time", "18:00")
    return start <= current_time <= end

async def generate_call_summary(call_id: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(Transcript).where(Transcript.call_id == call_id).order_by(Transcript.timestamp.asc())
        res = await session.execute(stmt)
        lines = res.scalars().all()
    
    if not lines:
        return "Gelen Arama"
        
    chat_history = [f"{l.speaker}: {l.text}" for l in lines]
    history_str = "\n".join(chat_history)
    
    prompt = f"""
Aşağıdaki telefon konuşması geçmişini inceleyerek temsilciye fısıldanacak en fazla 10 kelimelik çok kısa bir özet çıkar. 
Örnek: "Ahmet Yılmaz borç sorgulama ve ödeme hakkında arıyor."

[KONUŞMA GEÇMİŞİ]
{history_str}
"""
    try:
        client = get_genai_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Summary generation error: {e}")
        return "Aktarılan Arama"

async def transfer_to_mobile_with_whisper(call_id: str, gsm_number: str) -> bool:
    from backend.services.ami_manager import active_channels, call_id_to_asterisk_id, get_ami_manager
    from backend.main import add_system_log
    import edge_tts
    import asyncio
    
    ast_id = call_id_to_asterisk_id.get(call_id, call_id)
    customer_channel = active_channels.get(ast_id)
    if not customer_channel:
        print(f"[Mobile Transfer] Customer channel not found for {call_id}")
        return False
        
    summary_text = await generate_call_summary(call_id)
    print(f"[Mobile Transfer] Generated Summary: '{summary_text}'")
    add_system_log("MOBILE_TRANSFER", "INFO", f"Arama mobil temsilciye yönlendiriliyor: {gsm_number} (Özet: {summary_text})")
    
    proj_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    mp3_path = os.path.join(proj_root, "recordings", f"summary_{call_id}.mp3")
    
    try:
        communicate = edge_tts.Communicate(summary_text, "tr-TR-AhmetNeural")
        await communicate.save(mp3_path)
        
        # Convert MP3 to 8000Hz mono WAV using sox in Docker Asterisk
        cmd = [
            "docker", "exec", "ai_pbx_asterisk",
            "sox", f"/var/spool/asterisk/monitor/summary_{call_id}.mp3",
            "-r", "8000", "-c", "1",
            f"/var/spool/asterisk/monitor/summary_{call_id}.wav"
        ]
        proc = await asyncio.create_subprocess_exec(*cmd)
        await proc.wait()
    except Exception as e:
        print(f"[Mobile Transfer] Audio creation/conversion error: {e}")
        
    manager = await get_ami_manager()
    if not manager:
        print("[Mobile Transfer] AMI not connected")
        return False
        
    action = {
        'Action': 'Originate',
        'Channel': f'PJSIP/Operator_Trunk/sip:{gsm_number}',
        'Context': 'mobile_transfer_context',
        'Exten': 's',
        'Priority': '1',
        'Variable': f'CALL_UUID={call_id},CUSTOMER_CHANNEL={customer_channel}',
        'Async': 'true'
    }
    try:
        await manager.send_action(action)
        print(f"[Mobile Transfer] Originated whisper call to GSM: {gsm_number}")
        return True
    except Exception as e:
        print(f"[Mobile Transfer] Originate call error: {e}")
        return False

async def execute_transfer_to_human(call_id: str) -> dict:
    """Triggers AMI redirection to human queue."""
    print(f"[Tool] Temsilciye aktarım tetiklendi (call_id: {call_id})")
    
    # Load settings to get active AI agent's transfer target
    transfer_target = "200"
    try:
        from backend.main import settings_db
        agents = settings_db.get("ai_agents", [])
        for agent in agents:
            if agent.get("status") == "active" and agent.get("transfer_target"):
                transfer_target = agent.get("transfer_target")
                break
    except Exception as e:
        print(f"[Tool] Error reading transfer target from settings: {e}")
        
    from backend.services.agent_presence import is_agent_available
    if not is_agent_available():
        print(f"[Tool] Aktarım sırasında müsait temsilci yok. Mobil aktarım kontrol ediliyor...")
        from backend.main import settings_db
        target_user = None
        for u in settings_db.get("users", []):
            if u.get("extension") == transfer_target:
                target_user = u
                break
                
        if target_user and target_user.get("mobile_transfer_enabled") and target_user.get("gsm_number"):
            if is_business_hours():
                # Update call status in database
                async with AsyncSessionLocal() as session:
                    db_call = await session.get(Call, call_id)
                    if db_call:
                        db_call.status = "transferred"
                        await session.commit()
                
                success = await transfer_to_mobile_with_whisper(call_id, target_user.get("gsm_number"))
                if success:
                    return {
                        "status": "success", 
                        "message": f"Temsilci çevrimdışı. Çağrı akıllı mobil yönlendirme ile {target_user.get('gsm_number')} numarasına aktarılıyor."
                    }
        
        return {
            "status": "error",
            "message": "Aktarım başlatılamadı. Şu an tüm müşteri temsilcilerimiz mola durumunda veya çevrimdışı."
        }
        
    # Update call status in database
    async with AsyncSessionLocal() as session:
        db_call = await session.get(Call, call_id)
        if db_call:
            db_call.status = "transferred"
            await session.commit()
            
    # Trigger AMI
    from backend.services.ami_manager import redirect_call_to_human
    success = await redirect_call_to_human(call_id, extension=transfer_target)
    if success:
        return {"status": "success", "message": f"Aktarım başarıyla başlatıldı ({transfer_target})."}
    else:
        return {"status": "error", "message": "Aktarım başlatılamadı. Temsilciler şu an meşgul olabilir."}

async def execute_query_knowledge_base(query: str) -> dict:
    """Executes semantic search on PostgreSQL pgvector database."""
    print(f"[Tool] Bilgi bankası aranıyor: '{query}'")
    search_results = await query_vector_search(query)
    return {
        "status": "success",
        "results": search_results
    }

def load_settings():
    import json
    import os
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "settings.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Settings] Error loading settings in tool_executor: {e}")
    return {}

async def execute_custom_api(name: str, args: dict) -> dict:
    """Executes a low-code user-defined custom API (CRM/Webhook) dynamically."""
    import httpx
    
    api_id = name.replace("custom_api_", "")
    settings = load_settings()
    custom_apis = settings.get("custom_apis", [])
    
    # Find matching API definition
    api_def = None
    for api in custom_apis:
        if api.get("id") == api_id:
            api_def = api
            break
            
    if not api_def:
        print(f"[Custom API] API definition for {api_id} not found in settings.")
        return {
            "status": "error",
            "message": f"API tanımı bulunamadı: {api_id}"
        }
        
    url = api_def.get("url", "")
    method = api_def.get("method", "GET").upper()
    headers_config = api_def.get("headers", [])
    params_config = api_def.get("parameters", [])
    
    # Compile headers
    headers = {"Content-Type": "application/json"}
    for h in headers_config:
        k = h.get("name")
        v = h.get("value")
        if k and v:
            headers[k] = v
            
    # Prepare placeholders replacements in URL (path parameters) and build queries/body
    query_params = {}
    body_data = {}
    
    for param in params_config:
        p_name = param.get("name")
        p_loc = param.get("location", "query").lower()
        
        # Get parameter value from Gemini args
        val = args.get(p_name)
        if val is None:
            continue
            
        if p_loc == "path":
            placeholder = f"{{{p_name}}}"
            if placeholder in url:
                url = url.replace(placeholder, str(val))
            else:
                url = url.replace(p_name, str(val))
        elif p_loc == "query":
            query_params[p_name] = val
        elif p_loc == "body":
            body_data[p_name] = val
            
    print(f"[Custom API] Executing dynamic call: {method} {url}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=query_params)
            elif method == "POST":
                response = await client.post(url, headers=headers, params=query_params, json=body_data)
            elif method == "PUT":
                response = await client.put(url, headers=headers, params=query_params, json=body_data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers, params=query_params)
            else:
                response = await client.request(method, url, headers=headers, params=query_params, json=body_data if method in ["PATCH"] else None)
                
            status_code = response.status_code
            print(f"[Custom API] Dynamic call response status={status_code}")
            
            try:
                response_json = response.json()
                return {
                    "status": "success",
                    "http_status": status_code,
                    "data": response_json
                }
            except Exception:
                return {
                    "status": "success",
                    "http_status": status_code,
                    "data": response.text
                }
    except Exception as e:
        print(f"[Custom API] Call failed with exception: {e}")
        return {
            "status": "error",
            "message": f"API çağrısı sırasında sistem hatası oluştu: {str(e)}"
        }

async def handle_tool_call(name: str, args: dict, call_id: str) -> dict:
    """Router to execute the correct tool based on function name."""
    if name.startswith("custom_api_"):
        return await execute_custom_api(name, args)
    elif name == "book_appointment":
        return await execute_book_appointment(
            call_id,
            name=args.get("name"),
            phone=args.get("phone"),
            date=args.get("date"),
            time=args.get("time"),
            email=args.get("email")
        )
    elif name == "transfer_to_human":
        return await execute_transfer_to_human(call_id)
    elif name == "query_knowledge_base":
        return await execute_query_knowledge_base(args.get("query"))
    elif name == "hangup_call":
        return {"status": "success", "message": "Görüşme sonlandırılıyor."}
    else:
        return {"status": "error", "message": f"Tanımsız fonksiyon: {name}"}
