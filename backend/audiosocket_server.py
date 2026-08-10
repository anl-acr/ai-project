import asyncio
import os
import json
import base64
import datetime
import websockets
from sqlalchemy import select, update
from backend.database.config import AsyncSessionLocal
from backend.database.models import Call, Transcript, BlacklistItem, BlockWord
from backend.services.websocket_manager import ws_manager
from backend.services.tool_executor import handle_tool_call
from backend.services.prompt_manager import compile_system_prompt
from dotenv import load_dotenv
# Load environment variables from .env file
load_dotenv()
# Configuration
PORT = int(os.getenv("AUDIOSOCKET_PORT", 9092))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash-native-audio-latest")
VOICE_NAME = os.getenv("VOICE_NAME", "Aoede")  # Puck, Charon, Kore, Fenrir, Aoede

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")

def detect_is_english(text: str) -> bool:
    text_lower = text.lower().strip()
    english_phrases = [
        "speak english", "talk in english", "can you speak english", 
        "do you speak english", "i speak english", "in english please",
        "please speak english", "english agent", "english support"
    ]
    for phrase in english_phrases:
        if phrase in text_lower:
            return True
    return False

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Settings] Error loading settings: {e}")
    return {}

async def stream_elevenlabs_tts_to_asterisk(text: str, voice_id: str, stability: float, similarity: float, style: float, api_key: str, write_queue: asyncio.Queue):
    """Streams ElevenLabs TTS audio in real-time directly into Asterisk write_queue with sub-second latency."""
    import httpx
    if not api_key or not text.strip():
        print("[ElevenLabs Stream WARNING] ElevenLabs API Key veya metin bulunamadı!")
        return
    if not voice_id:
        voice_id = "EXAVITQu4vr4xnSDxMaL" # Bella default premade
        
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream?output_format=pcm_16000&optimize_streaming_latency=3"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity,
            "style": style
        }
    }
    
    print(f"[ElevenLabs Stream Start] '{text[:30]}...' canlı ses yayını başlatılıyor (Latency Optimized)...")
    raw_16k_buffer = bytearray()
    pcm_8k_buffer = bytearray()
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    print(f"[ElevenLabs Stream Error] Status {response.status_code}: {error_body.decode(errors='ignore')}")
                    return
                    
                async for chunk in response.aiter_bytes():
                    if not chunk:
                        continue
                    raw_16k_buffer.extend(chunk)
                    
                    # Process only complete 4-byte sample blocks (2 samples at 16kHz -> 1 sample at 8kHz)
                    # Apply 2-tap moving average anti-aliasing filter to eliminate high-frequency audio tearing/distortion
                    while len(raw_16k_buffer) >= 4:
                        s0 = int.from_bytes(raw_16k_buffer[0:2], byteorder='little', signed=True)
                        s1 = int.from_bytes(raw_16k_buffer[2:4], byteorder='little', signed=True)
                        avg_sample = (s0 + s1) // 2
                        pcm_8k_buffer.extend(avg_sample.to_bytes(2, byteorder='little', signed=True))
                        del raw_16k_buffer[:4]
                        
                    while len(pcm_8k_buffer) >= 320:
                        frame = bytes(pcm_8k_buffer[:320])
                        await write_queue.put(frame)
                        del pcm_8k_buffer[:320]
                        
            if len(pcm_8k_buffer) > 0:
                frame = bytes(pcm_8k_buffer) + b'\x00' * (320 - len(pcm_8k_buffer))
                await write_queue.put(frame)
                
            print(f"[ElevenLabs Stream Finish] '{text[:30]}...' canlı yayını tamamlandı.")
    except Exception as e:
        print(f"[ElevenLabs Stream Exception] {e}")

async def query_non_gemini_llm(llm_provider: str, model_name: str, system_prompt: str, user_text: str, settings_data: dict) -> str:
    """Queries OpenAI, Groq, or Anthropic REST APIs directly for non-Gemini LLM providers."""
    import httpx
    ai_providers = settings_data.get("ai_providers", {})
    
    if llm_provider == "groq":
        api_key = ai_providers.get("groq_api_key") or os.getenv("GROQ_API_KEY", "")
        if not api_key:
            return "Groq API anahtarı sistemde tanımlı değil."
        url = "https://api.groq.com/openai/v1/chat/completions"
        model = model_name if ("llama" in model_name or "mixtral" in model_name) else "llama-3.3-70b-versatile"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text}
            ],
            "temperature": 0.7,
            "max_tokens": 300
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    print(f"[Groq LLM Error] {resp.status_code}: {resp.text}")
                    return "Groq servisine ulaşılamadı."
        except Exception as e:
            print(f"[Groq LLM Exception] {e}")
            return "Groq bağlantı hatası."

    elif llm_provider == "openai":
        api_key = ai_providers.get("openai_api_key") or os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            return "OpenAI API anahtarı sistemde tanımlı değil."
        url = "https://api.openai.com/v1/chat/completions"
        model = model_name if "gpt" in model_name else "gpt-4o-mini"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text}
            ],
            "temperature": 0.7,
            "max_tokens": 300
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    print(f"[OpenAI LLM Error] {resp.status_code}: {resp.text}")
                    return "OpenAI servisine ulaşılamadı."
        except Exception as e:
            print(f"[OpenAI LLM Exception] {e}")
            return "OpenAI bağlantı hatası."

    elif llm_provider == "anthropic":
        api_key = ai_providers.get("anthropic_api_key") or os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return "Anthropic API anahtarı sistemde tanımlı değil."
        url = "https://api.anthropic.com/v1/messages"
        model = model_name if "claude" in model_name else "claude-3-5-sonnet-20241022"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_text}],
            "max_tokens": 300
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["content"][0]["text"]
                else:
                    print(f"[Anthropic LLM Error] {resp.status_code}: {resp.text}")
                    return "Anthropic servisine ulaşılamadı."
        except Exception as e:
            print(f"[Anthropic LLM Exception] {e}")
            return "Anthropic bağlantı hatası."

    return ""

async def get_call_did(call_id: str) -> str:
    """Queries the database to get the dialed DID number for this call."""
    try:
        async with AsyncSessionLocal() as session:
            db_call = await session.get(Call, call_id)
            if db_call and db_call.callee_number:
                return db_call.callee_number
    except Exception as e:
        print(f"Error querying call DID from DB: {e}")
    return "s"

def get_ai_agent_for_did(did: str) -> dict:
    """Finds the AI Agent configured for the dialed DID via Inbound Rules -> Call Flow."""
    if not did:
        did = "s"
    
    settings = load_settings()
    
    # 1. Match Inbound Rule
    matched_rule = None
    inbound_rules = settings.get("inbound_rules", [])
    
    # Try match
    for rule in inbound_rules:
        match_mode = rule.get("did_match_mode", "all")
        if match_mode == "all":
            matched_rule = rule
            # Keep looking for a more specific match if any
        elif match_mode == "specific":
            patterns = rule.get("did_patterns", [])
            for p in patterns:
                if p and (p == did or did in p or p.strip('0') == did.strip('0')):
                    matched_rule = rule
                    break
            if matched_rule and match_mode == "specific":
                break

    if not matched_rule:
        return None

    # 2. Match Call Flow
    dest_type = matched_rule.get("destination_type")
    dest_id = matched_rule.get("destination_id")
    
    if dest_type != "call_flow" or not dest_id:
        return None
        
    # Find workflow
    workflows = settings.get("workflows", [])
    workflow = next((w for w in workflows if w.get("id") == dest_id), None)
    if not workflow:
        return None
        
    # 3. Extract AI Agent ID from Workflow nodes
    agent_id = None
    for node in workflow.get("nodes", []):
        if node.get("type") == "ai_agent":
            agent_id = node.get("value")
            break
            
    if not agent_id:
        return None
        
    # 4. Return AI Agent
    ai_agents = settings.get("ai_agents", [])
    return next((a for a in ai_agents if a.get("id") == agent_id), None)

def resample_8k_to_16k(data: bytes) -> bytes:
    """Resamples 8kHz mono 16-bit PCM to 16kHz mono 16-bit PCM (simple sample doubling)."""
    out = bytearray(len(data) * 2)
    for i in range(0, len(data), 2):
        sample = data[i:i+2]
        out[i*2:i*2+2] = sample
        out[i*2+2:i*2+4] = sample
    return bytes(out)

def resample_24k_to_8k(data: bytes) -> bytes:
    """Downsamples 24kHz mono 16-bit PCM to 8kHz mono 16-bit PCM using a [1, 2, 1] weighted average filter to prevent aliasing while preserving clarity."""
    import array
    samples = array.array('h', data)
    out_samples = array.array('h')
    
    # Process in groups of 3 samples (since 24kHz / 8kHz = 3)
    for i in range(0, len(samples) - 2, 3):
        # Weighted average filter of [1, 2, 1] / 4
        weighted_val = int((samples[i] + 2 * samples[i+1] + samples[i+2]) // 4)
        out_samples.append(weighted_val)
        
    return out_samples.tobytes()

async def send_initial_silence(writer: asyncio.StreamWriter):
    """Sends 320-byte silence frames (20ms) to Asterisk to prevent rtptimeout during handshake."""
    silence_frame = b'\x10' + (320).to_bytes(2, byteorder='big') + b'\x00' * 320
    try:
        while True:
            writer.write(silence_frame)
            await writer.drain()
            await asyncio.sleep(0.02)
    except asyncio.CancelledError:
        pass
    except Exception:
        pass

def clean_ai_transcript(text: str) -> str:
    """Cleans English thoughts, planning headers and markdown bold sections from AI transcript."""
    import re
    if not text:
        return ""
    
    # 1. Remove markdown bold sections like **Acknowledge and Inquire** or **Planning**
    text = re.sub(r"\*\*.*?\*\*", "", text)
    
    # 2. Split into lines and filter out English lines
    cleaned_lines = []
    english_keywords = {
        "acknowledge", "concluding", "initiating", "dialogue", "protocol", "response", 
        "locating", "address", "extracting", "satisfy", "gratitude", "satisfaction", 
        "terminating", "farewell", "satisfactory", "interaction"
    }
    
    for line in text.split("\n"):
        line_clean = line.strip()
        if not line_clean:
            continue
        
        # Check if line contains primarily English words
        words = [w.lower().strip(".,!?*:-") for w in line_clean.split()]
        if not words:
            continue
            
        # If more than 25% of the words are English keywords or match typical English structure
        english_word_count = sum(1 for w in words if w in english_keywords or w in {"i", "the", "and", "to", "a", "of", "in", "for", "is", "with", "my", "it"})
        if len(words) > 0 and (english_word_count / len(words)) >= 0.25:
            # Skip this line as it's planning/thoughts in English
            continue
            
        cleaned_lines.append(line_clean)
        
    return "\n".join(cleaned_lines).strip()

async def write_db_transcript(call_id: str, speaker: str, text: str):
    """Saves transcript line to PostgreSQL database and broadcasts it to UI."""
    if speaker == "ai":
        text = clean_ai_transcript(text)
        if not text:  # Don't save empty text
            return
            
    print(f"[{speaker.upper()}]: {text}")
    async with AsyncSessionLocal() as session:
        transcript = Transcript(call_id=call_id, speaker=speaker, text=text)
        session.add(transcript)
        await session.commit()
    # Broadcast to agent consoles via FastAPI REST endpoint (bridging process boundaries)
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post("http://localhost:8000/api/transcripts/broadcast", json={
                "call_id": call_id,
                "speaker": speaker,
                "text": text
            }, timeout=1.0)
    except Exception as e:
        print(f"[HTTP Broadcast Error]: {e}")

async def register_call_db(call_id: str):
    """Inserts call start record if not exists."""
    async with AsyncSessionLocal() as session:
        # Check if exists
        db_call = await session.get(Call, call_id)
        if not db_call:
            new_call = Call(
                id=call_id, 
                caller_number="Bilinmeyen Temsilci", 
                callee_number="Santral AI",
                status="in_progress",
                start_time=datetime.datetime.utcnow()
            )
            session.add(new_call)
            await session.commit()

async def end_call_db(call_id: str, summary: str = None, hangup_source: str = None):
    """Updates call record to completed."""
    async with AsyncSessionLocal() as session:
        db_call = await session.get(Call, call_id)
        if db_call:
            db_call.status = "completed" if db_call.status == "in_progress" else db_call.status
            db_call.end_time = datetime.datetime.utcnow()
            if summary:
                db_call.summary = summary
            if hangup_source:
                db_call.hangup_source = hangup_source
            db_call.recording_path = f"/api/recordings/{call_id}.wav"
            await session.commit()
            
            try:
                from backend.services.call_analyzer import analyze_call
                asyncio.create_task(analyze_call(call_id))
            except Exception as e:
                print(f"[AMI] Failed to schedule call analyzer task: {e}")

async def get_all_knowledge_base_context() -> str:
    """Fetches all indexed knowledge base document chunks from PostgreSQL to inject into system_instruction."""
    try:
        from sqlalchemy import select
        from backend.database.models import DocumentChunk
        async with AsyncSessionLocal() as session:
            stmt = select(DocumentChunk).limit(30)
            res = await session.execute(stmt)
            chunks = res.scalars().all()
            if not chunks:
                return ""
            context = "\n\n--- BİLGİ BANKASI VE ŞİRKET DÖKÜMANLARI ---\n"
            context += "Aşağıdaki bilgiler şirketin resmi bilgi bankasından taranmıştır. Müşteri soru sorduğunda bu dökümanlardaki bilgileri kullanarak doğrudan Türkçe yanıt ver:\n\n"
            for c in chunks:
                context += f"[Kaynak: {c.filename}]\n{c.content}\n\n"
            return context
    except Exception as e:
        print(f"[RAG Context Error]: {e}")
        return ""

async def auto_blacklist_call(call_id: str, reason: str):
    from sqlalchemy import select
    from backend.main import add_system_log
    from backend.services.ami_manager import hangup_call
    
    async with AsyncSessionLocal() as session:
        db_call = await session.get(Call, call_id)
        if db_call and db_call.caller_number:
            caller = db_call.caller_number
            # Check if already blacklisted
            stmt = select(BlacklistItem).where(
                (BlacklistItem.type == "phone") & 
                (BlacklistItem.value == caller)
            )
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                item = BlacklistItem(
                    type="phone",
                    value=caller,
                    reason=reason,
                    timestamp=datetime.datetime.utcnow()
                )
                session.add(item)
                
                # Update call status to blocked
                db_call.status = "blocked"
                
                await session.commit()
                print(f"[Abuse Shield] Auto-blacklisted phone number: {caller} (Reason: {reason})")
                add_system_log("ABUSE_SHIELD", "WARNING", f"Arayan Kara Listeye Alındı: {caller} (Sebep: {reason})")
                
                # Drop/hangup call instantly
                asyncio.create_task(hangup_call(call_id))

async def listen_for_whispers(call_id: str, gemini_ws):
    """Listens to supervisor whisper events on Redis Pub/Sub and sends them to the Gemini live session."""
    import redis.asyncio as aioredis
    import json

    r = aioredis.Redis(host='localhost', port=6379, decode_responses=True)
    pubsub = r.pubsub()
    channel = f"call_whisper:{call_id}"
    await pubsub.subscribe(channel)
    print(f"[Whisper Listener] Subscribed to Redis channel: {channel}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                whisper_text = data.get("text", "")
                if whisper_text:
                    print(f"[Whisper Listener] Received whisper for {call_id}: '{whisper_text}'")
                    # Format as client content turn for Gemini
                    whisper_msg = {
                        "clientContent": {
                            "turns": [
                                {
                                    "role": "user",
                                    "parts": [
                                        {
                                            "text": f"[SYSTEM NOTE / SUPERVISOR DIRECTIVE: {whisper_text}]"
                                        }
                                    ]
                                }
                            ],
                            "turnComplete": True
                        }
                    }
                    await gemini_ws.send(json.dumps(whisper_msg))
                    print(f"[Whisper Listener] Injected whisper into Gemini session for call {call_id}")
    except asyncio.CancelledError:
        print(f"[Whisper Listener] Whisper subscription task cancelled for call {call_id}")
    except Exception as e:
        print(f"[Whisper Listener] Error in whisper subscription listener for call {call_id}: {e}")
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            await r.close()
        except Exception:
            pass

async def handle_audiosocket_connection(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    peer = writer.get_extra_info('peername')
    print(f"Asterisk baglantisi alindi: {peer}")

    call_id = None
    gemini_ws = None
    asterisk_write_queue = asyncio.Queue()

    # Task references
    rec_asterisk_task = None
    send_asterisk_task = None
    whisper_listener_task = None
    write_asterisk_task = None
    silence_task = None
    call_state = None

    try:
        # 1. Read Audiosocket UUID message
        # Format: 1 byte msg_type (0x03 for UUID), 2 bytes length (16), 16 bytes UUID
        header = await reader.readexactly(3)
        msg_type = header[0]
        payload_len = int.from_bytes(header[1:3], byteorder='big')
        
        if msg_type != 0x01 or payload_len != 16:
            print(f"Hata: Ilk paket Audiosocket UUID paketi degil. Alinan msg_type={msg_type}, payload_len={payload_len}")
            writer.close()
            await writer.wait_closed()
            return
            
        uuid_bytes = await reader.readexactly(16)
        # Convert UUID to string representation (can use direct decoding or hex)
        # Asterisk UNIQUEID looks like "1719602410.23" (string). Sometimes it's padded.
        # We try to decode it as ascii/utf-8 string.
        try:
            import uuid
            call_id = str(uuid.UUID(bytes=uuid_bytes))
        except Exception:
            try:
                call_id = uuid_bytes.decode('utf-8', errors='ignore').replace('\x00', '').strip()
                if not call_id or any(ord(c) < 32 or ord(c) > 126 for c in call_id):
                    call_id = uuid_bytes.hex()
            except Exception:
                call_id = uuid_bytes.hex()

        print(f"Arama Basladi. Benzersiz ID (call_id): {call_id}")
        await register_call_db(call_id)
        
        # 2. Wait for Asterisk connection
        

        # Get dynamic AI Agent based on dialed DID (Wait 200ms to ensure dialplan API request is fully processed)
        await asyncio.sleep(0.2)
        did = await get_call_did(call_id)
        ai_agent = get_ai_agent_for_did(did)
        if ai_agent:
            print(f"Arama DID: {did} -> Secilen AI Agent: {ai_agent.get('name')} ({ai_agent.get('id')})")
        else:
            print(f"Arama DID: {did} -> Uygun AI Agent bulunamadi. Varsayilan ayarlar kullanilacak.")

        llm_provider = "google"
        tts_provider = "google"
        is_elevenlabs_tts = False
        elevenlabs_api_key = ""
        elevenlabs_voice_id = ""
        elevenlabs_stability = 0.5
        elevenlabs_similarity = 0.75
        elevenlabs_style = 0.0

        elevenlabs_agent_id = ""
        if ai_agent:
            llm_provider = str(ai_agent.get("llm_provider") or ai_agent.get("provider", "google")).lower()
            tts_provider = str(ai_agent.get("tts_provider") or ("elevenlabs" if ai_agent.get("elevenlabs_voice_id") else "google")).lower()
            elevenlabs_agent_id = ai_agent.get("elevenlabs_agent_id", "")

            if llm_provider == "elevenlabs":
                if elevenlabs_agent_id:
                    print(f"[ElevenLabs ConvAI] Zeka Motoru ElevenLabs ConvAI olarak ayarlandı. Agent ID: {elevenlabs_agent_id}")
                else:
                    print(f"[ElevenLabs ConvAI WARNING] UYARI: Zeka motoru 'ElevenLabs' seçildi ancak 'ElevenLabs Agent ID (ConvAI)' girilmemiş! Zeka işlemleri için Gemini motoruna yönlendirildi.")

            if tts_provider == "elevenlabs" or ai_agent.get("elevenlabs_voice_id"):
                settings_data = load_settings()
                elevenlabs_api_key = settings_data.get("ai_providers", {}).get("elevenlabs_api_key") or os.getenv("ELEVENLABS_API_KEY", "")
                elevenlabs_voice_id = ai_agent.get("elevenlabs_voice_id") or "EXAVITQu4vr4xnSDxMaL"
                elevenlabs_stability = float(ai_agent.get("elevenlabs_stability", 0.5))
                elevenlabs_similarity = float(ai_agent.get("elevenlabs_similarity", 0.75))
                elevenlabs_style = float(ai_agent.get("elevenlabs_style", 0.0))

                if elevenlabs_api_key:
                    is_elevenlabs_tts = True
                    print(f"[ElevenLabs TTS] Temsilci '{ai_agent.get('name')}' ElevenLabs TTS modunda aktif. Voice ID: {elevenlabs_voice_id}")
                else:
                    print(f"[ElevenLabs WARNING] UYARI: Temsilci '{ai_agent.get('name')}' ElevenLabs TTS olarak seçildi ancak ElevenLabs API Key henüz girilmemiş! Gemini Dahili Ses Motoruna geçiliyor.")

        # 2. Connect to Google Gemini Multimodal Live API via WebSocket
        if not GEMINI_API_KEY:
            print("Hata: GEMINI_API_KEY tanimlanmamis!")
            writer.close()
            await writer.wait_closed()
            return

        # Initialize Gemini WebSocket connection
        gemini_ws = None
        gemini_url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={GEMINI_API_KEY}"
        
        # We need a long timeout for the WebSocket connection since the model can take time to answer
        # The connection must stay alive during silence.
        print("Gemini Multimodal Live API WebSocket baglantisi kuruluyor...")
        
        for attempt in range(3):
            try:
                gemini_ws = await websockets.connect(gemini_url)
                break
            except Exception as e:
                print(f"Gemini baglanti denemesi {attempt+1} basarisiz: {e}")
                if attempt < 2:
                    await asyncio.sleep(0.5)
                    
        if not gemini_ws:
            print("Hata: Gemini WebSocket sunucusuna baglanilamadi!")
            if silence_task:
                silence_task.cancel()
                try:
                    await silence_task
                except Exception:
                    pass
            writer.close()
            await writer.wait_closed()
            return

        # Cancel the initial silence task once Gemini connection is ready
        if silence_task:
            silence_task.cancel()
            try:
                await silence_task
            except Exception:
                pass

        # Compile dynamic system instruction from database rules
        system_instruction = await compile_system_prompt(ai_agent)
        
        # Inject RAG Knowledge Base directly into system prompt for sub-second native voice responses
        kb_context = await get_all_knowledge_base_context()
        if kb_context:
            system_instruction += kb_context
            print(f"[RAG Live Inject] Bilgi bankası dökümanları doğrudan zeka motoruna yüklendi ({len(kb_context)} karakter).")
        
        # Check if Dynamic Emotion Management is enabled
        try:
            settings_data = load_settings()
            if settings_data.get("pbx", {}).get("auto_emotion_management", False):
                emotion_instruction = """
\n[DINAMIK DUYGU YONETIMI AKTIF]
Müşterinin konuşmalarındaki duygu durumunu takip et. 
Eğer müşteri sinirliyse, şikayetçiyse veya ses tonu/kelimeleri öfke barındırıyorsa, konuşma tarzını hemen çok daha yumuşak, sakinleştirici, sabırlı ve özür dileyen bir ses tonuna geçir.
Müşteriyi sakinleştirmeye çalış. 
Eğer müşteri üst üste 2 kez sinirli/öfkeli tepki vermeye devam ederse veya "temsilciye bağlanmak istiyorum" gibi bir talepte bulunursa, kesinlikle daha fazla uzatmadan "transfer_to_human" fonksiyonunu/aracını çağırarak görüşmeyi canlı temsilciye aktar. Aktarmadan hemen önce mutlaka "Sizi üst birime aktarıyorum" cümlesini kur.
"""
                system_instruction += emotion_instruction
                print("[Emotion Management] Dinamik duygu yönetimi kuralları sistem talimatlarına eklendi.")
        except Exception as e:
            print(f"[Emotion Management] Hata: {e}")
            
        # Check and load custom APIs
        custom_declarations = []
        try:
            settings_data = load_settings()
            custom_apis = settings_data.get("custom_apis", [])
            if custom_apis:
                api_instruction = "\n--- Kullanılabilir Özel CRM ve API Entegrasyonları ---\n"
                api_instruction += "Müşterinin talebine göre aşağıdaki fonksiyonları/araçları çağırarak sorgu yapabilirsin. Gelen yanıtı müşteriye Türkçe ve doğal bir ses tonuyla açıkla:\n"
                
                for api in custom_apis:
                    if not api.get("is_active", True):
                        continue
                    api_id = api.get("id")
                    api_name = api.get("name", "")
                    api_desc = api.get("description", "")
                    
                    api_instruction += f"- custom_api_{api_id}: {api_desc}\n"
                    
                    # Build tool parameters
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
                
                system_instruction += api_instruction
                print(f"[Custom API] {len(custom_declarations)} adet özel API entegrasyonu sistem talimatına eklendi.")
        except Exception as e:
            print(f"[Custom API] Hata: {e}")
            
        system_instruction += "\n\n--- OPERASYONEL EYLEM SİSTEM TALİMATLARI ---\n"
        system_instruction += "Sen canlı sesli bir müşteri temsilcisisin. Tüm döküman, ürün ve model sorularını sana sağlanan Bilgi Bankasından doğrudan Türkçe konuşarak yanıtla.\n"
        system_instruction += "Görüşme sırasında aşağıdaki durumlar gerçekleştiğinde cümlenin sonuna ilgili EYLEM KODUNU ekle:\n"
        system_instruction += "1. Görüşmeyi sonlandırmak / kapatmak için (müşteri vedalaştığında veya işlemler bittiğinde): Cümlenin sonuna '[ACTION: HANGUP]' yaz.\n"
        system_instruction += "2. Canlı temsilciye transfer etmek için (müşteri temsilci istediğinde): Cümlenin sonuna '[ACTION: TRANSFER]' yaz.\n"
        system_instruction += "3. Küfür/hakaret durumunda: Cümlenin sonuna '[ACTION: ABUSE]' yaz.\n"
        system_instruction += "Bu eylem kodlarını sesli okuma, sadece metne ekle.\n"
        print(f"Sistem talimatlari derlendi: {len(system_instruction)} karakter.")

        # Flexible voice resolution for Gemini voices (Puck, Charon, Kore, Fenrir, Aoede)
        agent_voice_raw = ai_agent.get("voice", VOICE_NAME) if ai_agent else VOICE_NAME
        valid_gemini_voices = ["Puck", "Charon", "Kore", "Fenrir", "Aoede"]
        agent_voice = "Aoede" # Default female voice
        
        for gv in valid_gemini_voices:
            if gv.lower() in str(agent_voice_raw).lower():
                agent_voice = gv
                break
                
        model_name = ai_agent.get("model", GEMINI_MODEL) if ai_agent else GEMINI_MODEL
        
        # Ensure we use a Live API compatible model
        if "2.0-flash-exp" in model_name or "1.5" in model_name or "1.0" in model_name or model_name == "gemini-2.0-flash" or "eleven" in model_name.lower() or not model_name.lower().startswith("gemini"):
            model_name = "models/gemini-2.5-flash-native-audio-latest"
            
        formatted_model = model_name if model_name.startswith("models/") else f"models/{model_name}"
            
        agent_temperature = float(ai_agent.get("temperature", 0.7)) if ai_agent else 0.7
        raw_max_tokens = int(ai_agent.get("max_tokens", 2048)) if ai_agent else 2048
        agent_max_tokens = max(raw_max_tokens, 2048)  # Audio tokens in live stream require ~60 tokens/sec; minimum 2048 ensures full responses without mid-sentence cutoff
        agent_name = ai_agent.get("name", "Varsayılan Temsilci") if ai_agent else "Varsayılan Temsilci"
        
        print(f"[AI Agent Active Config] Temsilci: '{agent_name}' | LLM Sağlayıcı: '{llm_provider.upper()}' (Model: '{formatted_model}') | TTS Sağlayıcı: '{tts_provider.upper()}' (Ses Tonu: '{agent_voice}', Ham: '{agent_voice_raw}') | Sıcaklık: {agent_temperature}")

        generation_config = {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": agent_voice
                    }
                }
            },
            "temperature": agent_temperature,
            "maxOutputTokens": agent_max_tokens
        }

        # Send Setup Config (without tools to prevent 1007 audio modality crashes)
        setup_msg = {
            "setup": {
                "model": formatted_model,
                "generationConfig": generation_config,
                "systemInstruction": {
                    "parts": [
                        {
                            "text": system_instruction
                        }
                    ]
                },
                "outputAudioTranscription": {},
                "inputAudioTranscription": {}
            }
        }
        await gemini_ws.send(json.dumps(setup_msg))
        print("Gemini Kurulum mesaji gonderildi.")

        # Send initial greeting request to Gemini so it speaks first
        greeting_msg = {
            "clientContent": {
                "turns": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": "Merhaba"
                            }
                        ]
                    }
                ],
                "turnComplete": True
            }
        }
        await gemini_ws.send(json.dumps(greeting_msg))
        print("Ilk karsilama tetikleme mesaji Gemini'ye gonderildi.")

        # 3. Tasks for handling bidirectional audio streams
        call_state = {"tool_call_in_progress": False, "should_hangup": False, "max_avg_amplitude": 0, "model_is_speaking": False, "language_detected": False}
        
        async def receive_from_asterisk_and_send_to_gemini():
            """Reads audio frames from Asterisk, buffers to 100ms (1600 bytes at 8kHz), resamples to 16kHz, streams to Gemini, and writes output back to Asterisk in sync with incoming frames (receiver-driven clock sync)."""
            try:
                frame_count = 0
                user_is_speaking = False
                silence_frames = 0
                audio_buffer = bytearray()
                
                silence_frame = b'\x00' * 320 # 20ms of silence (8kHz SLIN)
                header_out = b'\x10' + (320).to_bytes(2, byteorder='big')
                
                while True:
                    # Read Audiosocket frame: 3 bytes header (type + length)
                    h = await reader.readexactly(3)
                    m_type = h[0]
                    p_len = int.from_bytes(h[1:3], byteorder='big')
                    
                    if m_type == 0x00: # Hangup
                        print("Asterisk kapatma (hangup) sinyali aldi.")
                        break
                        
                    payload = await reader.readexactly(p_len)
                    
                    if m_type == 0x10: # Audio data (8kHz slin)
                        frame_count += 1
                        # Gürültü ve sessizlik analizi için genlik hesaplama
                        import array
                        samples = array.array('h', payload)
                        avg_amplitude = sum(abs(s) for s in samples) / len(samples) if samples else 0
                        if avg_amplitude > call_state["max_avg_amplitude"]:
                            call_state["max_avg_amplitude"] = avg_amplitude
                            
                        # Buffer 8kHz audio until we have 100ms (5 frames of 320 bytes = 1600 bytes)
                        audio_buffer.extend(payload)
                        
                        if len(audio_buffer) >= 1600:
                            buf_bytes = bytes(audio_buffer)
                            audio_buffer.clear()
                            
                            import array
                            samples_16 = array.array('h', buf_bytes)
                            buf_avg_amp = sum(abs(s) for s in samples_16) / len(samples_16) if samples_16 else 0
                            call_state["last_buf_amp"] = buf_avg_amp
                            
                            # Suppress line noise/echo while AI is speaking unless user speaks with clear voice (amp >= 250)
                            is_speaking = call_state.get("model_is_speaking", False)
                            if is_speaking and buf_avg_amp < 250:
                                pcm_16k = b'\x00' * 3200
                            else:
                                pcm_16k = resample_8k_to_16k(buf_bytes)
                            
                            b64_audio = base64.b64encode(pcm_16k).decode('utf-8')
                            if not call_state.get("tool_call_in_progress", False):
                                audio_msg = {
                                    "realtimeInput": {
                                        "mediaChunks": [
                                            {
                                                "mimeType": "audio/pcm;rate=16000",
                                                "data": b64_audio
                                            }
                                        ]
                                    }
                                }
                                await gemini_ws.send(json.dumps(audio_msg))
                        
                        # Sunucu tarafında VAD durum takibi ve loglama
                        if avg_amplitude > 40:
                            user_is_speaking = True
                            silence_frames = 0
                        else:
                            if user_is_speaking:
                                silence_frames += 1
                                if silence_frames >= 40:
                                    print("[DEBUG] Musteri konusmasini bitirdi (800ms sessizlik).")
                                    user_is_speaking = False
                                    silence_frames = 0
                                    
            except asyncio.IncompleteReadError:
                print("Asterisk soket baglantisi koptu (IncompleteRead).")
            except Exception as e:
                print(f"Asterisk okuma / Gemini gonderim hatasi: {e}")

        async def write_to_asterisk_loop():
            silence_frame = b'\x00' * 320
            header_out = b'\x10' + (320).to_bytes(2, byteorder='big')
            
            loop = asyncio.get_event_loop()
            next_time = loop.time()
            
            try:
                while True:
                    try:
                        audio_out = asterisk_write_queue.get_nowait()
                        if len(audio_out) < 320:
                            audio_out = audio_out + b'\x00' * (320 - len(audio_out))
                        elif len(audio_out) > 320:
                            audio_out = audio_out[:320]
                        asterisk_write_queue.task_done()
                    except asyncio.QueueEmpty:
                        if call_state["should_hangup"] and not call_state["model_is_speaking"]:
                            print("Görüşme sonlandırma aracı çağrıldı ve ses kuyruğu boşaldı. Çağrı sonlandırılıyor...")
                            if call_id:
                                from backend.services.ami_manager import hangup_call as ami_hangup_call
                                asyncio.create_task(ami_hangup_call(call_id))
                            break
                        audio_out = silence_frame
                    
                    writer.write(header_out + audio_out)
                    await writer.drain()
                    
                    # Absolute time pacing for exactly 50 FPS (20ms frames)
                    next_time += 0.02
                    delay = next_time - loop.time()
                    if delay > 0:
                        await asyncio.sleep(delay)
                    else:
                        # Reset clock if we fall behind to prevent sudden burst of frames
                        next_time = loop.time()
            except asyncio.CancelledError:
                pass
            except Exception as e:
                print(f"Asterisk yazma hatasi: {e}")



        async def receive_from_gemini_and_send_to_asterisk():
            """Reads response from Gemini, handles interruption/barge-in, resamples to 8kHz, and writes to Asterisk."""
            current_user_text = ""
            current_ai_text = ""
            
            try:
                settings_data = load_settings()
                auto_detect_lang = settings_data.get("pbx", {}).get("auto_language_detection", False)
            except Exception:
                auto_detect_lang = False
                
            audio_buffer = bytearray()
            
            try:
                async for raw_response in gemini_ws:
                    resp = json.loads(raw_response)
                    
                    # Update model speaking state
                    if "serverContent" in resp:
                        if "modelTurn" in resp["serverContent"]:
                            call_state["model_is_speaking"] = True
                            call_state["tool_call_in_progress"] = False
                        if resp["serverContent"].get("turnComplete"):
                            call_state["tool_call_in_progress"] = False
                            print("[DEBUG] turnComplete sinyali alindi. Ses kuyrugu bosalana kadar kilit tutuluyor...")
                            async def release_lock_after_drain(state, q):
                                try:
                                    await asyncio.wait_for(q.join(), timeout=15.0)
                                except asyncio.TimeoutError:
                                    pass
                                await asyncio.sleep(0.15)
                                if q.empty():
                                    state["model_is_speaking"] = False
                                    print("[DEBUG] AI konusmasi Asterisk uzerinde tamamen bitti, kilit acildi.")
                            asyncio.create_task(release_lock_after_drain(call_state, asterisk_write_queue))

                    # 1. Capture User Speech Transcription (inputTranscription)
                    if "serverContent" in resp and "inputTranscription" in resp["serverContent"]:
                        user_text = resp["serverContent"]["inputTranscription"].get("text", "")
                        if user_text:
                            current_user_text += user_text
                            print(f"[STT USER CHUNK]: {user_text}")

                    # 2. Capture AI Speech Transcription (outputTranscription)
                    if "serverContent" in resp and "outputTranscription" in resp["serverContent"]:
                        ai_text = resp["serverContent"]["outputTranscription"].get("text", "")
                        if ai_text:
                            current_ai_text += ai_text
                            print(f"[STT AI CHUNK]: {ai_text}")
                            
                            # Sentence-level real-time ElevenLabs streaming for sub-second latency
                            if is_elevenlabs_tts and elevenlabs_api_key:
                                import re
                                match = re.search(r'([^.!?;\n]+[.!?;\n])', current_ai_text)
                                if match:
                                    sentence = match.group(1).strip()
                                    current_ai_text = current_ai_text[match.end():]
                                    if sentence:
                                        asyncio.create_task(stream_elevenlabs_tts_to_asterisk(sentence, elevenlabs_voice_id, elevenlabs_stability, elevenlabs_similarity, elevenlabs_style, elevenlabs_api_key, asterisk_write_queue))

                    # 3. Write User Transcript to DB when AI starts speaking or tool is called
                    if ("serverContent" in resp and "modelTurn" in resp["serverContent"]) or ("toolCall" in resp):
                        if current_user_text.strip():
                            user_phrase = current_user_text.strip()
                            await write_db_transcript(call_id, "customer", user_phrase)
                            
                            # Check for block words (swearing, insult detection)
                            from sqlalchemy import select
                            async with AsyncSessionLocal() as session:
                                res_bw = await session.execute(select(BlockWord))
                                block_words = [bw.word.lower() for bw in res_bw.scalars().all()]
                            
                            user_phrase_lower = user_phrase.lower()
                            matched_word = None
                            for w in block_words:
                                if w in user_phrase_lower:
                                    matched_word = w
                                    break
                                    
                            if matched_word:
                                print(f"[Abuse Shield] Block word '{matched_word}' matched in user phrase: '{user_phrase}'")
                                await auto_blacklist_call(call_id, f"Yasaklı Kelime Tespiti: '{matched_word}'")
                                call_state["should_hangup"] = True
                            
                            if auto_detect_lang and not call_state.get("language_detected", False):
                                call_state["language_detected"] = True
                                if detect_is_english(user_phrase):
                                    print(f"[Language Detector] English speech detected: '{user_phrase}'. Injecting switch prompt to Gemini...")
                                    switch_msg = {
                                        "clientContent": {
                                            "turns": [
                                                {
                                                    "role": "user",
                                                    "parts": [
                                                        {
                                                            "text": "[SYSTEM NOTE: User is speaking English. Please switch completely to English from now on, translate your persona/prompt guidelines to English, reply in English and speak in English. Do not use Turkish anymore.]"
                                                        }
                                                    ]
                                                }
                                            ],
                                            "turnComplete": True
                                        }
                                    }
                                    await gemini_ws.send(json.dumps(switch_msg))
                                else:
                                    print(f"[Language Detector] Turkish/Other speech matched: '{user_phrase}'")
                                    
                            current_user_text = ""
                            
                    # Check for Interruption/Barge-in (Musteri lafa girdi)
                    if "serverContent" in resp and resp["serverContent"].get("interrupted"):
                        last_amp = call_state.get("last_buf_amp", 0)
                        if last_amp < 250:
                            print(f"[Barge-in Guard] Ignored false Gemini interruption event (low amp: {last_amp:.1f}).")
                            call_state["model_is_speaking"] = False
                            continue
                        print(f"Musteri lafa girdi (Barge-in/Interruption algilandi, amp: {last_amp:.1f}). Ses durduruluyor!")
                        call_state["model_is_speaking"] = False
                        # Clear write queue to stop playback instantly
                        while not asterisk_write_queue.empty():
                            try:
                                asterisk_write_queue.get_nowait()
                                asterisk_write_queue.task_done()
                            except (asyncio.QueueEmpty, ValueError):
                                break
                        # Save partial AI transcript with interrupted note
                        if current_ai_text.strip():
                            await write_db_transcript(call_id, "ai", current_ai_text.strip() + " [Sözü Kesildi]")
                            current_ai_text = ""
                        continue

                    # Check for model audio turn (modelTurn) to stream audio bytes to Asterisk
                    if not is_elevenlabs_tts and "serverContent" in resp and "modelTurn" in resp["serverContent"]:
                        parts = resp["serverContent"]["modelTurn"].get("parts", [])
                        for part in parts:
                            # Handle AI Audio
                            if "inlineData" in part:
                                mime = part["inlineData"].get("mimeType", "")
                                if "audio/pcm" in mime:
                                    b64_data = part["inlineData"]["data"]
                                    raw_pcm_24k = base64.b64decode(b64_data)
                                    # Resample 24kHz PCM to 8kHz PCM for Asterisk
                                    raw_pcm_8k = resample_24k_to_8k(raw_pcm_24k)
                                    
                                    audio_buffer.extend(raw_pcm_8k)
                                    
                                    # Extract exact 320 byte chunks
                                    while len(audio_buffer) >= 320:
                                        chunk = bytes(audio_buffer[:320])
                                        await asterisk_write_queue.put(chunk)
                                        del audio_buffer[:320]

                    # Save full AI response when turn is completed & trigger remaining ElevenLabs TTS if active
                    if "serverContent" in resp and resp["serverContent"].get("turnComplete"):
                        if current_ai_text.strip():
                            clean_ai_text = current_ai_text.strip()
                            if "[ACTION: HANGUP]" in clean_ai_text:
                                print("[Action Marker] Call hangup requested via [ACTION: HANGUP]")
                                call_state["should_hangup"] = True
                                clean_ai_text = clean_ai_text.replace("[ACTION: HANGUP]", "").strip()
                            if "[ACTION: TRANSFER]" in clean_ai_text:
                                print("[Action Marker] Call transfer requested via [ACTION: TRANSFER]")
                                clean_ai_text = clean_ai_text.replace("[ACTION: TRANSFER]", "").strip()
                                from backend.services.ami_manager import redirect_call_to_human
                                asyncio.create_task(redirect_call_to_human(call_id))
                            if "[ACTION: ABUSE]" in clean_ai_text:
                                print("[Action Marker] Abuse shield requested via [ACTION: ABUSE]")
                                call_state["should_hangup"] = True
                                clean_ai_text = clean_ai_text.replace("[ACTION: ABUSE]", "").strip()
                                asyncio.create_task(auto_blacklist_call(call_id, "Yapay Zeka Suistimal Tespiti"))

                            await write_db_transcript(call_id, "ai", clean_ai_text)
                            if is_elevenlabs_tts and elevenlabs_api_key:
                                asyncio.create_task(stream_elevenlabs_tts_to_asterisk(clean_ai_text, elevenlabs_voice_id, elevenlabs_stability, elevenlabs_similarity, elevenlabs_style, elevenlabs_api_key, asterisk_write_queue))
                            current_ai_text = ""
                            
                        # Flush any remaining audio in the buffer at the end of the turn
                        if len(audio_buffer) > 0:
                            await asterisk_write_queue.put(bytes(audio_buffer))
                            audio_buffer.clear()

                    # Check for Tool Calls (Gemini calls a function)
                    if "toolCall" in resp:
                        call_state["tool_call_in_progress"] = True
                        function_calls = resp["toolCall"].get("functionCalls", [])
                        function_responses = []
                        for call in function_calls:
                            call_name = call.get("name")
                            call_args = call.get("args", {})
                            call_uid = call.get("id")
                            
                            print(f"[Gemini] Fonksiyon cagirdi: {call_name} (Args: {call_args})")
                            if call_name == "hangup_call" or call_name == "trigger_abuse_shield":
                                call_state["should_hangup"] = True
                            if call_name == "trigger_abuse_shield":
                                reason_val = call_args.get("reason", "Yapay Zeka Suistimal Tespiti")
                                await auto_blacklist_call(call_id, reason_val)
                            
                            # Execute the tool call
                            tool_result = await handle_tool_call(call_name, call_args, call_id)
                            
                            function_responses.append({
                                "response": {
                                    "output": tool_result
                                },
                                "id": call_uid
                            })
                            
                        # Send responses back to Gemini
                        response_msg = {
                            "toolResponse": {
                                "functionResponses": function_responses
                            }
                        }
                        await gemini_ws.send(json.dumps(response_msg))
                        print("[Gemini] Fonksiyon cevabi iletildi. Model yaniti bekleniyor...")

            except Exception as e:
                print(f"Gemini okuma / Asterisk gonderim hatasi: {e}")

        # Start tasks concurrently
        whisper_listener_task = asyncio.create_task(listen_for_whispers(call_id, gemini_ws))
        rec_asterisk_task = asyncio.create_task(receive_from_asterisk_and_send_to_gemini())
        send_asterisk_task = asyncio.create_task(receive_from_gemini_and_send_to_asterisk())
        write_asterisk_task = asyncio.create_task(write_to_asterisk_loop())

        # Wait until any stream handling task finishes (e.g. socket close, hangup tool execution)
        done, pending = await asyncio.wait(
            [rec_asterisk_task, send_asterisk_task, write_asterisk_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        for t in done:
            if t.exception():
                print(f"[Task Exception] {t}: {t.exception()}")
            else:
                print(f"[Task Completed] {t}")
        
    except Exception as e:
        print(f"Audiosocket baglanti hatasi: {e}")
    finally:
        # Cancel running tasks
        if rec_asterisk_task: rec_asterisk_task.cancel()
        if send_asterisk_task: send_asterisk_task.cancel()
        if write_asterisk_task: write_asterisk_task.cancel()
        if whisper_listener_task: whisper_listener_task.cancel()
        
        # Close Gemini WebSocket
        if gemini_ws:
            try:
                await gemini_ws.close()
                print("Gemini Web Socket baglantisi kapatildi.")
            except Exception:
                pass
                
        # Close Asterisk TCP connection
        writer.close()
        try:
            await writer.wait_closed()
            print("Asterisk TCP baglantisi kapatildi.")
        except Exception:
            pass

        if call_id:
            max_amp = call_state.get('max_avg_amplitude', 0) if call_state else 0
            print(f"Arama Sonlandi. (call_id): {call_id} - Maksimum Algilanan Ses Genligi: {max_amp:.2f}")
            
            h_source = "customer"
            if call_state and call_state.get("should_hangup"):
                h_source = "ai"
                
            # Generate summary in background (optional, or just save end of call)
            await end_call_db(call_id, hangup_source=h_source)

async def start_server():
    server = await asyncio.start_server(handle_audiosocket_connection, '', PORT)
    addr = server.sockets[0].getsockname()
    print(f"Audiosocket TCP Sunucusu dinlemede: {addr}")
    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    import sys
    # Optimize Python thread/task switching interval for low-latency audio processing (from 15ms default to 5ms)
    sys.setswitchinterval(0.005)
    asyncio.run(start_server())
