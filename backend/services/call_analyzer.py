import os
import json
from sqlalchemy import select
from backend.database.config import AsyncSessionLocal
from backend.database.models import Call, Transcript, ChatSession, ChatMessage
from backend.services.rag_service import get_genai_client

async def analyze_chat_session(session_id: str):
    """
    Analyzes a completed or closed chat session's transcripts using Gemini API
    to evaluate representative performance against QA rules.
    """
    print(f"[QA Analyzer] Analyzing chat_session id={session_id}")
    async with AsyncSessionLocal() as session:
        # Fetch chat messages
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
        
        # Fetch active QA Questions
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
                qa_response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=qa_prompt
                )
                qa_text = qa_response.text.strip()
                if qa_text.startswith("```json"):
                    qa_text = qa_text[7:]
                if qa_text.endswith("```"):
                    qa_text = qa_text[:-3]
                qa_text = qa_text.strip()
                
                qa_data = json.loads(qa_text)
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

async def analyze_call(call_id: str):
    """
    Analyzes a call's transcripts using Gemini API to generate a brief summary 
    and extract the customer's sentiment (Duygu Durumu).
    Updates the database with the results.
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
            return
            
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
        
        # 3. Call Gemini API
        try:
            client = get_genai_client()
            prompt = f"""
Aşağıdaki telefon görüşmesi transkriptini analiz et:

[GÖRÜŞME TRANSKRİPTİ]
{transcript_text}

Senden iki şey istiyorum:
1. Görüşmenin kısa bir özetini çıkar (en fazla 2 cümle, Türkçe).
2. Müşterinin duygu durumunu şu kategorilerden biri olarak belirle: "Pozitif", "Nötr", "Olumsuz", "Öfkeli", "Memnun".

Yanıtını kesinlikle şu JSON formatında ver:
{{
  "summary": "özet metni buraya",
  "sentiment": "kategori"
}}
"""
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            
            resp_text = response.text.strip()
            if resp_text.startswith("```json"):
                resp_text = resp_text[7:]
            if resp_text.endswith("```"):
                resp_text = resp_text[:-3]
            resp_text = resp_text.strip()
            
            data = json.loads(resp_text)
            summary_val = data.get("summary", "")
            sentiment_val = data.get("sentiment", "Nötr")
            
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
                    qa_response = client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=qa_prompt
                    )
                    qa_text = qa_response.text.strip()
                    if qa_text.startswith("```json"):
                        qa_text = qa_text[7:]
                    if qa_text.endswith("```"):
                        qa_text = qa_text[:-3]
                    qa_text = qa_text.strip()
                    
                    qa_data = json.loads(qa_text)
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
        except Exception as e:
            print(f"[Call Analyzer] Error analyzing call {call_id}: {e}")
            # Fallback values
            db_call = await session.get(Call, call_id)
            if db_call:
                if not db_call.summary:
                    db_call.summary = "Görüşme özeti çıkartılamadı."
                if not db_call.sentiment:
                    db_call.sentiment = "Nötr"
                if db_call.qa_score is None:
                    db_call.qa_score = 100
                await session.commit()
