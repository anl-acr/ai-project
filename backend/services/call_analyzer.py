import os
import re
import json
import asyncio
from sqlalchemy import select
from backend.database.config import AsyncSessionLocal
from backend.database.models import Call, Transcript, ChatSession, ChatMessage
from backend.services.rag_service import get_genai_client


def build_fallback_summary_from_turns(turns) -> tuple[str, str]:
    """
    Deterministic Turkish summary and sentiment extractor from transcript turns
    used when Gemini API is unavailable or quota-limited.
    """
    if not turns:
        return ("Herhangi bir konuşma algılanmadı.", "Nötr")

    customer_texts = [
        (t.text or "").strip()
        for t in turns
        if t.speaker == "customer" and (t.text or "").strip()
    ]
    agent_texts = [
        (t.text or "").strip()
        for t in turns
        if t.speaker in ("ai", "agent", "human") and (t.text or "").strip()
    ]

    full_lower = " ".join([(t.text or "") for t in turns]).lower()
    positive_words = ["teşekkür", "sağ olun", "harika", "memnun", "iyi günler", "süper", "tamam", "anladım"]
    negative_words = ["şikayet", "sorun", "kötü", "iptal", "kızgın", "mağdur", "çözülmedi", "olmadı"]

    pos_score = sum(1 for w in positive_words if w in full_lower)
    neg_score = sum(1 for w in negative_words if w in full_lower)
    if neg_score > pos_score:
        sentiment = "Olumsuz"
    elif pos_score > 0:
        sentiment = "Pozitif"
    else:
        sentiment = "Nötr"

    parts = []
    if customer_texts:
        first_req = customer_texts[0]
        if len(first_req) > 140:
            first_req = first_req[:137] + "..."
        parts.append(f"Müşteri görüşmede \"{first_req}\" konusunda talepte bulundu.")
        if len(customer_texts) > 1:
            last_req = customer_texts[-1]
            if last_req != customer_texts[0]:
                if len(last_req) > 120:
                    last_req = last_req[:117] + "..."
                parts.append(f"Devamında \"{last_req}\" ifadesiyle görüşmeyi sürdürdü.")
    else:
        parts.append("Görüşmede müşteri tarafından sesli bir ifade kaydedilmedi.")

    if agent_texts:
        last_resp = agent_texts[-1]
        if len(last_resp) > 150:
            last_resp = last_resp[:147] + "..."
        parts.append(f"Temsilci/Asistan tarafından \"{last_resp}\" şeklinde bilgilendirme yapılarak görüşme tamamlandı.")

    summary = " ".join(parts).strip()
    return (summary or "Görüşme tamamlandı.", sentiment)


async def _generate_with_gemini_fallback(client, prompt: str) -> str:
    models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    last_err = None
    for model_name in models_to_try:
        try:
            resp = await asyncio.to_thread(
                client.models.generate_content,
                model=model_name,
                contents=prompt,
            )
            if resp and getattr(resp, "text", None):
                return resp.text.strip()
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("Empty response from Gemini")


def _extract_json_dict(raw_text: str) -> dict:
    cleaned = (raw_text or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except Exception:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            return json.loads(match.group(0))
        raise


async def analyze_chat_session(session_id: str):
    """
    Analyzes a completed or closed chat session's transcripts using Gemini API
    to evaluate representative performance against QA rules.
    """
    print(f"[QA Analyzer] Analyzing chat_session id={session_id}")
    async with AsyncSessionLocal() as session:
        stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc())
        result = await session.execute(stmt)
        messages = result.scalars().all()
        
        if not messages:
            print(f"[QA Analyzer] No messages found for chat session={session_id}")
            return
            
        chat_history = []
        for msg in messages:
            speaker = "Müşteri"
            if msg.sender == "ai":
                speaker = "Yapay Zeka Temsilcisi"
            elif msg.sender == "human":
                speaker = "Müşteri Temsilcisi"
            chat_history.append(f"{speaker}: {msg.text}")
            
        transcript_text = "\n".join(chat_history)
        
        from backend.database.models import QAQuestion
        stmt_qa = select(QAQuestion).where(QAQuestion.is_active == True)
        res_qa = await session.execute(stmt_qa)
        qa_rules = res_qa.scalars().all()
        
        qa_score = 100
        qa_report_str = "Kalite değerlendirmesi için aktif kural bulunamadı."
        
        if qa_rules:
            rules_list_str = "\n".join([f"- Kural ID {r.id}: {r.question} (Maksimum Ceza Puanı: {r.max_score})" for r in qa_rules])
            qa_prompt = f"""
Aşağıdaki sohbet konuşması geçmişini (Chat Transcript), belirtilen kalite değerlendirme kurallarına göre analiz et:

[SOHBET TRANSKRİPTİ]
{transcript_text}

[DEĞERLENDİRME KURALLARI]
{rules_list_str}

Senden her kural için temsilcinin kurala uyup uymadığını (Evet/Hayır) belirlemeni, uymadıysa nedenini ve ceza puanını (0 ile maks ceza puanı arasında) hesaplamanı istiyorum.
Toplam kalite puanı 100 üzerinden hesaplanacaktır (100 - kesilen ceza puanlarının toplamı). Puan 0'ın altına düşemez.
Ayrıca temsilciye yapıcı bir koçluk tavsiyesi hazırlamalısın.

Yanıtını kesinlikle şu JSON formatında ver:
{{
  "total_score": 85,
  "breakdown": [
    {{
      "rule_id": 1,
      "question": "kural sorusu",
      "satisfied": false,
      "penalty": 10,
      "reason": "Uymama gerekçesi"
    }}
  ],
  "coaching_report": "Temsilci için yapıcı koçluk raporu buraya (en fazla 2-3 cümle, profesyonel ve geliştirici bir dille)."
}}
"""
            try:
                client = get_genai_client()
                qa_text = await _generate_with_gemini_fallback(client, qa_prompt)
                qa_data = _extract_json_dict(qa_text)
                qa_score = max(0, min(100, qa_data.get("total_score", 100)))
                qa_report_str = json.dumps(qa_data, ensure_ascii=False)
            except Exception as e:
                print(f"[QA Analyzer] Chat QA evaluation failed: {e}")
                
        db_session = await session.get(ChatSession, session_id)
        if db_session:
            db_session.qa_score = qa_score
            db_session.qa_report = qa_report_str
            await session.commit()
            print(f"[QA Analyzer] Successfully updated chat session {session_id} -> QA Score = {qa_score}")


async def analyze_call(call_id: str) -> dict:
    """
    Analyzes a call's transcripts using Gemini API to generate a brief summary 
    and extract the customer's sentiment (Duygu Durumu).
    Updates the database with the results and returns the summary payload.
    """
    print(f"[Call Analyzer] Analyzing call_id={call_id}")
    async with AsyncSessionLocal() as session:
        # 1. Fetch transcripts
        stmt = select(Transcript).where(Transcript.call_id == call_id).order_by(Transcript.timestamp.asc())
        result = await session.execute(stmt)
        turns = result.scalars().all()
        
        if not turns:
            print(f"[Call Analyzer] No transcripts found for call_id={call_id}")
            db_call = await session.get(Call, call_id)
            if db_call:
                db_call.summary = "Herhangi bir konuşma algılanmadı."
                db_call.sentiment = "Nötr"
                await session.commit()
                return {
                    "id": call_id,
                    "summary": db_call.summary,
                    "sentiment": db_call.sentiment,
                    "qa_score": db_call.qa_score,
                }
            return {"id": call_id, "summary": "Herhangi bir konuşma algılanmadı.", "sentiment": "Nötr"}
            
        # 2. Build conversation history
        chat_history = []
        for turn in turns:
            speaker_label = "Müşteri"
            if turn.speaker in ["ai", "agent"]:
                speaker_label = "Yapay Zeka Temsilcisi"
            elif turn.speaker == "human":
                speaker_label = "Müşteri Temsilcisi"
            chat_history.append(f"{speaker_label}: {turn.text}")
            
        transcript_text = "\n".join(chat_history)
        fallback_summary, fallback_sentiment = build_fallback_summary_from_turns(turns)
        
        # 3. Call Gemini API
        try:
            client = get_genai_client()
            prompt = f"""
Aşağıdaki telefon görüşmesi transkriptini analiz et:

[GÖRÜŞME TRANSKRİPTİ]
{transcript_text}

Senden iki şey istiyorum:
1. Görüşmenin anlaşılır ve net bir özetini çıkar (2-3 cümle, Türkçe).
2. Müşterinin duygu durumunu şu kategorilerden biri olarak belirle: "Pozitif", "Nötr", "Olumsuz", "Öfkeli", "Memnun".

Yanıtını kesinlikle şu JSON formatında ver:
{{
  "summary": "özet metni buraya",
  "sentiment": "kategori"
}}
"""
            resp_text = await _generate_with_gemini_fallback(client, prompt)
            data = _extract_json_dict(resp_text)
            summary_val = (data.get("summary") or "").strip() or fallback_summary
            sentiment_val = (data.get("sentiment") or "").strip() or fallback_sentiment
            
            # Fetch QA Rules
            from backend.database.models import QAQuestion
            stmt_qa = select(QAQuestion).where(QAQuestion.is_active == True)
            res_qa = await session.execute(stmt_qa)
            qa_rules = res_qa.scalars().all()
            
            qa_score = 100
            qa_report_str = "Kalite değerlendirmesi için aktif kural bulunamadı."
            
            if qa_rules:
                rules_list_str = "\n".join([f"- Kural ID {r.id}: {r.question} (Maksimum Ceza Puanı: {r.max_score})" for r in qa_rules])
                qa_prompt = f"""
Aşağıdaki telefon konuşması geçmişini, belirtilen kalite değerlendirme kurallarına göre analiz et:

[KONUŞMA GEÇMİŞİ]
{transcript_text}

[DEĞERLENDİRME KURALLARI]
{rules_list_str}

Senden her kural için temsilcinin kurala uyup uymadığını (Evet/Hayır) belirlemeni, uymadıysa nedenini ve ceza puanını (0 ile maks ceza puanı arasında) hesaplamanı istiyorum.
Toplam kalite puanı 100 üzerinden hesaplanacaktır (100 - kesilen ceza puanlarının toplamı). Puan 0'ın altına düşemez.
Ayrıca temsilciye yapıcı bir koçluk tavsiyesi hazırlamalısın.

Yanıtını kesinlikle şu JSON formatında ver:
{{
  "total_score": 85,
  "breakdown": [
    {{
      "rule_id": 1,
      "question": "kural sorusu",
      "satisfied": false,
      "penalty": 10,
      "reason": "Uymama gerekçesi"
    }}
  ],
  "coaching_report": "Temsilci için yapıcı koçluk raporu buraya (en fazla 2-3 cümle, profesyonel ve geliştirici bir dille)."
}}
"""
                try:
                    qa_text = await _generate_with_gemini_fallback(client, qa_prompt)
                    qa_data = _extract_json_dict(qa_text)
                    qa_score = max(0, min(100, qa_data.get("total_score", 100)))
                    qa_report_str = json.dumps(qa_data, ensure_ascii=False)
                except Exception as ex_qa:
                    print(f"[Call Analyzer] QA Evaluation failed: {ex_qa}")
            
            # 4. Save to db
            db_call = await session.get(Call, call_id)
            if db_call:
                db_call.summary = summary_val
                db_call.sentiment = sentiment_val
                db_call.qa_score = qa_score
                db_call.qa_report = qa_report_str
                await session.commit()
                print(f"[Call Analyzer] Successfully updated call_id={call_id} -> sentiment={sentiment_val}, qa_score={qa_score}")
                return {
                    "id": call_id,
                    "summary": db_call.summary,
                    "sentiment": db_call.sentiment,
                    "qa_score": db_call.qa_score,
                }
            return {"id": call_id, "summary": summary_val, "sentiment": sentiment_val, "qa_score": qa_score}
        except Exception as e:
            print(f"[Call Analyzer] Error analyzing call {call_id} with Gemini, using transcript fallback: {e}")
            db_call = await session.get(Call, call_id)
            if db_call:
                db_call.summary = fallback_summary
                if not db_call.sentiment:
                    db_call.sentiment = fallback_sentiment
                if db_call.qa_score is None:
                    db_call.qa_score = 100
                await session.commit()
                return {
                    "id": call_id,
                    "summary": db_call.summary,
                    "sentiment": db_call.sentiment,
                    "qa_score": db_call.qa_score,
                }
            return {"id": call_id, "summary": fallback_summary, "sentiment": fallback_sentiment, "qa_score": 100}

