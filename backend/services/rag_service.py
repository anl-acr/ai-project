import os
import json
import asyncio
import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader
from sqlalchemy import select, delete
from google import genai
from backend.database.config import AsyncSessionLocal
from backend.database.models import DocumentChunk

def get_genai_client():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        from dotenv import load_dotenv
        base_dir = os.path.dirname(os.path.abspath(__file__))
        load_dotenv(os.path.join(base_dir, "..", ".env"))
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        try:
            settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "settings.json")
            if os.path.exists(settings_path):
                with open(settings_path, "r", encoding="utf-8") as f:
                    s_data = json.load(f)
                    api_key = (
                        s_data.get("gemini_api_key")
                        or (s_data.get("ai_settings") or {}).get("gemini_api_key")
                        or (s_data.get("general") or {}).get("gemini_api_key")
                        or ""
                    ).strip()
        except Exception:
            pass
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")
    return genai.Client(api_key=api_key)

def get_rag_settings() -> dict:
    """Helper to load RAG chunking and top_k settings from settings.json."""
    fallback = {
        "chunk_size": 800,
        "chunk_overlap": 100,
        "top_k": 3,
        "similarity_threshold": 0.5
    }
    try:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "settings.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("rag", fallback)
    except Exception as e:
        print(f"[RAG] Error reading settings: {e}")
    return fallback

async def generate_embedding(text: str, tenant_id: str = "tenant-default") -> list:
    """Generates a 768-dimensional text embedding via configured AI Task Router (Ollama nomic-embed-text, OpenAI, or Gemini)."""
    from backend.services.ai_task_router import generate_routed_embedding
    return await generate_routed_embedding(text, tenant_id=tenant_id)

def split_text_into_chunks(text: str, chunk_size: int = 800, overlap: int = 100) -> list:
    """Splits text into chunks of chunk_size characters with overlap."""
    chunks = []
    start = 0
    if chunk_size <= 0:
        chunk_size = 800
    if overlap >= chunk_size or overlap < 0:
        overlap = int(chunk_size / 8)
        
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def _extract_pdf_text_sync(file_path: str):
    """Extracts text from all PDF pages in a worker thread so FastAPI/AudioSocket never blocks."""
    reader = PdfReader(file_path)
    page_count = len(reader.pages)
    parts = []
    for page in reader.pages:
        try:
            text = page.extract_text()
            if text:
                parts.append(text)
        except Exception as pe:
            print(f"[RAG] Sayfa metin ayrıştırma uyarısı: {pe}")
    return "\n".join(parts), page_count


async def index_pdf_file(
    file_path: str,
    filename: str,
    tenant_id: str = "tenant-default",
    progress_cb=None,
):
    """Parses a PDF in a background thread, chunks it, generates embeddings concurrently in batches, and saves to PostgreSQL."""
    print(f"[RAG] PDF Indeksleniyor: {filename} (Tenant: {tenant_id})")
    full_text, page_count = await asyncio.to_thread(_extract_pdf_text_sync, file_path)
    if not full_text or not full_text.strip():
        raise ValueError("PDF içerisinden okunabilir metin çıkarılamadı (taranmış/görsel PDF olabilir).")

    settings = get_rag_settings()
    raw_chunks = split_text_into_chunks(
        full_text,
        chunk_size=settings.get("chunk_size", 800),
        overlap=settings.get("chunk_overlap", 100),
    )
    chunks = [c.strip() for c in raw_chunks if c and c.strip()]
    total_chunks = len(chunks)
    if total_chunks == 0:
        raise ValueError("PDF içerisinde indekslenecek metin bloğu bulunamadı.")

    if progress_cb:
        progress_cb(0, total_chunks, page_count, "indexing")

    sem = asyncio.Semaphore(5)

    async def _embed_one(chunk_text: str):
        async with sem:
            emb = await generate_embedding(chunk_text, tenant_id=tenant_id)
            return chunk_text, emb

    batch_size = 20
    processed = 0
    for i in range(0, total_chunks, batch_size):
        batch = chunks[i : i + batch_size]
        results = await asyncio.gather(*[_embed_one(c) for c in batch])
        async with AsyncSessionLocal() as session:
            for chunk_text, embedding in results:
                session.add(
                    DocumentChunk(
                        filename=filename,
                        content=chunk_text,
                        embedding=embedding,
                        tenant_id=tenant_id,
                    )
                )
            await session.commit()
        processed += len(results)
        if progress_cb:
            progress_cb(processed, total_chunks, page_count, "indexing")

    print(f"[RAG] PDF basariyla indekslendi! Sayfa: {page_count}, Toplam chunk: {total_chunks}")
    return {"page_count": page_count, "total_chunks": total_chunks}

async def index_website_url(url: str, tenant_id: str = "tenant-default"):
    """Crawls a website, extracts text, chunks it, embeds, and saves to local PostgreSQL."""
    from backend.services.auth_service import validate_outbound_url
    ok_url, err_url = validate_outbound_url(url, allow_private=False)
    if not ok_url:
        raise ValueError(f"SSRF Koruması: {err_url}")
    print(f"[RAG] Web sitesi taranıyor: {url} (Tenant: {tenant_id})")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    verify_tls = os.getenv("NORNIA_RAG_ALLOW_SELF_SIGNED", "0") != "1"
    async with httpx.AsyncClient(verify=verify_tls, follow_redirects=False, timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.is_redirect and response.headers.get("location"):
            from urllib.parse import urljoin
            redir_url = urljoin(url, response.headers["location"])
            ok_r, err_r = validate_outbound_url(redir_url, allow_private=False)
            if not ok_r:
                raise ValueError(f"SSRF Koruması (Yönlendirme): {err_r}")
            response = await client.get(redir_url, headers=headers)
        html = response.text
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
        
    text = soup.get_text(separator=' ')
    lines = (line.strip() for line in text.splitlines())
    chunks_raw = (phrase.strip() for line in lines for phrase in line.split("  "))
    clean_text = "\n".join(chunk for chunk in chunks_raw if chunk)
    
    settings = get_rag_settings()
    chunks = split_text_into_chunks(
        clean_text,
        chunk_size=settings.get("chunk_size", 800),
        overlap=settings.get("chunk_overlap", 100)
    )
    
    async with AsyncSessionLocal() as session:
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            embedding = await generate_embedding(chunk, tenant_id=tenant_id)
            chunk_record = DocumentChunk(
                filename=url,
                content=chunk,
                embedding=embedding,
                tenant_id=tenant_id
            )
            session.add(chunk_record)
        await session.commit()
    print(f"[RAG] Web sitesi indekslendi! Toplam chunk: {len(chunks)}")

async def index_manual_text(title: str, text: str, tenant_id: str = "tenant-default"):
    """Chunks manual text input, generates embeddings, and saves to local PostgreSQL."""
    print(f"[RAG] Manuel metin indeksleniyor: {title} (Tenant: {tenant_id})")
    settings = get_rag_settings()
    chunks = split_text_into_chunks(
        text,
        chunk_size=settings.get("chunk_size", 800),
        overlap=settings.get("chunk_overlap", 100)
    )
    
    async with AsyncSessionLocal() as session:
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            embedding = await generate_embedding(chunk, tenant_id=tenant_id)
            chunk_record = DocumentChunk(
                filename=f"Manuel: {title}",
                content=chunk,
                embedding=embedding,
                tenant_id=tenant_id
            )
            session.add(chunk_record)
        await session.commit()
    print(f"[RAG] Manuel metin indekslendi! Toplam chunk: {len(chunks)}")

async def delete_indexed_source(source_name: str, tenant_id: str = None):
    """Deletes all chunks belonging to a specific source scoped strictly to tenant_id."""
    print(f"[RAG] Kaynak siliniyor: {source_name} (tenant={tenant_id or 'default'})")
    async with AsyncSessionLocal() as session:
        stmt = delete(DocumentChunk).where(DocumentChunk.filename == source_name)
        if tenant_id and tenant_id not in ("all", "global"):
            if tenant_id in ("tenant-default", "default"):
                stmt = stmt.where((DocumentChunk.tenant_id.in_(["tenant-default", "default"])) | (DocumentChunk.tenant_id.is_(None)))
            else:
                stmt = stmt.where(DocumentChunk.tenant_id == tenant_id)
        await session.execute(stmt)
        await session.commit()
    print(f"[RAG] Kaynak başarıyla silindi: {source_name}")

async def query_vector_search(query: str, limit: int = None, tenant_id: str = "tenant-default") -> str:
    """Performs semantic search using pgvector cosine distance, strictly isolated by tenant_id."""
    try:
        query_embedding = await generate_embedding(query)
        settings = get_rag_settings()
        
        top_k = limit if limit is not None else settings.get("top_k", 3)
        threshold = settings.get("similarity_threshold", 0.5)
        
        async with AsyncSessionLocal() as session:
            distance_expr = DocumentChunk.embedding.cosine_distance(query_embedding)
            stmt = select(DocumentChunk, distance_expr)
            if tenant_id and tenant_id not in ("all", "global"):
                if tenant_id in ("tenant-default", "default"):
                    stmt = stmt.where((DocumentChunk.tenant_id.in_(["tenant-default", "default"])) | (DocumentChunk.tenant_id.is_(None)))
                else:
                    stmt = stmt.where(DocumentChunk.tenant_id == tenant_id)
            stmt = stmt.order_by(distance_expr).limit(top_k)
            result = await session.execute(stmt)
            rows = result.all()
            
            matched_chunks = []
            for chunk, distance in rows:
                similarity = 1.0 - (distance or 0.0)
                if similarity >= threshold:
                    matched_chunks.append(chunk)
            
            # Fallback: if similarity threshold wasn't met, return the top matching chunks anyway
            if not matched_chunks and rows:
                matched_chunks = [c for c, dist in rows[:top_k]]
            
            if not matched_chunks:
                return "Bilgi bankasında arama yapıldı ancak henüz kaydedilmiş veri veya eşleşen bilgi bulunamadı."
                
            results_text = "\n---\n".join([f"Kaynak: {c.filename}\n{c.content}" for c in matched_chunks])
            return results_text
    except Exception as e:
        print(f"[RAG] Arama sirasinda hata: {e}")
        return "Bilgi bankasında arama yapılamadı."
