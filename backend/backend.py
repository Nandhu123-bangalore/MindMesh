import os
import re
import base64
import shutil
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from langchain_classic.retrievers.ensemble import EnsembleRetriever
from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_classic.retrievers import ContextualCompressionRetriever
from duckduckgo_search import DDGS

from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from router import route_query, should_fallback_to_web
from web_ingest import build_documents_from_urls

load_dotenv()

app = FastAPI(title="MindMesh Agentic RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FOLDER = os.path.join(BACKEND_DIR, "db")
DATA_FOLDER = os.path.join(BACKEND_DIR, "data")
os.makedirs(DATA_FOLDER, exist_ok=True)
os.makedirs(DB_FOLDER, exist_ok=True)

embedding = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

db = Chroma(
    persist_directory=DB_FOLDER,
    embedding_function=embedding
)

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.1,
)

reranker_model = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-base")
compressor = CrossEncoderReranker(model=reranker_model, top_n=5)
text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)

# Global retriever state — rebuilt after uploads
base_retriever = db.as_retriever(search_kwargs={"k": 5})
ensemble_retriever = base_retriever
multi_query_retriever = MultiQueryRetriever.from_llm(retriever=ensemble_retriever, llm=llm)
retriever = ContextualCompressionRetriever(
    base_compressor=compressor, base_retriever=multi_query_retriever
)


def _init_ensemble():
    global ensemble_retriever
    try:
        docs_data = db.get()
        texts = docs_data.get("documents", [])
        if texts:
            bm25 = BM25Retriever.from_texts(texts)
            bm25.k = 5
            ensemble_retriever = EnsembleRetriever(
                retrievers=[bm25, base_retriever], weights=[0.5, 0.5]
            )
        else:
            ensemble_retriever = base_retriever
    except Exception as e:
        print("BM25 init warning:", e)
        ensemble_retriever = base_retriever


_init_ensemble()


def rebuild_retrievers():
    global base_retriever, ensemble_retriever, multi_query_retriever, retriever
    base_retriever = db.as_retriever(search_kwargs={"k": 5})
    _init_ensemble()
    multi_query_retriever = MultiQueryRetriever.from_llm(
        retriever=ensemble_retriever, llm=llm
    )
    retriever = ContextualCompressionRetriever(
        base_compressor=compressor, base_retriever=multi_query_retriever
    )


def get_filtered_retriever(filenames: Optional[list[str]] = None):
    """Build a retriever scoped to specific uploaded files."""
    if not filenames:
        return retriever

    search_kwargs = {"k": 5, "filter": {"filename": {"$in": filenames}}}
    filtered_base = db.as_retriever(search_kwargs=search_kwargs)

    try:
        all_data = db.get(where={"filename": {"$in": filenames}})
        texts = all_data.get("documents", [])
        if texts:
            bm25 = BM25Retriever.from_texts(texts)
            bm25.k = 5
            filtered_ensemble = EnsembleRetriever(
                retrievers=[bm25, filtered_base], weights=[0.5, 0.5]
            )
        else:
            filtered_ensemble = filtered_base
    except Exception:
        filtered_ensemble = filtered_base

    mq = MultiQueryRetriever.from_llm(retriever=filtered_ensemble, llm=llm)
    return ContextualCompressionRetriever(
        base_compressor=compressor, base_retriever=mq
    )


def web_search(query: str, max_results: int = 4) -> tuple[str, list[str]]:
    """Search DuckDuckGo (free, no API key). Returns (context, source_titles)."""
    try:
        results = DDGS().text(query, max_results=max_results)
        if not results:
            return "No web search results found.", []
        parts = []
        sources = []
        for res in results:
            title = res.get("title", "Untitled")
            body = res.get("body", "")
            parts.append(f"Source: {title}\n{body}")
            sources.append(title)
        return "\n\n".join(parts), sources
    except Exception as e:
        print("Web search error:", e)
        return "Web search is currently unavailable.", []


def retrieve_docs(question: str, filenames: Optional[list[str]] = None):
    """Retrieve documents, optionally filtered by filename."""
    active_retriever = get_filtered_retriever(filenames)
    docs = []
    try:
        docs = active_retriever.invoke(question)
    except Exception as e:
        print("Retriever failed:", e)
        try:
            sk = {"k": 5}
            if filenames:
                sk["filter"] = {"filename": {"$in": filenames}}
            docs = db.as_retriever(search_kwargs=sk).invoke(question)
        except Exception as e2:
            print("Fallback retriever failed:", e2)
    return docs


class ChatRequest(BaseModel):
    question: str
    activeFiles: Optional[list[str]] = None


class UploadRequest(BaseModel):
    name: str
    contentBase64: str


class WebIngestRequest(BaseModel):
    urls: list[str]
    maxPages: int = 10
    allowedDomains: Optional[list[str]] = None


@app.post("/ingest-web")
def ingest_web(req: WebIngestRequest):
    try:
        if not req.urls:
            raise HTTPException(status_code=400, detail="Provide at least one URL.")

        scraped_pages = build_documents_from_urls(
            req.urls,
            max_pages=req.maxPages,
            allowed_domains=req.allowedDomains,
        )
        if not scraped_pages:
            return {"status": "success", "pages_scraped": 0, "chunks_added": 0, "message": "No web content found."}

        web_documents = []
        for page in scraped_pages:
            doc = Document(
                page_content=page["content"],
                metadata={
                    "source": page["url"],
                    "url": page["url"],
                    "filename": page["url"],
                    "type": "web",
                },
            )
            web_documents.extend(text_splitter.split_documents([doc]))

        valid_chunks = [chunk for chunk in web_documents if chunk.page_content.strip()]
        if valid_chunks:
            db.add_documents(valid_chunks)
            rebuild_retrievers()

        return {
            "status": "success",
            "pages_scraped": len(scraped_pages),
            "chunks_added": len(valid_chunks),
            "urls": req.urls,
        }
    except Exception as e:
        print(f"Web ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
def upload(req: UploadRequest):
    try:
        file_path = os.path.join(DATA_FOLDER, req.name)
        with open(file_path, "wb") as f:
            f.write(base64.b64decode(req.contentBase64))

        ext = os.path.splitext(req.name)[1].lower()
        if ext == ".pdf":
            loader = PyPDFLoader(file_path)
        elif ext == ".txt":
            loader = TextLoader(file_path, encoding="utf-8")
        elif ext == ".docx":
            loader = Docx2txtLoader(file_path)
        else:
            return {"status": "error", "message": "Unsupported file format. Use PDF, TXT, or DOCX."}

        raw_docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
        chunks = text_splitter.split_documents(raw_docs)

        for chunk in chunks:
            chunk.metadata["source"] = file_path
            chunk.metadata["filename"] = req.name
            chunk.metadata["uploaded"] = True

        valid_chunks = [c for c in chunks if c.page_content.strip()]
        if valid_chunks:
            db.add_documents(valid_chunks)
            rebuild_retrievers()

        return {"status": "success", "chunks_added": len(valid_chunks), "filename": req.name}
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/clear")
def clear_storage():
    try:
        if os.path.exists(DATA_FOLDER):
            shutil.rmtree(DATA_FOLDER)
        os.makedirs(DATA_FOLDER, exist_ok=True)
        if os.path.exists(DB_FOLDER):
            shutil.rmtree(DB_FOLDER)
        os.makedirs(DB_FOLDER, exist_ok=True)

        global db, base_retriever, ensemble_retriever, multi_query_retriever, retriever
        db = Chroma(persist_directory=DB_FOLDER, embedding_function=embedding)
        base_retriever = db.as_retriever(search_kwargs={"k": 5})
        ensemble_retriever = base_retriever
        multi_query_retriever = MultiQueryRetriever.from_llm(
            retriever=ensemble_retriever, llm=llm
        )
        retriever = ContextualCompressionRetriever(
            base_compressor=compressor, base_retriever=multi_query_retriever
        )
        return {"status": "success", "message": "Storage cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/route")
def route_only(req: ChatRequest):
    """Debug endpoint: returns routing decision without generating an answer."""
    active = req.activeFiles or []
    result = route_query(req.question, llm=llm, active_filenames=active)
    return result


@app.post("/chat")
def chat(req: ChatRequest):
    question = req.question.strip()
    active_files = req.activeFiles or []

    print(f"\nQUESTION: {question}")
    print(f"ACTIVE FILES: {active_files}")

    routing = route_query(question, llm=llm, active_filenames=active_files)
    route = routing["route"]
    reasoning = routing.get("reasoning", "")
    method = routing.get("method", "unknown")
    print(f"ROUTING: {route} ({method}) — {reasoning}")

    sources: list[str] = []
    fallback_used = False

    # --- CASUAL ---
    if route == "CASUAL":
        prompt = f"""You are MindMesh, a friendly AI/ML mentor.
The user said: "{question}"
Respond warmly and briefly. You can mention you're here to help with AI/ML topics."""
        response = llm.invoke(prompt).content
        return {
            "response": response,
            "route": route,
            "routingReason": reasoning,
            "routingMethod": method,
            "sources": sources,
        }

    # --- UNRELATED ---
    if route == "UNRELATED":
        return {
            "response": (
                "I'm MindMesh, an AI/ML Knowledge Assistant. I specialize in machine learning, "
                "artificial intelligence, and programming topics. I can't help with questions "
                "outside that scope — but feel free to ask me anything about AI, ML, or your uploaded documents!"
            ),
            "route": route,
            "routingReason": reasoning,
            "routingMethod": method,
            "sources": sources,
        }

    # --- WEB SEARCH ---
    if route == "WEB_SEARCH":
        context, sources = web_search(question + " AI machine learning")
        prompt = f"""You are MindMesh, an AI/ML mentor. Answer using recent web search results.

Web Search Results:
{context}

User Question: {question}

RULES:
1. Use the search results to give an accurate, up-to-date answer.
2. If results don't contain the answer, say "I couldn't find current information on that."
3. Be concise and educational.
4. Mention that this answer used web search for recency.

Answer:"""
        response = llm.invoke(prompt).content
        return {
            "response": response,
            "route": route,
            "routingReason": reasoning,
            "routingMethod": method,
            "sources": sources,
        }

    # --- DOCUMENT or VECTOR_DB (both use retrieval) ---
    scope_files = active_files if route == "DOCUMENT" else (active_files or None)
    docs = retrieve_docs(question, filenames=scope_files if route == "DOCUMENT" else None)

    # Misrouting recovery: VECTOR_DB found nothing but query looks time-sensitive
    if should_fallback_to_web(route, len(docs), question):
        print("FALLBACK: VECTOR_DB empty + time-sensitive signals → WEB_SEARCH")
        fallback_used = True
        route = "WEB_SEARCH"
        context, sources = web_search(question + " AI machine learning")
        prompt = f"""You are MindMesh. The knowledge base had no relevant docs, so web search was used.

Web Search Results:
{context}

User Question: {question}

Give an accurate, up-to-date answer based on search results. Be concise.

Answer:"""
        response = llm.invoke(prompt).content
        return {
            "response": response,
            "route": route,
            "routingReason": "Knowledge base had no match; fell back to web search.",
            "routingMethod": "fallback",
            "sources": sources,
            "fallbackUsed": True,
        }

    # Extract source filenames from retrieved docs
    for doc in docs:
        fname = doc.metadata.get("filename", doc.metadata.get("source", ""))
        if fname and fname not in sources:
            sources.append(os.path.basename(fname) if "/" in fname or "\\" in fname else fname)

    context = "\n\n".join([doc.page_content for doc in docs])

    if route == "DOCUMENT":
        scope_note = f" (from uploaded files: {', '.join(active_files)})" if active_files else ""
        no_context_msg = "I couldn't find relevant content in your uploaded documents."
    else:
        scope_note = ""
        no_context_msg = "I don't know based on my knowledge base."

    prompt = f"""You are MindMesh, an AI/ML mentor powered by Retrieval-Augmented Generation.

Answer using ONLY the retrieved context below{scope_note}.

RULES:
1. Prioritize the retrieved context. If the answer isn't there, say: "{no_context_msg}"
2. Explain clearly in simple, accurate terms.
3. Use bullet points for technical concepts when helpful.
4. Be structured and educational.

Retrieved Context:
{context if context else "(No relevant documents found)"}

User Question: {question}

Answer:"""

    response = llm.invoke(prompt).content
    return {
        "response": response,
        "route": route,
        "routingReason": reasoning,
        "routingMethod": method,
        "sources": sources,
        "fallbackUsed": fallback_used,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
