import datetime
from sqlalchemy import select
from backend.database.config import AsyncSessionLocal
from backend.database.models import Appointment, Call
from backend.services.ami_manager import redirect_call_to_human
from backend.services.rag_service import query_vector_search

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

async def execute_transfer_to_human(call_id: str) -> dict:
    """Triggers AMI redirection to human queue."""
    print(f"[Tool] Temsilciye aktarım tetiklendi (call_id: {call_id})")
    
    # Update call status in database
    async with AsyncSessionLocal() as session:
        db_call = await session.get(Call, call_id)
        if db_call:
            db_call.status = "transferred"
            await session.commit()
            
    # Trigger AMI
    success = await redirect_call_to_human(call_id)
    if success:
        return {"status": "success", "message": "Aktarım başarıyla başlatıldı."}
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

async def handle_tool_call(name: str, args: dict, call_id: str) -> dict:
    """Router to execute the correct tool based on function name."""
    if name == "book_appointment":
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
