import os
import json
import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader
from sqlalchemy import select, delete
from google import genai
from backend.database.config import AsyncSessionLocal
from backend.database.models import DocumentChunk

def get_genai_client():
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        from dotenv import load_dotenv
        base_dir = os.path.dirname(os.path.abspath(__file__))
        load_dotenv(os.path.join(base_dir, "..", ".env"))
        api_key = os.getenv("GEMINI_API_KEY", "")
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

async def generate_embedding(text: str) -> list:
    """Generates a 768-dimensional text embedding using Gemini API."""
    client = get_genai_client()
    response = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=text,
        config={"output_dimensionality": 768}
    )
    return response.embeddings[0].values

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

async def index_pdf_file(file_path: str, filename: str, tenant_id: str = "tenant-default"):
    """Parses a PDF, chunks it, generates embeddings, and saves to local PostgreSQL."""
    print(f"[RAG] PDF Indeksleniyor: {filename} (Tenant: {tenant_id})")
    reader = PdfReader(file_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"
            
    settings = get_rag_settings()
    chunks = split_text_into_chunks(
        full_text, 
        chunk_size=settings.get("chunk_size", 800), 
        overlap=settings.get("chunk_overlap", 100)
    )
    
    async with AsyncSessionLocal() as session:
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            embedding = await generate_embedding(chunk)
            chunk_record = DocumentChunk(
                filename=filename,
                content=chunk,
                embedding=embedding,
                tenant_id=tenant_id
            )
            session.add(chunk_record)
        await session.commit()
    print(f"[RAG] PDF basariyla indekslendi! Toplam chunk: {len(chunks)}")

async def index_website_url(url: str, tenant_id: str = "tenant-default"):
    """Crawls a website, extracts text, chunks it, embeds, and saves to local PostgreSQL."""
    print(f"[RAG] Web sitesi taranıyor: {url} (Tenant: {tenant_id})")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient(verify=False, follow_redirects=True, timeout=30.0) as client:
        response = await client.get(url, headers=headers)
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
            embedding = await generate_embedding(chunk)
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
            embedding = await generate_embedding(chunk)
            chunk_record = DocumentChunk(
                filename=f"Manuel: {title}",
                content=chunk,
                embedding=embedding,
                tenant_id=tenant_id
            )
            session.add(chunk_record)
        await session.commit()
    print(f"[RAG] Manuel metin indekslendi! Toplam chunk: {len(chunks)}")

async def delete_indexed_source(source_name: str):
    """Deletes all chunks belonging to a specific source from database."""
    print(f"[RAG] Kaynak siliniyor: {source_name}")
    async with AsyncSessionLocal() as session:
        stmt = delete(DocumentChunk).where(DocumentChunk.filename == source_name)
        await session.execute(stmt)
        await session.commit()
    print(f"[RAG] Kaynak başarıyla silindi: {source_name}")

async def query_vector_search(query: str, limit: int = None) -> str:
    """Performs semantic search using pgvector cosine distance, filtering by similarity_threshold."""
    try:
        query_embedding = await generate_embedding(query)
        settings = get_rag_settings()
        
        top_k = limit if limit is not None else settings.get("top_k", 3)
        threshold = settings.get("similarity_threshold", 0.5)
        
        async with AsyncSessionLocal() as session:
            # Query chunks along with cosine distance
            distance_expr = DocumentChunk.embedding.cosine_distance(query_embedding)
            stmt = (
                select(DocumentChunk, distance_expr)
                .order_by(distance_expr)
                .limit(top_k)
            )
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
