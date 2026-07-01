import os
import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader
from sqlalchemy import select
from google import genai
from backend.database.config import AsyncSessionLocal
from backend.database.models import DocumentChunk

def get_genai_client():
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        from dotenv import load_dotenv
        load_dotenv("/Users/anilacar/ai-project/backend/.env")
        api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")
    return genai.Client(api_key=api_key)

async def generate_embedding(text: str) -> list:
    """Generates a 768-dimensional text embedding using Gemini API."""
    client = get_genai_client()
    # Using gemini-embedding-001 model with 768 dimensions requested in config
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
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

async def index_pdf_file(file_path: str, filename: str):
    """Parses a PDF, chunks it, generates embeddings, and saves to local PostgreSQL."""
    print(f"[RAG] PDF Indeksleniyor: {filename}")
    reader = PdfReader(file_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"
            
    chunks = split_text_into_chunks(full_text)
    
    async with AsyncSessionLocal() as session:
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            embedding = await generate_embedding(chunk)
            chunk_record = DocumentChunk(
                filename=filename,
                content=chunk,
                embedding=embedding
            )
            session.add(chunk_record)
        await session.commit()
    print(f"[RAG] PDF basariyla indekslendi! Toplam chunk: {len(chunks)}")

async def index_website_url(url: str):
    """Crawls a website, extracts text, chunks it, embeds, and saves to local PostgreSQL."""
    print(f"[RAG] Web sitesi taranıyor: {url}")
    async with httpx.AsyncClient() as client:
        response = await client.get(url, follow_redirects=True)
        html = response.text
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
        
    text = soup.get_text(separator=' ')
    # Clean up whitespace
    lines = (line.strip() for line in text.splitlines())
    chunks_raw = (phrase.strip() for line in lines for phrase in line.split("  "))
    clean_text = "\n".join(chunk for chunk in chunks_raw if chunk)
    
    chunks = split_text_into_chunks(clean_text)
    
    async with AsyncSessionLocal() as session:
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            embedding = await generate_embedding(chunk)
            chunk_record = DocumentChunk(
                filename=url,
                content=chunk,
                embedding=embedding
            )
            session.add(chunk_record)
        await session.commit()
    print(f"[RAG] Web sitesi indekslendi! Toplam chunk: {len(chunks)}")

async def query_vector_search(query: str, limit: int = 3) -> str:
    """Performs semantic search using pgvector cosine distance on PostgreSQL."""
    try:
        query_embedding = await generate_embedding(query)
        
        async with AsyncSessionLocal() as session:
            # Query pgvector using cosine distance
            stmt = (
                select(DocumentChunk)
                .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
                .limit(limit)
            )
            result = await session.execute(stmt)
            chunks = result.scalars().all()
            
            if not chunks:
                return "Bilgi bankasında arama yapıldı ancak eşleşen sonuç bulunamadı."
                
            results_text = "\n---\n".join([f"Kaynak: {c.filename}\n{c.content}" for c in chunks])
            return results_text
    except Exception as e:
        print(f"[RAG] Arama sirasinda hata: {e}")
        return "Bilgi bankasında arama yapılamadı."
