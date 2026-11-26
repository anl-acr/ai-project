"""
Nornia Enterprise AI PBX — Multi-Engine Realtime Voice Orchestrator & Failover Engine.

Supported Live Audio Engines (with automatic failover chain):
  1. gemini_live          : Google Gemini Multimodal Live API (Native Audio WS)
  2. openai_realtime      : OpenAI Realtime API (gpt-4o-realtime-preview Native Audio WS)
  3. deepgram_cartesia    : Deepgram Nova-3 Streaming STT WS + Fast LLM + Cartesia Sonic 2 Streaming TTS
  4. deepgram_elevenlabs  : Deepgram Nova-3 Streaming STT WS + Fast LLM + ElevenLabs Flash v2.5 Streaming TTS

All engines share a unified Asterisk AudioSocket frame interface (8 kHz 16-bit LE PCM,
320-byte / 20ms chunks), live transcript broadcasting, barge-in interruption, action markers
([ACTION: HANGUP], [ACTION: TRANSFER:<ext>], [ACTION: TOOL_CALL ...]), and latency telemetry.
"""

from __future__ import annotations

import asyncio
import audioop
import base64
import json
import os
import re
import time
import urllib.parse
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

import httpx
import websockets

ENGINE_METADATA: Dict[str, Dict[str, Any]] = {
    "gemini_live": {
        "id": "gemini_live",
        "name": "Google Gemini Multimodal Live",
        "mode": "Speech-to-Speech (Native Audio)",
        "required_keys": ["google_api_key"],
        "default_model": "models/gemini-2.5-flash-native-audio-latest",
    },
    "openai_realtime": {
        "id": "openai_realtime",
        "name": "OpenAI Realtime API (GPT-4o Realtime)",
        "mode": "Speech-to-Speech (Native Audio)",
        "required_keys": ["openai_api_key"],
        "default_model": "gpt-4o-realtime-preview",
        "voices": ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"],
    },
    "deepgram_cartesia": {
        "id": "deepgram_cartesia",
        "name": "Deepgram Nova-3 + Cartesia Sonic 2",
        "mode": "Ultra-Low Latency Modular Streaming (STT -> LLM -> TTS)",
        "required_keys": ["deepgram_api_key", "cartesia_api_key"],
        "default_model": "nova-3 / sonic-2",
    },
    "deepgram_elevenlabs": {
        "id": "deepgram_elevenlabs",
        "name": "Deepgram Nova-3 + ElevenLabs Flash v2.5",
        "mode": "Modular Streaming (STT -> LLM -> ElevenLabs TTS)",
        "required_keys": ["deepgram_api_key", "elevenlabs_api_key"],
        "default_model": "nova-3 / eleven_flash_v2_5",
    },
}

DEFAULT_FAILOVER_CHAIN = [
    "gemini_live",
    "openai_realtime",
    "deepgram_cartesia",
    "deepgram_elevenlabs",
]


def get_provider_keys(settings_data: dict, tenant_id: str = "tenant-default") -> Dict[str, str]:
    tenant_map = settings_data.get("tenant_ai_providers") if isinstance(settings_data, dict) else {}
    t_keys = tenant_map.get(tenant_id) if isinstance(tenant_map, dict) else None
    base = settings_data.get("ai_providers") if isinstance(settings_data, dict) else {}
    src = t_keys if isinstance(t_keys, dict) and any(t_keys.values()) else (base if isinstance(base, dict) else {})

    def _k(field: str, env_name: str) -> str:
        return str(src.get(field) or os.getenv(env_name, "") or "").strip()

    return {
        "google_api_key": _k("google_api_key", "GEMINI_API_KEY"),
        "openai_api_key": _k("openai_api_key", "OPENAI_API_KEY"),
        "anthropic_api_key": _k("anthropic_api_key", "ANTHROPIC_API_KEY"),
        "groq_api_key": _k("groq_api_key", "GROQ_API_KEY"),
        "elevenlabs_api_key": _k("elevenlabs_api_key", "ELEVENLABS_API_KEY"),
        "deepgram_api_key": _k("deepgram_api_key", "DEEPGRAM_API_KEY"),
        "cartesia_api_key": _k("cartesia_api_key", "CARTESIA_API_KEY"),
    }


def _engine_has_keys(engine_id: str, keys: Dict[str, str]) -> bool:
    meta = ENGINE_METADATA.get(engine_id)
    if not meta:
        return False
    for rk in meta.get("required_keys", []):
        if not keys.get(rk):
            return False
    if engine_id in ("deepgram_cartesia", "deepgram_elevenlabs"):
        # Needs at least one LLM key (Groq, OpenAI, or Gemini)
        if not (keys.get("groq_api_key") or keys.get("openai_api_key") or keys.get("google_api_key")):
            return False
    return True


def resolve_voice_engine_chain(ai_agent: Optional[dict], keys: Dict[str, str]) -> List[str]:
    """
    Returns the ordered list of usable realtime voice engines for this AI Agent,
    starting with the configured primary engine followed by configured failover backups.
    """
    agent = ai_agent if isinstance(ai_agent, dict) else {}
    primary = str(agent.get("realtime_engine") or "").strip().lower()
    if primary not in ENGINE_METADATA:
        # Backward-compatible inference from existing provider fields
        stt_p = str(agent.get("stt_provider") or "").strip().lower()
        tts_p = str(agent.get("tts_provider") or "").strip().lower()
        llm_p = str(agent.get("llm_provider") or agent.get("provider") or "").strip().lower()
        if stt_p == "deepgram" and tts_p == "cartesia":
            primary = "deepgram_cartesia"
        elif stt_p == "deepgram" and tts_p == "elevenlabs":
            primary = "deepgram_elevenlabs"
        elif llm_p == "openai" and tts_p == "openai":
            primary = "openai_realtime"
        else:
            primary = "gemini_live"

    auto_failover = bool(agent.get("realtime_auto_failover", True))
    raw_chain = agent.get("realtime_failover_chain")
    candidates: List[str] = [primary]

    if auto_failover:
        if isinstance(raw_chain, list) and raw_chain:
            for item in raw_chain:
                e_id = str(item or "").strip().lower()
                if e_id in ENGINE_METADATA and e_id not in candidates:
                    candidates.append(e_id)
        for fallback_id in DEFAULT_FAILOVER_CHAIN:
            if fallback_id not in candidates:
                candidates.append(fallback_id)

    usable = [e for e in candidates if _engine_has_keys(e, keys)]
    return usable


def _send_audiosocket_pcm8k_frames(pcm_8k: bytes, write_queue: asyncio.Queue) -> None:
    """Splits raw 8kHz 16-bit mono PCM into 20ms (320-byte) AudioSocket frames."""
    chunk_size = 320
    for i in range(0, len(pcm_8k), chunk_size):
        chunk = pcm_8k[i:i + chunk_size]
        if len(chunk) < chunk_size:
            chunk = chunk + (b"\x00" * (chunk_size - len(chunk)))
        write_queue.put_nowait(chunk)


def _flush_queue(q: asyncio.Queue) -> None:
    while not q.empty():
        try:
            q.get_nowait()
        except Exception:
            break


# ==============================================================================
# 1. CARTESIA SONIC 2 & ELEVENLABS FLASH STREAMING TTS HELPERS
# ==============================================================================

async def stream_cartesia_tts_to_queue(
    text: str,
    api_key: str,
    write_queue: asyncio.Queue,
    voice_id: str = "",
    model_id: str = "sonic-2",
    language: str = "tr",
    cancel_event: Optional[asyncio.Event] = None,
) -> float:
    """
    Streams ultra-low-latency Cartesia Sonic 2 audio directly in native 8kHz pcm_s16le
    (zero resampling overhead!) into Asterisk's write_queue. Returns TTFB in ms.
    """
    clean_text = re.sub(r"\[ACTION:[^\]]+\]", "", str(text or "")).strip()
    if not clean_text or not api_key:
        return 0.0

    # Default Cartesia multilingual voice if user didn't specify a custom voice UUID
    resolved_voice = (voice_id or "").strip() or "a0e99841-438c-4a64-b679-ae501e7d6091"
    url = "https://api.cartesia.ai/tts/bytes"
    headers = {
        "X-API-Key": api_key,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
    }
    payload = {
        "model_id": model_id or "sonic-2",
        "transcript": clean_text,
        "voice": {"mode": "id", "id": resolved_voice},
        "language": language or "tr",
        "output_format": {
            "container": "raw",
            "encoding": "pcm_s16le",
            "sample_rate": 8000,
        },
    }

    t0 = time.perf_counter()
    ttfb_ms = 0.0
    buf = bytearray()
    async with httpx.AsyncClient(timeout=20.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                raise RuntimeError(f"Cartesia TTS HTTP {resp.status_code}: {err_body[:160]!r}")
            async for chunk in resp.aiter_bytes(chunk_size=1280):
                if cancel_event and cancel_event.is_set():
                    break
                if not chunk:
                    continue
                if ttfb_ms == 0.0:
                    ttfb_ms = (time.perf_counter() - t0) * 1000.0
                buf.extend(chunk)
                while len(buf) >= 320:
                    frame = bytes(buf[:320])
                    del buf[:320]
                    await write_queue.put(frame)
            if buf and not (cancel_event and cancel_event.is_set()):
                if len(buf) < 320:
                    buf.extend(b"\x00" * (320 - len(buf)))
                await write_queue.put(bytes(buf[:320]))
    return round(ttfb_ms, 1)


async def stream_elevenlabs_flash_to_queue(
    text: str,
    api_key: str,
    write_queue: asyncio.Queue,
    voice_id: str = "",
    stability: float = 0.5,
    similarity: float = 0.75,
    style: float = 0.0,
    cancel_event: Optional[asyncio.Event] = None,
) -> float:
    """Streams ElevenLabs Flash v2.5 (16kHz -> 8kHz) into Asterisk write_queue. Returns TTFB ms."""
    clean_text = re.sub(r"\[ACTION:[^\]]+\]", "", str(text or "")).strip()
    if not clean_text or not api_key:
        return 0.0

    vid = (voice_id or "").strip() or "EXAVITQu4vr4xnSDxMaL"
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}/stream?output_format=pcm_16000&optimize_streaming_latency=4"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "text": clean_text,
        "model_id": "eleven_flash_v2_5",
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity,
            "style": style,
            "use_speaker_boost": True,
        },
    }

    t0 = time.perf_counter()
    ttfb_ms = 0.0
    ratecv_state = None
    buf = bytearray()
    async with httpx.AsyncClient(timeout=20.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                raise RuntimeError(f"ElevenLabs Flash HTTP {resp.status_code}: {err_body[:160]!r}")
            async for chunk in resp.aiter_bytes(chunk_size=1280):
                if cancel_event and cancel_event.is_set():
                    break
                if not chunk:
                    continue
                if ttfb_ms == 0.0:
                    ttfb_ms = (time.perf_counter() - t0) * 1000.0
                # Ensure even sample byte count
                if len(chunk) % 2 != 0:
                    chunk = chunk[:-1]
                if not chunk:
                    continue
                pcm_8k, ratecv_state = audioop.ratecv(chunk, 2, 1, 16000, 8000, ratecv_state)
                buf.extend(pcm_8k)
                while len(buf) >= 320:
                    frame = bytes(buf[:320])
                    del buf[:320]
                    await write_queue.put(frame)
            if buf and not (cancel_event and cancel_event.is_set()):
                if len(buf) < 320:
                    buf.extend(b"\x00" * (320 - len(buf)))
                await write_queue.put(bytes(buf[:320]))
    return round(ttfb_ms, 1)


async def _fast_chat_completion(
    messages: List[Dict[str, str]],
    keys: Dict[str, str],
    preferred_llm: str = "",
    temperature: float = 0.6,
    max_tokens: int = 240,
) -> Tuple[str, str, float]:
    """
    Executes ultra-fast LLM completion with automatic provider failover
    (Groq Llama 3.3 70B -> OpenAI GPT-4o-mini -> Gemini 2.5 Flash).
    Returns: (reply_text, provider_used, latency_ms)
    """
    order = []
    pref = (preferred_llm or "").strip().lower()
    if pref in ("groq", "openai", "google"):
        order.append(pref)
    for p in ("groq", "openai", "google"):
        if p not in order:
            order.append(p)

    t0 = time.perf_counter()
    last_err = "no_llm_key"
    async with httpx.AsyncClient(timeout=12.0) as client:
        for prov in order:
            if prov == "groq" and keys.get("groq_api_key"):
                try:
                    res = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {keys['groq_api_key']}", "Content-Type": "application/json"},
                        json={
                            "model": "llama-3.3-70b-versatile",
                            "messages": messages,
                            "temperature": temperature,
                            "max_tokens": max_tokens,
                        },
                    )
                    if res.status_code == 200:
                        txt = res.json()["choices"][0]["message"]["content"].strip()
                        return txt, "groq", round((time.perf_counter() - t0) * 1000.0, 1)
                    last_err = f"groq_http_{res.status_code}"
                except Exception as e:
                    last_err = f"groq:{e}"
            elif prov == "openai" and keys.get("openai_api_key"):
                try:
                    res = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {keys['openai_api_key']}", "Content-Type": "application/json"},
                        json={
                            "model": "gpt-4o-mini",
                            "messages": messages,
                            "temperature": temperature,
                            "max_tokens": max_tokens,
                        },
                    )
                    if res.status_code == 200:
                        txt = res.json()["choices"][0]["message"]["content"].strip()
                        return txt, "openai", round((time.perf_counter() - t0) * 1000.0, 1)
                    last_err = f"openai_http_{res.status_code}"
                except Exception as e:
                    last_err = f"openai:{e}"
            elif prov == "google" and keys.get("google_api_key"):
                try:
                    sys_txt = "\n".join(m["content"] for m in messages if m["role"] == "system")
                    turns = []
                    for m in messages:
                        if m["role"] == "system":
                            continue
                        turns.append({
                            "role": "model" if m["role"] == "assistant" else "user",
                            "parts": [{"text": m["content"]}],
                        })
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={keys['google_api_key']}"
                    res = await client.post(
                        url,
                        json={
                            "systemInstruction": {"parts": [{"text": sys_txt}]},
                            "contents": turns,
                            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
                        },
                    )
                    if res.status_code == 200:
                        cands = res.json().get("candidates") or []
                        if cands:
                            txt = cands[0]["content"]["parts"][0]["text"].strip()
                            return txt, "google", round((time.perf_counter() - t0) * 1000.0, 1)
                    last_err = f"gemini_http_{res.status_code}"
                except Exception as e:
                    last_err = f"gemini:{e}"
    raise RuntimeError(f"LLM failover zinciri tükendi: {last_err}")


async def _handle_text_actions(
    text: str,
    call_id: str,
    transfer_target: str,
    on_hangup: Optional[Callable[[], Awaitable[None]]] = None,
    on_transfer: Optional[Callable[[str], Awaitable[None]]] = None,
) -> bool:
    """Detects [ACTION: HANGUP] / [ACTION: TRANSFER:<ext>] in AI output and triggers Asterisk action."""
    if not text:
        return False
    m_tr = re.search(r"\[ACTION:\s*TRANSFER(?::([a-zA-Z0-9_+-]+))?\]", text, re.IGNORECASE)
    if m_tr:
        target = (m_tr.group(1) or transfer_target or "200").strip()
        if on_transfer:
            await on_transfer(target)
        return True
    if re.search(r"\[ACTION:\s*HANGUP\]", text, re.IGNORECASE):
        if on_hangup:
            await on_hangup()
        return True
    return False


# ==============================================================================
# 2. ENGINE A: OPENAI REALTIME API (NATIVE SPEECH-TO-SPEECH WEBSOCKET)
# ==============================================================================

async def run_openai_realtime_session(
    call_id: str,
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    ai_agent: Optional[dict],
    keys: Dict[str, str],
    system_instruction: str,
    on_transcript: Callable[[str, str], Awaitable[None]],
    on_transfer: Callable[[str], Awaitable[None]],
    on_hangup: Callable[[], Awaitable[None]],
) -> None:
    """
    Runs a full-duplex live voice call over OpenAI Realtime API (gpt-4o-realtime-preview).
    Resamples Asterisk 8kHz PCM <-> OpenAI 24kHz PCM seamlessly with sub-second barge-in.
    """
    api_key = keys.get("openai_api_key", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY tanımlı değil.")

    agent = ai_agent if isinstance(ai_agent, dict) else {}
    model = str(agent.get("openai_realtime_model") or "gpt-4o-realtime-preview").strip()
    voice = str(agent.get("openai_realtime_voice") or "coral").strip().lower()
    if voice not in ENGINE_METADATA["openai_realtime"]["voices"]:
        voice = "coral"
    transfer_target = str(agent.get("transfer_target") or "200")
    greeting_prompt = str(agent.get("greeting_prompt") or "Merhaba, hoş geldiniz! Size nasıl yardımcı olabilirim?").strip()
    barge_in_enabled = bool(agent.get("barge_in_enabled", True))
    vad_silence_ms = int(agent.get("vad_silence_timeout_ms") or 700)

    ws_url = f"wss://api.openai.com/v1/realtime?model={urllib.parse.quote(model)}"
    ws_headers = {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    # Support both websockets>=14 (additional_headers) and older websockets (extra_headers)
    try:
        oai_ws = await asyncio.wait_for(
            websockets.connect(ws_url, additional_headers=ws_headers, max_size=None),
            timeout=8.0,
        )
    except TypeError:
        oai_ws = await asyncio.wait_for(
            websockets.connect(ws_url, extra_headers=ws_headers, max_size=None),
            timeout=8.0,
        )

    print(f"[OpenAI Realtime] Bağlandı! Call={call_id} | Model={model} | Voice={voice}", flush=True)

    write_queue: asyncio.Queue = asyncio.Queue()
    call_ended = asyncio.Event()
    turn_metrics: Dict[str, float] = {"user_done_ts": 0.0}

    # Configure Realtime Session
    session_update = {
        "type": "session.update",
        "session": {
            "modalities": ["audio", "text"],
            "instructions": system_instruction,
            "voice": voice,
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_transcription": {"model": "whisper-1"},
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.55,
                "prefix_padding_ms": 300,
                "silence_duration_ms": max(300, min(2000, vad_silence_ms)),
            },
            "temperature": float(agent.get("temperature", 0.7) or 0.7),
        },
    }
    await oai_ws.send(json.dumps(session_update))

    # Trigger initial greeting
    await oai_ws.send(json.dumps({
        "type": "response.create",
        "response": {
            "modalities": ["audio", "text"],
            "instructions": f"Arayanı hemen şu cümleyle samimi ve doğal biçimde karşıla: {greeting_prompt}",
        },
    }))

    async def _asterisk_writer():
        try:
            while not call_ended.is_set():
                try:
                    frame = await asyncio.wait_for(write_queue.get(), timeout=0.02)
                except asyncio.TimeoutError:
                    continue
                header = b"\x10" + len(frame).to_bytes(2, "big")
                writer.write(header + frame)
                await writer.drain()
                await asyncio.sleep(0.018)
        except Exception:
            pass

    async def _asterisk_reader():
        up_state = None
        try:
            while not call_ended.is_set():
                hdr = await reader.readexactly(3)
                msg_type = hdr[0]
                msg_len = int.from_bytes(hdr[1:3], "big")
                payload = await reader.readexactly(msg_len) if msg_len > 0 else b""
                if msg_type == 0x00:
                    call_ended.set()
                    break
                if msg_type == 0x10 and payload:
                    pcm_24k, up_state = audioop.ratecv(payload, 2, 1, 8000, 24000, up_state)
                    await oai_ws.send(json.dumps({
                        "type": "input_audio_buffer.append",
                        "audio": base64.b64encode(pcm_24k).decode("ascii"),
                    }))
        except (asyncio.IncompleteReadError, ConnectionResetError):
            call_ended.set()
        except Exception as e:
            print(f"[OpenAI Realtime Reader] {e}", flush=True)
            call_ended.set()

    async def _openai_listener():
        down_state = None
        first_audio_logged = False
        try:
            async for raw_msg in oai_ws:
                if call_ended.is_set():
                    break
                ev = json.loads(raw_msg)
                ev_type = ev.get("type") or ""

                if ev_type == "input_audio_buffer.speech_started":
                    if barge_in_enabled:
                        _flush_queue(write_queue)
                        try:
                            await oai_ws.send(json.dumps({"type": "response.cancel"}))
                        except Exception:
                            pass
                elif ev_type == "input_audio_buffer.speech_stopped":
                    turn_metrics["user_done_ts"] = time.perf_counter()
                    first_audio_logged = False
                elif ev_type == "response.audio.delta":
                    b64_delta = ev.get("delta") or ""
                    if b64_delta:
                        if not first_audio_logged and turn_metrics["user_done_ts"] > 0:
                            ttfb = round((time.perf_counter() - turn_metrics["user_done_ts"]) * 1000.0, 1)
                            print(f"[OpenAI Realtime Latency] Call={call_id} TTFB={ttfb} ms", flush=True)
                            first_audio_logged = True
                        pcm_24k = base64.b64decode(b64_delta)
                        pcm_8k, down_state = audioop.ratecv(pcm_24k, 2, 1, 24000, 8000, down_state)
                        _send_audiosocket_pcm8k_frames(pcm_8k, write_queue)
                elif ev_type == "conversation.item.input_audio_transcription.completed":
                    u_txt = str(ev.get("transcript") or "").strip()
                    if u_txt:
                        await on_transcript("Müşteri", u_txt)
                elif ev_type == "response.audio_transcript.done":
                    ai_txt = str(ev.get("transcript") or "").strip()
                    if ai_txt:
                        clean_t = re.sub(r"\[ACTION:[^\]]+\]", "", ai_txt).strip()
                        if clean_t:
                            await on_transcript("Yapay Zeka", clean_t)
                        acted = await _handle_text_actions(ai_txt, call_id, transfer_target, on_hangup, on_transfer)
                        if acted:
                            await asyncio.sleep(1.2)
                            call_ended.set()
                            break
                elif ev_type == "error":
                    print(f"[OpenAI Realtime Error] {ev.get('error')}", flush=True)
        except Exception as e:
            print(f"[OpenAI Realtime Listener] {e}", flush=True)
        finally:
            call_ended.set()

    tasks = [
        asyncio.create_task(_asterisk_writer()),
        asyncio.create_task(_asterisk_reader()),
        asyncio.create_task(_openai_listener()),
    ]
    try:
        await call_ended.wait()
    finally:
        for t in tasks:
            t.cancel()
        try:
            await oai_ws.close()
        except Exception:
            pass


# ==============================================================================
# 3. ENGINE B: DEEPGRAM NOVA-3 STREAMING STT + FAST LLM + CARTESIA / ELEVENLABS TTS
# ==============================================================================

async def run_deepgram_pipeline_session(
    call_id: str,
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    ai_agent: Optional[dict],
    keys: Dict[str, str],
    system_instruction: str,
    tts_mode: str,  # "cartesia" | "elevenlabs"
    on_transcript: Callable[[str, str], Awaitable[None]],
    on_transfer: Callable[[str], Awaitable[None]],
    on_hangup: Callable[[], Awaitable[None]],
) -> None:
    """
    Runs a full-duplex ultra-low-latency streaming voice call using:
      Asterisk 8kHz PCM -> Deepgram Nova-3 WS STT -> Fast LLM (Groq/OpenAI/Gemini)
      -> Cartesia Sonic 2 (native 8kHz PCM) or ElevenLabs Flash v2.5 -> Asterisk.
    """
    dg_key = keys.get("deepgram_api_key", "")
    if not dg_key:
        raise RuntimeError("DEEPGRAM_API_KEY tanımlı değil.")

    agent = ai_agent if isinstance(ai_agent, dict) else {}
    transfer_target = str(agent.get("transfer_target") or "200")
    greeting_prompt = str(agent.get("greeting_prompt") or "Merhaba, hoş geldiniz! Size nasıl yardımcı olabilirim?").strip()
    barge_in_enabled = bool(agent.get("barge_in_enabled", True))
    endpointing_ms = max(200, min(1500, int(agent.get("vad_silence_timeout_ms") or 400)))
    preferred_llm = str(agent.get("llm_provider") or "").strip().lower()
    cartesia_voice_id = str(agent.get("cartesia_voice_id") or "").strip()
    el_voice_id = str(agent.get("elevenlabs_voice_id") or "").strip()
    el_stab = float(agent.get("elevenlabs_stability", 0.5) or 0.5)
    el_sim = float(agent.get("elevenlabs_similarity", 0.75) or 0.75)
    el_style = float(agent.get("elevenlabs_style", 0.0) or 0.0)
    lang = str(agent.get("deepgram_language") or "tr").strip()

    dg_params = urllib.parse.urlencode({
        "model": "nova-3",
        "language": lang,
        "encoding": "linear16",
        "sample_rate": "8000",
        "channels": "1",
        "interim_results": "true",
        "endpointing": str(endpointing_ms),
        "smart_format": "true",
    })
    dg_url = f"wss://api.deepgram.com/v1/listen?{dg_params}"
    dg_headers = {"Authorization": f"Token {dg_key}"}

    try:
        dg_ws = await asyncio.wait_for(
            websockets.connect(dg_url, additional_headers=dg_headers, max_size=None),
            timeout=8.0,
        )
    except TypeError:
        dg_ws = await asyncio.wait_for(
            websockets.connect(dg_url, extra_headers=dg_headers, max_size=None),
            timeout=8.0,
        )

    print(f"[Deepgram+{tts_mode.capitalize()}] Bağlandı! Call={call_id} | Lang={lang}", flush=True)

    write_queue: asyncio.Queue = asyncio.Queue()
    call_ended = asyncio.Event()
    tts_cancel = asyncio.Event()
    speaking_task: Optional[asyncio.Task] = None
    history: List[Dict[str, str]] = [
        {"role": "system", "content": system_instruction + "\nYanıtların telefon konuşması için kısa (1-3 cümle), doğal ve akıcı olsun."}
    ]

    async def _speak(text_to_say: str) -> float:
        tts_cancel.clear()
        try:
            if tts_mode == "cartesia" and keys.get("cartesia_api_key"):
                return await stream_cartesia_tts_to_queue(
                    text_to_say,
                    api_key=keys["cartesia_api_key"],
                    write_queue=write_queue,
                    voice_id=cartesia_voice_id,
                    language=lang,
                    cancel_event=tts_cancel,
                )
            if keys.get("elevenlabs_api_key"):
                return await stream_elevenlabs_flash_to_queue(
                    text_to_say,
                    api_key=keys["elevenlabs_api_key"],
                    write_queue=write_queue,
                    voice_id=el_voice_id,
                    stability=el_stab,
                    similarity=el_sim,
                    style=el_style,
                    cancel_event=tts_cancel,
                )
            if keys.get("cartesia_api_key"):
                return await stream_cartesia_tts_to_queue(
                    text_to_say,
                    api_key=keys["cartesia_api_key"],
                    write_queue=write_queue,
                    voice_id=cartesia_voice_id,
                    language=lang,
                    cancel_event=tts_cancel,
                )
        except Exception as tts_err:
            print(f"[Deepgram Pipeline TTS Failover] {tts_mode} hata ({tts_err}), yedek TTS deneniyor...", flush=True)
            # Cross-fallback between Cartesia and ElevenLabs
            if tts_mode == "cartesia" and keys.get("elevenlabs_api_key"):
                return await stream_elevenlabs_flash_to_queue(
                    text_to_say, api_key=keys["elevenlabs_api_key"], write_queue=write_queue,
                    voice_id=el_voice_id, cancel_event=tts_cancel,
                )
            if tts_mode != "cartesia" and keys.get("cartesia_api_key"):
                return await stream_cartesia_tts_to_queue(
                    text_to_say, api_key=keys["cartesia_api_key"], write_queue=write_queue,
                    voice_id=cartesia_voice_id, language=lang, cancel_event=tts_cancel,
                )
        return 0.0

    # Immediate greeting
    history.append({"role": "assistant", "content": greeting_prompt})
    await on_transcript("Yapay Zeka", greeting_prompt)
    speaking_task = asyncio.create_task(_speak(greeting_prompt))

    async def _asterisk_writer():
        try:
            while not call_ended.is_set():
                try:
                    frame = await asyncio.wait_for(write_queue.get(), timeout=0.02)
                except asyncio.TimeoutError:
                    continue
                header = b"\x10" + len(frame).to_bytes(2, "big")
                writer.write(header + frame)
                await writer.drain()
                await asyncio.sleep(0.018)
        except Exception:
            pass

    async def _asterisk_reader():
        try:
            while not call_ended.is_set():
                hdr = await reader.readexactly(3)
                msg_type = hdr[0]
                msg_len = int.from_bytes(hdr[1:3], "big")
                payload = await reader.readexactly(msg_len) if msg_len > 0 else b""
                if msg_type == 0x00:
                    call_ended.set()
                    break
                if msg_type == 0x10 and payload:
                    await dg_ws.send(payload)
        except (asyncio.IncompleteReadError, ConnectionResetError):
            call_ended.set()
        except Exception as e:
            print(f"[Deepgram Reader] {e}", flush=True)
            call_ended.set()

    async def _deepgram_listener():
        nonlocal speaking_task
        utterance_parts: List[str] = []
        try:
            async for raw in dg_ws:
                if call_ended.is_set():
                    break
                data = json.loads(raw)
                if data.get("type") != "Results":
                    continue
                alt = ((data.get("channel") or {}).get("alternatives") or [{}])[0]
                transcript = str(alt.get("transcript") or "").strip()
                is_final = bool(data.get("is_final"))
                speech_final = bool(data.get("speech_final"))

                # Instant Barge-In on interim user speech
                if transcript and barge_in_enabled and speaking_task and not speaking_task.done():
                    tts_cancel.set()
                    _flush_queue(write_queue)

                if is_final and transcript:
                    utterance_parts.append(transcript)

                if speech_final and utterance_parts:
                    user_turn = " ".join(utterance_parts).strip()
                    utterance_parts.clear()
                    if not user_turn:
                        continue

                    t_turn = time.perf_counter()
                    await on_transcript("Müşteri", user_turn)
                    history.append({"role": "user", "content": user_turn})
                    if len(history) > 25:
                        history[:] = [history[0]] + history[-22:]

                    try:
                        reply_txt, llm_used, llm_ms = await _fast_chat_completion(
                            history,
                            keys=keys,
                            preferred_llm=preferred_llm,
                            temperature=float(agent.get("temperature", 0.65) or 0.65),
                            max_tokens=int(agent.get("max_tokens", 260) or 260),
                        )
                    except Exception as llm_err:
                        print(f"[Deepgram Pipeline LLM Error] {llm_err}", flush=True)
                        reply_txt, llm_used, llm_ms = "Şu an kısa bir gecikme yaşıyorum, sizi hemen temsilciye aktarıyorum. [ACTION: TRANSFER]", "fallback", 0.0

                    clean_reply = re.sub(r"\[ACTION:[^\]]+\]", "", reply_txt).strip()
                    history.append({"role": "assistant", "content": clean_reply or reply_txt})
                    if clean_reply:
                        await on_transcript("Yapay Zeka", clean_reply)
                        tts_ms = await _speak(clean_reply)
                        total_ms = round((time.perf_counter() - t_turn) * 1000.0, 1)
                        print(
                            f"[Deepgram+{tts_mode.capitalize()} Latency] Call={call_id} "
                            f"LLM({llm_used})={llm_ms}ms | TTS_TTFB={tts_ms}ms | Total={total_ms}ms",
                            flush=True,
                        )

                    acted = await _handle_text_actions(reply_txt, call_id, transfer_target, on_hangup, on_transfer)
                    if acted:
                        await asyncio.sleep(1.5)
                        call_ended.set()
                        break
        except Exception as e:
            print(f"[Deepgram Listener] {e}", flush=True)
        finally:
            call_ended.set()

    tasks = [
        asyncio.create_task(_asterisk_writer()),
        asyncio.create_task(_asterisk_reader()),
        asyncio.create_task(_deepgram_listener()),
    ]
    try:
        await call_ended.wait()
    finally:
        tts_cancel.set()
        if speaking_task and not speaking_task.done():
            speaking_task.cancel()
        for t in tasks:
            t.cancel()
        try:
            await dg_ws.close()
        except Exception:
            pass


# ==============================================================================
# 4. LIVE PROVIDER HEALTH & LATENCY CHECK (FOR MANAGEMENT UI)
# ==============================================================================

async def test_realtime_voice_providers(keys: Dict[str, str]) -> Dict[str, Any]:
    """Tests connectivity and measures live latency (ms) for every configured voice engine key."""
    results: Dict[str, Any] = {}

    async def _probe(name: str, coro):
        t0 = time.perf_counter()
        try:
            detail = await asyncio.wait_for(coro, timeout=6.0)
            results[name] = {"status": "ok", "latency_ms": round((time.perf_counter() - t0) * 1000.0, 1), "detail": detail}
        except Exception as exc:
            results[name] = {"status": "error", "latency_ms": round((time.perf_counter() - t0) * 1000.0, 1), "detail": str(exc)}

    async with httpx.AsyncClient(timeout=6.0) as client:
        probes = []

        if keys.get("google_api_key"):
            async def _p_gem():
                r = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={keys['google_api_key']}")
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}")
                return "Gemini Live API erişilebilir"
            probes.append(_probe("gemini_live", _p_gem()))
        else:
            results["gemini_live"] = {"status": "unconfigured", "detail": "Google API Key girilmemiş"}

        if keys.get("openai_api_key"):
            async def _p_oai():
                r = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {keys['openai_api_key']}"},
                )
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}")
                return "OpenAI Realtime API erişilebilir"
            probes.append(_probe("openai_realtime", _p_oai()))
        else:
            results["openai_realtime"] = {"status": "unconfigured", "detail": "OpenAI API Key girilmemiş"}

        if keys.get("deepgram_api_key"):
            async def _p_dg():
                r = await client.get(
                    "https://api.deepgram.com/v1/projects",
                    headers={"Authorization": f"Token {keys['deepgram_api_key']}"},
                )
                if r.status_code not in (200, 403):
                    raise RuntimeError(f"HTTP {r.status_code}")
                return "Deepgram Nova-3 STT erişilebilir"
            probes.append(_probe("deepgram", _p_dg()))
        else:
            results["deepgram"] = {"status": "unconfigured", "detail": "Deepgram API Key girilmemiş"}

        if keys.get("cartesia_api_key"):
            async def _p_cart():
                r = await client.get(
                    "https://api.cartesia.ai/voices",
                    headers={"X-API-Key": keys["cartesia_api_key"], "Cartesia-Version": "2024-06-10"},
                )
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}")
                return "Cartesia Sonic 2 TTS erişilebilir"
            probes.append(_probe("cartesia", _p_cart()))
        else:
            results["cartesia"] = {"status": "unconfigured", "detail": "Cartesia API Key girilmemiş"}

        if keys.get("elevenlabs_api_key"):
            async def _p_el():
                r = await client.get(
                    "https://api.elevenlabs.io/v1/user",
                    headers={"xi-api-key": keys["elevenlabs_api_key"]},
                )
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}")
                return "ElevenLabs Flash v2.5 erişilebilir"
            probes.append(_probe("elevenlabs", _p_el()))
        else:
            results["elevenlabs"] = {"status": "unconfigured", "detail": "ElevenLabs API Key girilmemiş"}

        if probes:
            await asyncio.gather(*probes)

    return {"status": "success", "engines": results, "catalog": ENGINE_METADATA}
