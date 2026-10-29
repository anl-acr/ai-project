import os
import gc
import json
import time
import asyncio
import httpx
from typing import Optional, Dict, Any, List, Tuple

# Global single-worker FIFO lock for local CPU/GPU tasks so two models NEVER load concurrently
_LOCAL_AI_QUEUE_LOCK = asyncio.Lock()

# Runtime telemetry for UI visibility
AI_ROUTER_STATS = {
    "queue_waiting": 0,
    "active_task": None,
    "active_since": None,
    "paused_for_active_call": False,
    "total_local_jobs": 0,
    "total_cloud_jobs": 0,
    "total_cloud_fallbacks": 0,
    "estimated_saved_tokens": 0,
    "last_error": "",
    "last_completed_at": None,
}

DEFAULT_AI_TASK_ROUTING = {
    # Connection & Hardware Guardrails (tuned safely for 4 vCPU / 4 GB RAM by default)
    "ollama_base_url": "http://127.0.0.1:11434",
    "ollama_api_key": "",
    "whisper_mode": "local_python",  # "local_python" | "remote_http"
    "whisper_remote_url": "http://127.0.0.1:8090",
    "whisper_remote_api_key": "",
    "whisper_model_size": "base",  # "tiny" (~120MB) | "base" (~180MB) | "small" (~480MB)
    "max_cpu_threads": 2,
    "sequential_queue_enabled": True,
    "auto_unload_ram": True,  # keep_alive=0 so RAM drops to 0 MB immediately after job finishes
    "pause_during_active_calls": True,  # Pause local 127.0.0.1 CPU jobs while active phone calls exist
    "max_call_wait_seconds": 180,
    "cloud_fallback_enabled": True,
    "fallback_provider": "gemini",
    "fallback_model": "gemini-2.5-flash",
    "request_timeout_seconds": 90,
    # Task-specific routing matrix (Voice AI, WhatsApp & Live Translator intentionally excluded)
    "tasks": {
        "call_transcription": {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "enabled": True,
        },
        "call_summary_sentiment": {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "enabled": True,
        },
        "call_qa_scoring": {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "enabled": True,
        },
        "chat_qa_scoring": {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "enabled": True,
        },
        "rag_embeddings": {
            "provider": "gemini",
            "model": "models/gemini-embedding-001",
            "enabled": True,
        },
        "rag_knowledge_synthesis": {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "enabled": True,
        },
        "scenario_generator": {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "enabled": True,
        },
        "api_wizard_assistant": {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "enabled": True,
        },
        "announcement_tts": {
            "provider": "edge_tts",
            "model": "tr-TR-EmelNeural",
            "enabled": True,
        },
    },
}


def _load_raw_settings() -> dict:
    try:
        from backend.main import settings_db
        if isinstance(settings_db, dict) and settings_db:
            return settings_db
    except Exception:
        pass
    try:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "settings.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def get_ai_task_routing_config(tenant_id: str = "tenant-default") -> dict:
    s_db = _load_raw_settings()
    raw_cfg = s_db.get("ai_task_routing")
    if isinstance(s_db.get("tenant_ai_task_routing"), dict) and tenant_id not in (None, "", "tenant-default", "default", "all", "global"):
        t_cfg = s_db["tenant_ai_task_routing"].get(tenant_id)
        if isinstance(t_cfg, dict) and t_cfg:
            raw_cfg = t_cfg

    merged = json.loads(json.dumps(DEFAULT_AI_TASK_ROUTING))
    if isinstance(raw_cfg, dict):
        for k, v in raw_cfg.items():
            if k == "tasks" and isinstance(v, dict):
                for tk, tv in v.items():
                    if tk in merged["tasks"] and isinstance(tv, dict):
                        merged["tasks"][tk].update(tv)
                    elif isinstance(tv, dict):
                        merged["tasks"][tk] = tv
            elif v is not None:
                merged[k] = v
    return merged


def _resolve_cloud_api_keys(tenant_id: str = "tenant-default") -> dict:
    s_db = _load_raw_settings()
    global_prov = s_db.get("ai_providers") if isinstance(s_db.get("ai_providers"), dict) else {}
    tenant_prov = {}
    if isinstance(s_db.get("tenant_ai_providers"), dict) and tenant_id:
        tenant_prov = s_db["tenant_ai_providers"].get(tenant_id) or {}

    gemini_key = (
        tenant_prov.get("google_api_key")
        or tenant_prov.get("gemini_api_key")
        or global_prov.get("google_api_key")
        or global_prov.get("gemini_api_key")
        or s_db.get("gemini_api_key")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    ).strip()

    openai_key = (
        tenant_prov.get("openai_api_key")
        or global_prov.get("openai_api_key")
        or os.getenv("OPENAI_API_KEY")
        or ""
    ).strip()

    anthropic_key = (
        tenant_prov.get("anthropic_api_key")
        or global_prov.get("anthropic_api_key")
        or os.getenv("ANTHROPIC_API_KEY")
        or ""
    ).strip()

    groq_key = (
        tenant_prov.get("groq_api_key")
        or global_prov.get("groq_api_key")
        or os.getenv("GROQ_API_KEY")
        or ""
    ).strip()

    elevenlabs_key = (
        tenant_prov.get("elevenlabs_api_key")
        or global_prov.get("elevenlabs_api_key")
        or os.getenv("ELEVENLABS_API_KEY")
        or ""
    ).strip()

    return {
        "gemini": gemini_key,
        "openai": openai_key,
        "anthropic": anthropic_key,
        "groq": groq_key,
        "elevenlabs": elevenlabs_key,
    }


def _is_url_local_host(url_str: str) -> bool:
    u = str(url_str or "").lower()
    return ("127.0.0.1" in u) or ("localhost" in u) or ("0.0.0.0" in u) or ("::1" in u)


def _get_active_pbx_call_count() -> int:
    try:
        from backend.services.ami_manager import active_channels
        return len(active_channels)
    except Exception:
        return 0


async def _wait_for_pbx_idle_if_needed(cfg: dict, target_url: str):
    """
    If local AI runs on the same PBX host (127.0.0.1) and pause_during_active_calls is enabled,
    politely wait until active telephone calls finish so Asterisk audio never stutters on 4-CPU servers.
    External AI server IPs bypass this wait automatically.
    """
    if not cfg.get("pause_during_active_calls", True):
        return
    if not _is_url_local_host(target_url):
        return

    max_wait = max(0, int(cfg.get("max_call_wait_seconds") or 180))
    waited = 0
    while waited < max_wait:
        active_cnt = _get_active_pbx_call_count()
        if active_cnt <= 0:
            AI_ROUTER_STATS["paused_for_active_call"] = False
            return
        AI_ROUTER_STATS["paused_for_active_call"] = True
        await asyncio.sleep(3.0)
        waited += 3
    AI_ROUTER_STATS["paused_for_active_call"] = False


async def _call_ollama_chat(
    cfg: dict,
    model_name: str,
    prompt: str,
    system_instruction: str = "",
    json_mode: bool = False,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    base_url = str(cfg.get("ollama_base_url") or "http://127.0.0.1:11434").rstrip("/")
    api_key = str(cfg.get("ollama_api_key") or "").strip()
    timeout_s = max(10, int(cfg.get("request_timeout_seconds") or 90))
    num_threads = max(1, min(16, int(cfg.get("max_cpu_threads") or 2)))
    auto_unload = bool(cfg.get("auto_unload_ram", True))

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    if history:
        for msg in history:
            role = "user" if msg.get("sender") in ("user", "customer") or msg.get("role") == "user" else "assistant"
            txt = str(msg.get("text") or msg.get("content") or "").strip()
            if txt:
                messages.append({"role": role, "content": txt})
    messages.append({"role": "user", "content": prompt})

    body: Dict[str, Any] = {
        "model": model_name or "qwen2.5:1.5b",
        "messages": messages,
        "stream": False,
        "keep_alive": 0 if auto_unload else "5m",
        "options": {
            "num_thread": num_threads,
            "temperature": 0.15 if json_mode else 0.3,
            "num_ctx": 4096,
        },
    }
    if json_mode:
        body["format"] = "json"

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    async with httpx.AsyncClient(timeout=float(timeout_s)) as client:
        # Support both native Ollama (/api/chat) and OpenAI-compatible (/v1/chat/completions) servers
        if base_url.endswith("/v1"):
            oai_body: Dict[str, Any] = {
                "model": model_name or "qwen2.5:1.5b",
                "messages": messages,
                "temperature": 0.15 if json_mode else 0.3,
            }
            if json_mode:
                oai_body["response_format"] = {"type": "json_object"}
            resp = await client.post(f"{base_url}/chat/completions", json=oai_body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
        else:
            resp = await client.post(f"{base_url}/api/chat", json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return ((data.get("message") or {}).get("content") or "").strip()


async def _call_cloud_llm(
    provider: str,
    model_name: str,
    prompt: str,
    system_instruction: str = "",
    json_mode: bool = False,
    history: Optional[List[Dict[str, str]]] = None,
    tenant_id: str = "tenant-default",
) -> str:
    keys = _resolve_cloud_api_keys(tenant_id)
    prov = (provider or "gemini").lower()

    if prov == "gemini":
        g_key = keys["gemini"]
        if not g_key:
            raise RuntimeError("Gemini API anahtarı tanımlı değil.")
        models_to_try = [model_name] if model_name and "gemini" in model_name.lower() else []
        for fb in ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"):
            if fb not in models_to_try:
                models_to_try.append(fb)

        contents = []
        if history:
            for msg in history:
                role = "user" if msg.get("sender") in ("user", "customer") or msg.get("role") == "user" else "model"
                txt = str(msg.get("text") or msg.get("content") or "").strip()
                if txt:
                    contents.append({"role": role, "parts": [{"text": txt}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        gen_cfg: Dict[str, Any] = {"temperature": 0.15 if json_mode else 0.3}
        if json_mode:
            gen_cfg["responseMimeType"] = "application/json"

        req_payload: Dict[str, Any] = {"contents": contents, "generationConfig": gen_cfg}
        if system_instruction:
            req_payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        last_err = None
        async with httpx.AsyncClient(timeout=35.0) as client:
            for m in models_to_try:
                clean_m = m.replace("models/", "")
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_m}:generateContent?key={g_key}"
                try:
                    r = await client.post(url, json=req_payload)
                    if r.status_code == 200:
                        rj = r.json()
                        txt = (
                            rj.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        if txt and txt.strip():
                            return txt.strip()
                    else:
                        last_err = f"HTTP {r.status_code}: {r.text[:180]}"
                except Exception as e:
                    last_err = str(e)
        raise RuntimeError(f"Gemini yanıt vermedi: {last_err}")

    elif prov in ("openai", "groq"):
        api_key = keys["openai"] if prov == "openai" else keys["groq"]
        if not api_key:
            raise RuntimeError(f"{prov.upper()} API anahtarı tanımlı değil.")
        url = "https://api.openai.com/v1/chat/completions" if prov == "openai" else "https://api.groq.com/openai/v1/chat/completions"
        default_m = "gpt-4o-mini" if prov == "openai" else "llama-3.3-70b-versatile"
        use_model = model_name or default_m

        msgs = []
        if system_instruction:
            msgs.append({"role": "system", "content": system_instruction})
        if history:
            for msg in history:
                role = "user" if msg.get("sender") in ("user", "customer") or msg.get("role") == "user" else "assistant"
                txt = str(msg.get("text") or msg.get("content") or "").strip()
                if txt:
                    msgs.append({"role": role, "content": txt})
        msgs.append({"role": "user", "content": prompt})

        payload_oai: Dict[str, Any] = {
            "model": use_model,
            "messages": msgs,
            "temperature": 0.15 if json_mode else 0.3,
        }
        if json_mode:
            payload_oai["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=35.0) as client:
            r = await client.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload_oai,
            )
            r.raise_for_status()
            return (r.json().get("choices", [{}])[0].get("message", {}).get("content") or "").strip()

    elif prov == "anthropic":
        a_key = keys["anthropic"]
        if not a_key:
            raise RuntimeError("Anthropic API anahtarı tanımlı değil.")
        use_model = model_name or "claude-3-5-haiku-latest"
        msgs = []
        if history:
            for msg in history:
                role = "user" if msg.get("sender") in ("user", "customer") or msg.get("role") == "user" else "assistant"
                txt = str(msg.get("text") or msg.get("content") or "").strip()
                if txt:
                    msgs.append({"role": role, "content": txt})
        msgs.append({"role": "user", "content": prompt})

        body_ant: Dict[str, Any] = {
            "model": use_model,
            "max_tokens": 1500,
            "messages": msgs,
        }
        if system_instruction:
            body_ant["system"] = system_instruction

        async with httpx.AsyncClient(timeout=35.0) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": a_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json=body_ant,
            )
            r.raise_for_status()
            content_blocks = r.json().get("content") or []
            return (content_blocks[0].get("text") if content_blocks else "").strip()

    raise RuntimeError(f"Desteklenmeyen AI sağlayıcısı: {provider}")


async def generate_routed_text(
    task_id: str,
    prompt: str,
    system_instruction: str = "",
    json_mode: bool = False,
    history: Optional[List[Dict[str, str]]] = None,
    tenant_id: str = "tenant-default",
) -> Dict[str, Any]:
    """
    Executes an LLM task using the administrator's selected AI provider & model for `task_id`.
    Enforces single-queue execution, active-call throttling, CPU thread limits, RAM auto-unload,
    and optional Cloud AI fallback.
    """
    cfg = get_ai_task_routing_config(tenant_id)
    task_cfg = (cfg.get("tasks") or {}).get(task_id) or {"provider": "gemini", "model": "gemini-2.5-flash"}
    provider = str(task_cfg.get("provider") or "gemini").lower()
    model_name = str(task_cfg.get("model") or "").strip()

    if provider == "ollama":
        seq_enabled = bool(cfg.get("sequential_queue_enabled", True))
        AI_ROUTER_STATS["queue_waiting"] = max(0, AI_ROUTER_STATS["queue_waiting"] + 1)
        try:
            if seq_enabled:
                async with _LOCAL_AI_QUEUE_LOCK:
                    AI_ROUTER_STATS["queue_waiting"] = max(0, AI_ROUTER_STATS["queue_waiting"] - 1)
                    AI_ROUTER_STATS["active_task"] = task_id
                    AI_ROUTER_STATS["active_since"] = time.time()
                    await _wait_for_pbx_idle_if_needed(cfg, cfg.get("ollama_base_url", ""))
                    text_out = await _call_ollama_chat(
                        cfg=cfg,
                        model_name=model_name or "qwen2.5:1.5b",
                        prompt=prompt,
                        system_instruction=system_instruction,
                        json_mode=json_mode,
                        history=history,
                    )
            else:
                AI_ROUTER_STATS["queue_waiting"] = max(0, AI_ROUTER_STATS["queue_waiting"] - 1)
                AI_ROUTER_STATS["active_task"] = task_id
                AI_ROUTER_STATS["active_since"] = time.time()
                await _wait_for_pbx_idle_if_needed(cfg, cfg.get("ollama_base_url", ""))
                text_out = await _call_ollama_chat(
                    cfg=cfg,
                    model_name=model_name or "qwen2.5:1.5b",
                    prompt=prompt,
                    system_instruction=system_instruction,
                    json_mode=json_mode,
                    history=history,
                )

            if not text_out:
                raise RuntimeError("Yerel LLM boş yanıt döndürdü.")

            est_tokens = max(50, int((len(prompt) + len(system_instruction) + len(text_out)) / 4))
            AI_ROUTER_STATS["total_local_jobs"] += 1
            AI_ROUTER_STATS["estimated_saved_tokens"] += est_tokens
            AI_ROUTER_STATS["last_completed_at"] = time.strftime("%H:%M:%S")
            return {"text": text_out, "provider_used": "ollama", "model_used": model_name or "qwen2.5:1.5b", "fallback_used": False}
        except Exception as local_err:
            AI_ROUTER_STATS["last_error"] = f"[{task_id}] Yerel LLM hatası: {local_err}"
            print(f"[AITaskRouter] Local Ollama failed for '{task_id}': {local_err}")
            if cfg.get("cloud_fallback_enabled", True):
                fb_prov = str(cfg.get("fallback_provider") or "gemini").lower()
                fb_model = str(cfg.get("fallback_model") or "gemini-2.5-flash")
                AI_ROUTER_STATS["total_cloud_fallbacks"] += 1
                text_fb = await _call_cloud_llm(
                    provider=fb_prov,
                    model_name=fb_model,
                    prompt=prompt,
                    system_instruction=system_instruction,
                    json_mode=json_mode,
                    history=history,
                    tenant_id=tenant_id,
                )
                return {"text": text_fb, "provider_used": fb_prov, "model_used": fb_model, "fallback_used": True}
            raise
        finally:
            AI_ROUTER_STATS["active_task"] = None
            AI_ROUTER_STATS["active_since"] = None
            AI_ROUTER_STATS["paused_for_active_call"] = False

    # Cloud Provider Selected Directly
    try:
        text_cloud = await _call_cloud_llm(
            provider=provider,
            model_name=model_name,
            prompt=prompt,
            system_instruction=system_instruction,
            json_mode=json_mode,
            history=history,
            tenant_id=tenant_id,
        )
        AI_ROUTER_STATS["total_cloud_jobs"] += 1
        AI_ROUTER_STATS["last_completed_at"] = time.strftime("%H:%M:%S")
        return {"text": text_cloud, "provider_used": provider, "model_used": model_name, "fallback_used": False}
    except Exception as cloud_err:
        AI_ROUTER_STATS["last_error"] = f"[{task_id}] {provider} hatası: {cloud_err}"
        if provider != "gemini" and cfg.get("cloud_fallback_enabled", True):
            AI_ROUTER_STATS["total_cloud_fallbacks"] += 1
            text_fb = await _call_cloud_llm(
                provider="gemini",
                model_name="gemini-2.5-flash",
                prompt=prompt,
                system_instruction=system_instruction,
                json_mode=json_mode,
                history=history,
                tenant_id=tenant_id,
            )
            return {"text": text_fb, "provider_used": "gemini", "model_used": "gemini-2.5-flash", "fallback_used": True}
        raise


def _run_local_faster_whisper_sync(wav_path: str, model_size: str, cpu_threads: int) -> List[Tuple[str, str]]:
    """
    Runs faster-whisper in CPU/GPU auto mode with int8 quantization, then immediately
    destroys the model instance and runs gc.collect() to free 100% of RAM on 4GB hosts.
    """
    from faster_whisper import WhisperModel  # Optional package installed on server only

    clean_size = model_size if model_size in ("tiny", "base", "small", "medium", "large-v3") else "base"
    turns: List[Tuple[str, str]] = []
    model = None
    try:
        model = WhisperModel(
            clean_size,
            device="auto",
            compute_type="int8",
            cpu_threads=max(1, min(16, int(cpu_threads or 2))),
            num_workers=1,
        )
        segments, info = model.transcribe(wav_path, beam_size=2, vad_filter=True)
        detected_lang = str(getattr(info, "language", "tr") or "tr").upper()
        for idx, seg in enumerate(segments):
            txt = (seg.text or "").strip()
            if not txt:
                continue
            spk = "customer" if idx % 2 == 0 else "human"
            if detected_lang != "TR":
                turns.append((spk, f"{txt}\n[[ORIG:{detected_lang}]] {txt}"))
            else:
                turns.append((spk, txt))
        return turns
    finally:
        if model is not None:
            del model
        gc.collect()


async def transcribe_routed_audio(
    wav_path: str,
    audio_bytes: Optional[bytes] = None,
    tenant_id: str = "tenant-default",
) -> Tuple[str, List[Tuple[str, str]]]:
    """
    Returns (provider_used, list_of_(speaker, text)_turns).
    If 'gemini' is configured (or fallback triggers), returns ('gemini_delegate', []) so caller runs Gemini/Chromium pipeline.
    """
    cfg = get_ai_task_routing_config(tenant_id)
    task_cfg = (cfg.get("tasks") or {}).get("call_transcription") or {"provider": "gemini"}
    provider = str(task_cfg.get("provider") or "gemini").lower()
    model_name = str(task_cfg.get("model") or "").strip()

    if provider == "gemini":
        return ("gemini_delegate", [])

    if provider == "local_whisper":
        w_mode = str(cfg.get("whisper_mode") or "local_python").lower()
        w_size = str(model_name or cfg.get("whisper_model_size") or "base").strip()
        num_threads = max(1, min(16, int(cfg.get("max_cpu_threads") or 2)))
        target_url = "http://127.0.0.1" if w_mode == "local_python" else str(cfg.get("whisper_remote_url") or "")

        AI_ROUTER_STATS["queue_waiting"] = max(0, AI_ROUTER_STATS["queue_waiting"] + 1)
        try:
            async with _LOCAL_AI_QUEUE_LOCK:
                AI_ROUTER_STATS["queue_waiting"] = max(0, AI_ROUTER_STATS["queue_waiting"] - 1)
                AI_ROUTER_STATS["active_task"] = "call_transcription"
                AI_ROUTER_STATS["active_since"] = time.time()
                await _wait_for_pbx_idle_if_needed(cfg, target_url)

                if w_mode == "remote_http":
                    rem_url = str(cfg.get("whisper_remote_url") or "http://127.0.0.1:8090").rstrip("/")
                    rem_key = str(cfg.get("whisper_remote_api_key") or "").strip()
                    raw_data = audio_bytes
                    if not raw_data and wav_path and os.path.exists(wav_path):
                        with open(wav_path, "rb") as f:
                            raw_data = f.read()
                    if not raw_data:
                        return ("local_whisper", [])
                    headers = {}
                    if rem_key:
                        headers["Authorization"] = f"Bearer {rem_key}"
                    endpoint = f"{rem_url}/audio/transcriptions" if rem_url.endswith("/v1") else f"{rem_url}/v1/audio/transcriptions"
                    async with httpx.AsyncClient(timeout=float(cfg.get("request_timeout_seconds") or 90)) as client:
                        resp = await client.post(
                            endpoint,
                            headers=headers,
                            files={"file": ("call.wav", raw_data, "audio/wav")},
                            data={"model": w_size or "Systran/faster-whisper-base", "response_format": "verbose_json"},
                        )
                        resp.raise_for_status()
                        rj = resp.json()
                        segs = rj.get("segments") or []
                        turns = []
                        if segs:
                            for idx, seg in enumerate(segs):
                                t = str(seg.get("text") or "").strip()
                                if t:
                                    turns.append(("customer" if idx % 2 == 0 else "human", t))
                        elif rj.get("text"):
                            turns.append(("customer", str(rj["text"]).strip()))
                        AI_ROUTER_STATS["total_local_jobs"] += 1
                        AI_ROUTER_STATS["estimated_saved_tokens"] += 600
                        return ("local_whisper_remote", turns)
                else:
                    turns = await asyncio.to_thread(_run_local_faster_whisper_sync, wav_path, w_size, num_threads)
                    AI_ROUTER_STATS["total_local_jobs"] += 1
                    AI_ROUTER_STATS["estimated_saved_tokens"] += 600
                    AI_ROUTER_STATS["last_completed_at"] = time.strftime("%H:%M:%S")
                    return ("local_whisper", turns)
        except Exception as lw_err:
            AI_ROUTER_STATS["last_error"] = f"[call_transcription] Yerel Whisper hatası: {lw_err}"
            print(f"[AITaskRouter] Local Whisper failed: {lw_err}")
            if cfg.get("cloud_fallback_enabled", True):
                AI_ROUTER_STATS["total_cloud_fallbacks"] += 1
                return ("gemini_delegate", [])
            raise
        finally:
            AI_ROUTER_STATS["active_task"] = None
            AI_ROUTER_STATS["active_since"] = None
            AI_ROUTER_STATS["paused_for_active_call"] = False

    if provider in ("groq_whisper", "openai_whisper"):
        keys = _resolve_cloud_api_keys(tenant_id)
        is_groq = provider == "groq_whisper"
        api_key = keys["groq"] if is_groq else keys["openai"]
        try:
            if not api_key:
                raise RuntimeError(f"{provider} için API anahtarı bulunamadı.")
            raw_data = audio_bytes
            if not raw_data and wav_path and os.path.exists(wav_path):
                with open(wav_path, "rb") as f:
                    raw_data = f.read()
            if not raw_data:
                return (provider, [])
            url = (
                "https://api.groq.com/openai/v1/audio/transcriptions"
                if is_groq
                else "https://api.openai.com/v1/audio/transcriptions"
            )
            use_m = model_name or ("whisper-large-v3-turbo" if is_groq else "whisper-1")
            async with httpx.AsyncClient(timeout=45.0) as client:
                r = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": ("call.wav", raw_data, "audio/wav")},
                    data={"model": use_m, "response_format": "verbose_json"},
                )
                r.raise_for_status()
                rj = r.json()
                segs = rj.get("segments") or []
                turns = []
                if segs:
                    for idx, seg in enumerate(segs):
                        t = str(seg.get("text") or "").strip()
                        if t:
                            turns.append(("customer" if idx % 2 == 0 else "human", t))
                elif rj.get("text"):
                    turns.append(("customer", str(rj["text"]).strip()))
                AI_ROUTER_STATS["total_cloud_jobs"] += 1
                return (provider, turns)
        except Exception as cw_err:
            print(f"[AITaskRouter] {provider} failed: {cw_err}")
            if cfg.get("cloud_fallback_enabled", True):
                AI_ROUTER_STATS["total_cloud_fallbacks"] += 1
                return ("gemini_delegate", [])
            raise

    return ("gemini_delegate", [])


def _normalize_dim_768(vec: List[float]) -> List[float]:
    """Ensures embedding vector is strictly 768 floats to match PostgreSQL pgvector Vector(768) column."""
    if len(vec) == 768:
        return vec
    if len(vec) > 768:
        return vec[:768]
    return vec + [0.0] * (768 - len(vec))


async def generate_routed_embedding(text: str, tenant_id: str = "tenant-default") -> List[float]:
    cfg = get_ai_task_routing_config(tenant_id)
    task_cfg = (cfg.get("tasks") or {}).get("rag_embeddings") or {"provider": "gemini", "model": "models/gemini-embedding-001"}
    provider = str(task_cfg.get("provider") or "gemini").lower()
    model_name = str(task_cfg.get("model") or "").strip()

    if provider == "ollama":
        base_url = str(cfg.get("ollama_base_url") or "http://127.0.0.1:11434").rstrip("/")
        api_key = str(cfg.get("ollama_api_key") or "").strip()
        auto_unload = bool(cfg.get("auto_unload_ram", True))
        num_threads = max(1, min(16, int(cfg.get("max_cpu_threads") or 2)))
        try:
            async with _LOCAL_AI_QUEUE_LOCK:
                await _wait_for_pbx_idle_if_needed(cfg, base_url)
                headers = {"Content-Type": "application/json"}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                async with httpx.AsyncClient(timeout=45.0) as client:
                    r = await client.post(
                        f"{base_url}/api/embed",
                        headers=headers,
                        json={
                            "model": model_name or "nomic-embed-text",
                            "input": text,
                            "keep_alive": 0 if auto_unload else "5m",
                            "options": {"num_thread": num_threads},
                        },
                    )
                    if r.status_code == 404:
                        # Older Ollama versions use /api/embeddings
                        r2 = await client.post(
                            f"{base_url}/api/embeddings",
                            headers=headers,
                            json={
                                "model": model_name or "nomic-embed-text",
                                "prompt": text,
                                "keep_alive": 0 if auto_unload else "5m",
                                "options": {"num_thread": num_threads},
                            },
                        )
                        r2.raise_for_status()
                        emb = r2.json().get("embedding") or []
                    else:
                        r.raise_for_status()
                        rj = r.json()
                        embs = rj.get("embeddings") or []
                        emb = embs[0] if embs else (rj.get("embedding") or [])
                    if not emb:
                        raise RuntimeError("Ollama boş embedding vektörü döndürdü.")
                    AI_ROUTER_STATS["total_local_jobs"] += 1
                    AI_ROUTER_STATS["estimated_saved_tokens"] += max(20, int(len(text) / 4))
                    return _normalize_dim_768([float(x) for x in emb])
        except Exception as emb_err:
            print(f"[AITaskRouter] Local Ollama embedding failed: {emb_err}")
            if not cfg.get("cloud_fallback_enabled", True):
                raise
            AI_ROUTER_STATS["total_cloud_fallbacks"] += 1

    elif provider == "openai":
        keys = _resolve_cloud_api_keys(tenant_id)
        if keys["openai"]:
            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    r = await client.post(
                        "https://api.openai.com/v1/embeddings",
                        headers={"Authorization": f"Bearer {keys['openai']}", "Content-Type": "application/json"},
                        json={
                            "model": model_name or "text-embedding-3-small",
                            "input": text,
                            "dimensions": 768,
                        },
                    )
                    r.raise_for_status()
                    vec = r.json()["data"][0]["embedding"]
                    AI_ROUTER_STATS["total_cloud_jobs"] += 1
                    return _normalize_dim_768([float(x) for x in vec])
            except Exception as oai_emb_err:
                print(f"[AITaskRouter] OpenAI embedding failed: {oai_emb_err}")
                if not cfg.get("cloud_fallback_enabled", True):
                    raise
                AI_ROUTER_STATS["total_cloud_fallbacks"] += 1

    # Default / Fallback: Google Gemini Embedding (768d)
    from backend.services.rag_service import get_genai_client
    client = get_genai_client()
    response = await asyncio.to_thread(
        client.models.embed_content,
        model="models/gemini-embedding-001",
        contents=text,
        config={"output_dimensionality": 768},
    )
    AI_ROUTER_STATS["total_cloud_jobs"] += 1
    return response.embeddings[0].values


async def probe_ai_router_status(tenant_id: str = "tenant-default") -> Dict[str, Any]:
    cfg = get_ai_task_routing_config(tenant_id)
    base_url = str(cfg.get("ollama_base_url") or "http://127.0.0.1:11434").rstrip("/")
    api_key = str(cfg.get("ollama_api_key") or "").strip()

    # 1. Host Hardware Telemetry
    cpu_cores = os.cpu_count() or 4
    cpu_percent = 0.0
    ram_total_gb = 4.0
    ram_used_gb = 0.0
    ram_avail_gb = 2.0
    try:
        import psutil
        cpu_cores = psutil.cpu_count(logical=True) or cpu_cores
        cpu_percent = psutil.cpu_percent(interval=None)
        vm = psutil.virtual_memory()
        ram_total_gb = round(vm.total / (1024 ** 3), 2)
        ram_used_gb = round(vm.used / (1024 ** 3), 2)
        ram_avail_gb = round(vm.available / (1024 ** 3), 2)
    except Exception:
        pass

    # 2. Check Ollama Connectivity & Installed Models
    ollama_online = False
    ollama_models: List[Dict[str, Any]] = []
    ollama_error = ""
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=3.5) as client:
            if base_url.endswith("/v1"):
                r = await client.get(f"{base_url}/models", headers=headers)
                if r.status_code == 200:
                    ollama_online = True
                    for m in r.json().get("data") or []:
                        ollama_models.append({"name": m.get("id", ""), "size_gb": 0})
            else:
                r = await client.get(f"{base_url}/api/tags", headers=headers)
                if r.status_code == 200:
                    ollama_online = True
                    for m in r.json().get("models") or []:
                        sz = round(float(m.get("size") or 0) / (1024 ** 3), 2)
                        ollama_models.append({"name": m.get("name", ""), "size_gb": sz})
                else:
                    ollama_error = f"HTTP {r.status_code}"
    except Exception as e:
        ollama_error = str(e)

    # 3. Check Faster-Whisper Local Python Package or Remote Whisper Server
    faster_whisper_installed = False
    try:
        import importlib.util
        faster_whisper_installed = importlib.util.find_spec("faster_whisper") is not None
    except Exception:
        faster_whisper_installed = False

    remote_whisper_online = False
    if cfg.get("whisper_mode") == "remote_http":
        rem_url = str(cfg.get("whisper_remote_url") or "http://127.0.0.1:8090").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                rw = await client.get(rem_url)
                remote_whisper_online = rw.status_code < 500
        except Exception:
            remote_whisper_online = False

    keys = _resolve_cloud_api_keys(tenant_id)

    return {
        "hardware": {
            "cpu_cores": cpu_cores,
            "cpu_percent": cpu_percent,
            "ram_total_gb": ram_total_gb,
            "ram_used_gb": ram_used_gb,
            "ram_available_gb": ram_avail_gb,
            "is_low_ram_host": ram_total_gb <= 4.5,
            "is_remote_ollama": not _is_url_local_host(base_url),
        },
        "ollama": {
            "online": ollama_online,
            "base_url": base_url,
            "models": ollama_models,
            "error": ollama_error,
        },
        "whisper": {
            "mode": cfg.get("whisper_mode", "local_python"),
            "faster_whisper_installed": faster_whisper_installed,
            "remote_whisper_online": remote_whisper_online,
            "remote_url": cfg.get("whisper_remote_url", "http://127.0.0.1:8090"),
        },
        "cloud_keys_configured": {
            "gemini": bool(keys["gemini"]),
            "openai": bool(keys["openai"]),
            "anthropic": bool(keys["anthropic"]),
            "groq": bool(keys["groq"]),
            "elevenlabs": bool(keys["elevenlabs"]),
        },
        "active_pbx_calls": _get_active_pbx_call_count(),
        "runtime_stats": AI_ROUTER_STATS,
    }
