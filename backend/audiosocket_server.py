import asyncio
import os
import json
import base64
import datetime
import websockets
from sqlalchemy import update
from backend.database.config import AsyncSessionLocal
from backend.database.models import Call, Transcript
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

SETTINGS_FILE = "/Users/anilacar/ai-project/backend/settings.json"

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Settings] Error loading settings: {e}")
    return {}

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

def get_greeting_prompt_for_did(did: str) -> str:
    """Finds the trunk config matching the dialed DID and returns its custom greeting prompt."""
    if not did:
        did = "s"
    
    settings = load_settings()
    trunks = settings.get("trunks", [])
    
    # Try exact/substring match first for active trunks
    for t in trunks:
        if not t.get("is_active", True):
            continue
        t_did = t.get("did_number", "")
        if t_did and (t_did in did or did in t_did or t_did.strip('0') == did.strip('0')):
            prompt = t.get("greeting_prompt", "")
            if prompt and prompt.strip():
                return prompt
                
    # Fallback: If DID is "s" or we didn't find any match, use the first active trunk's prompt
    for t in trunks:
        if t.get("is_active", True):
            prompt = t.get("greeting_prompt", "")
            if prompt and prompt.strip():
                return prompt
                
    # Fallback to default prompt if not found
    return "Merhaba, ben sizin yapay zeka asistanınızım. Size nasıl yardımcı olabilirim?"

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

async def end_call_db(call_id: str, summary: str = None):
    """Updates call record to completed."""
    async with AsyncSessionLocal() as session:
        db_call = await session.get(Call, call_id)
        if db_call:
            db_call.status = "completed" if db_call.status == "in_progress" else db_call.status
            db_call.end_time = datetime.datetime.utcnow()
            if summary:
                db_call.summary = summary
            db_call.recording_path = f"/api/recordings/{call_id}.wav"
            await session.commit()

async def handle_audiosocket_connection(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    peer = writer.get_extra_info('peername')
    print(f"Asterisk baglantisi alindi: {peer}")

    call_id = None
    gemini_ws = None
    asterisk_write_queue = asyncio.Queue()

    # Task references
    rec_asterisk_task = None
    send_asterisk_task = None
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
        
        # Start sending silence to Asterisk immediately to keep RTP alive during handshake
        silence_task = asyncio.create_task(send_initial_silence(writer))

        # Get dynamic greeting prompt based on dialed DID (Wait 200ms to ensure dialplan API request is fully processed)
        await asyncio.sleep(0.2)
        did = await get_call_did(call_id)
        greeting_prompt = get_greeting_prompt_for_did(did)
        print(f"Arama DID: {did} -> Secilen karsilama metni: {greeting_prompt}")

        # 2. Connect to Google Gemini Multimodal Live API via WebSocket
        if not GEMINI_API_KEY:
            print("Hata: GEMINI_API_KEY tanimlanmamis!")
            writer.close()
            await writer.wait_closed()
            return

        gemini_url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={GEMINI_API_KEY}"
        
        print("Gemini Multimodal Live API WebSocket baglantisi kuruluyor...")
        
        gemini_ws = None
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
        system_instruction = await compile_system_prompt(greeting_prompt)
        print(f"Sistem talimatlari derlendi: {len(system_instruction)} karakter.")

        # Send Setup Config
        setup_msg = {
            "setup": {
                "model": GEMINI_MODEL,
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "temperature": 0.1,
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": VOICE_NAME
                            }
                        }
                    }
                },
                "systemInstruction": {
                    "parts": [
                        {
                            "text": system_instruction
                        }
                    ]
                },
                "tools": [
                    {
                        "functionDeclarations": [
                            {
                                "name": "transfer_to_human",
                                "description": "Çağrıyı veya sohbeti canlı müşteri temsilcisine transfer eder. Yapay zeka cevaplayamadığında veya müşteri talep ettiğinde çağrılır.",
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
                            },
                            {
                                "name": "hangup_call",
                                "description": "Görüşmeyi sonlandırır. Müşteri işlemlerini tamamladığında veya vedalaştığında çağrıyı kapatmak için bu aracı çalıştır.",
                                "parameters": {
                                    "type": "OBJECT",
                                    "properties": {}
                                }
                            }
                        ]
                    }
                ],
                "outputAudioTranscription": {},
                "inputAudioTranscription": {}
            }
        }
        await gemini_ws.send(json.dumps(setup_msg))
        print("Gemini Kurulum mesaji (ve Arac tanimlari) gonderildi.")

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
        call_state = {"tool_call_in_progress": False, "should_hangup": False, "max_avg_amplitude": 0, "model_is_speaking": False}
        
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
                            pcm_16k = resample_8k_to_16k(bytes(audio_buffer))
                            audio_buffer.clear()
                            
                            b64_audio = base64.b64encode(pcm_16k).decode('utf-8')
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
                                    
                        # Perfect Clock Sync: Write exactly one 20ms frame to Asterisk for every 20ms frame received
                        try:
                            # Pull from write queue (AI speech)
                            audio_out = asterisk_write_queue.get_nowait()
                            # Ensure chunk is exactly 320 bytes
                            if len(audio_out) < 320:
                                audio_out = audio_out + b'\x00' * (320 - len(audio_out))
                            elif len(audio_out) > 320:
                                audio_out = audio_out[:320]
                            asterisk_write_queue.task_done()
                        except asyncio.QueueEmpty:
                            if call_state["should_hangup"] and not call_state["model_is_speaking"]:
                                print("Görüşme sonlandırma aracı çağrıldı ve ses kuyruğu boşaldı. Çağrı sonlandırılıyor...")
                            audio_out = silence_frame
                            
                        # Write to Asterisk socket
                        writer.write(header_out + audio_out)
                        await writer.drain()
            except asyncio.IncompleteReadError:
                print("Asterisk soket baglantisi koptu (IncompleteRead).")
            except Exception as e:
                print(f"Asterisk okuma / Gemini gonderim hatasi: {e}")

        async def receive_from_gemini_and_send_to_asterisk():
            """Reads response from Gemini, handles interruption/barge-in, resamples to 8kHz, and writes to Asterisk."""
            current_user_text = ""
            current_ai_text = ""
            try:
                async for raw_response in gemini_ws:
                    resp = json.loads(raw_response)
                    
                    # Update model speaking state to prevent 1007 protocol violations during output
                    if "serverContent" in resp:
                        if "modelTurn" in resp["serverContent"]:
                            call_state["model_is_speaking"] = True
                        if resp["serverContent"].get("turnComplete"):
                            # Wait for the audio queue to drain before freeing the model_is_speaking lock
                            async def release_lock_after_drain(state, q):
                                await q.join()
                                await asyncio.sleep(0.2) # small buffer
                                if q.empty():
                                    state["model_is_speaking"] = False
                                    print("[DEBUG] AI konusmasi tamamen bitti, kilit acildi.")
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

                    # 3. Write User Transcript to DB when AI starts speaking or tool is called
                    if ("serverContent" in resp and "modelTurn" in resp["serverContent"]) or ("toolCall" in resp):
                        if current_user_text.strip():
                            await write_db_transcript(call_id, "customer", current_user_text.strip())
                            current_user_text = ""
                            
                    # Check for Interruption/Barge-in (Musteri lafa girdi)
                    if "serverContent" in resp and resp["serverContent"].get("interrupted"):
                        print("Musteri lafa girdi (Barge-in/Interruption algilandi). Ses durduruluyor!")
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
                    if "serverContent" in resp and "modelTurn" in resp["serverContent"]:
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
                                    
                                    # Chunk into 320-byte blocks (20ms frames at 8kHz SLIN) to avoid RTP drops
                                    for offset in range(0, len(raw_pcm_8k), 320):
                                        chunk = raw_pcm_8k[offset:offset+320]
                                        if len(chunk) < 320:
                                            chunk = chunk + b'\x00' * (320 - len(chunk))
                                        await asterisk_write_queue.put(chunk)

                    # Save full AI response when turn is completed
                    if "serverContent" in resp and resp["serverContent"].get("turnComplete"):
                        if current_ai_text.strip():
                            await write_db_transcript(call_id, "ai", current_ai_text.strip())
                            current_ai_text = ""

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
                            if call_name == "hangup_call":
                                call_state["should_hangup"] = True
                            
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
                        print("[Gemini] Fonksiyon cevabi iletildi.")
                        call_state["tool_call_in_progress"] = False

            except Exception as e:
                print(f"Gemini okuma / Asterisk gonderim hatasi: {e}")

        # Start tasks concurrently
        rec_asterisk_task = asyncio.create_task(receive_from_asterisk_and_send_to_gemini())
        send_asterisk_task = asyncio.create_task(receive_from_gemini_and_send_to_asterisk())

        # Wait until any stream handling task finishes (e.g. socket close, hangup tool execution)
        done, pending = await asyncio.wait(
            [rec_asterisk_task, send_asterisk_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
    except Exception as e:
        print(f"Audiosocket baglanti hatasi: {e}")
    finally:
        # Cancel running tasks
        if silence_task: silence_task.cancel()
        if rec_asterisk_task: rec_asterisk_task.cancel()
        if send_asterisk_task: send_asterisk_task.cancel()
        
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
            # Generate summary in background (optional, or just save end of call)
            await end_call_db(call_id)

async def start_server():
    server = await asyncio.start_server(handle_audiosocket_connection, '0.0.0.0', PORT)
    addr = server.sockets[0].getsockname()
    print(f"Audiosocket TCP Sunucusu dinlemede: {addr}")
    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    import sys
    # Optimize Python thread/task switching interval for low-latency audio processing (from 15ms default to 5ms)
    sys.setswitchinterval(0.005)
    asyncio.run(start_server())
