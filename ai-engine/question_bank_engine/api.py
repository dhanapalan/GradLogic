"""
Question Bank Engine API
========================
FastAPI endpoints for question generation and knowledge base management.
"""

import logging
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import config, validate_config
from engine import QuestionBankEngine

logger = logging.getLogger(__name__)

# Validate configuration on startup
issues, warnings = validate_config()
if warnings:
    for w in warnings:
        logger.warning(w)
if issues:
    for issue in issues:
        logger.error(issue)

# Initialize FastAPI
app = FastAPI(
    title="AI Question Bank Engine",
    description="RAG-powered question generation from knowledge base",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.api.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engine
engine = QuestionBankEngine()


# ── Request/Response Models ────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Health check response"""

    status: str
    components: dict
    knowledge_base: dict


class GenerateQuestionsRequest(BaseModel):
    """Question generation request"""

    topic: str = Field(..., min_length=3, description="Topic to generate questions for")
    difficulty: str = Field(
        default="medium",
        description="Difficulty level: easy, medium, hard, expert",
    )
    question_type: str = Field(
        default="multiple_choice",
        description="Question type: multiple_choice, short_answer, true_false",
    )
    count: int = Field(default=3, ge=1, le=10, description="Number of questions to generate")
    use_rag: bool = Field(default=True, description="Use RAG for context-aware generation")


class GenerateExamRequest(BaseModel):
    """Exam generation request"""

    topics: List[str] = Field(..., min_items=1, description="Topics to include in exam")
    difficulty: str = Field(default="medium")
    questions_per_topic: int = Field(default=3, ge=1, le=10)
    mix_types: bool = Field(default=True, description="Mix different question types")


class SearchRequest(BaseModel):
    """Knowledge base search request"""

    query: str = Field(..., min_length=5, description="Search query")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of results to return")


class AnalyzeGapsRequest(BaseModel):
    """Knowledge gap analysis request"""

    topics: List[str] = Field(..., min_items=1, description="Topics to analyze")


class EmbedRequest(BaseModel):
    """Raw text embedding request"""

    text: str = Field(..., min_length=1, max_length=8000, description="Text to embed")


# ── Authentication ────────────────────────────────────────────────────

def verify_api_key(x_api_key: str = Header(...)) -> str:
    """Verify API key"""
    if x_api_key != config.api.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


# ── Health & Status ────────────────────────────────────────────────────

@app.get("/health")
async def health_check() -> HealthResponse:
    """Health check endpoint"""
    health = engine.health_check()
    return HealthResponse(**health)


@app.get("/config")
async def get_config():
    """Get engine configuration"""
    return engine.get_config()


@app.get("/status/knowledge-base")
async def get_kb_status():
    """Get knowledge base status"""
    return engine.get_knowledge_base_status()


# ── Document Management ────────────────────────────────────────────────

@app.post("/documents/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    api_key: str = Depends(verify_api_key),
):
    """Ingest a single document"""
    try:
        # Save uploaded file (documents_dir is a str in config)
        file_path = Path(config.document.documents_dir) / file.filename
        contents = await file.read()

        with open(file_path, "wb") as f:
            f.write(contents)

        # Process document
        result = engine.ingest_document(str(file_path))
        return result

    except Exception as e:
        logger.error(f"Error ingesting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents/ingest-batch")
async def ingest_batch(api_key: str = Depends(verify_api_key)):
    """Ingest all documents from directory"""
    try:
        result = engine.ingest_batch()
        return result
    except Exception as e:
        logger.error(f"Error in batch ingestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Question Generation ────────────────────────────────────────────────

@app.post("/questions/generate")
async def generate_questions(request: GenerateQuestionsRequest):
    """Generate questions for a topic"""
    try:
        result = engine.generate_questions(
            topic=request.topic,
            difficulty=request.difficulty,
            question_type=request.question_type,
            count=request.count,
            use_rag=request.use_rag,
        )
        return result
    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/questions/generate-exam")
async def generate_exam(request: GenerateExamRequest):
    """Generate a complete exam"""
    try:
        result = engine.generate_exam(
            topics=request.topics,
            difficulty=request.difficulty,
            questions_per_topic=request.questions_per_topic,
            mix_types=request.mix_types,
        )
        return result
    except Exception as e:
        logger.error(f"Error generating exam: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Search & Retrieval ─────────────────────────────────────────────────

@app.post("/search")
async def search_knowledge_base(request: SearchRequest):
    """Search knowledge base for relevant content"""
    try:
        result = engine.search_knowledge_base(query=request.query, top_k=request.top_k)
        return result
    except Exception as e:
        logger.error(f"Error searching knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/context")
async def get_rag_context(request: SearchRequest):
    """Get RAG context for a query"""
    try:
        result = engine.get_rag_context(query=request.query, top_k=request.top_k)
        return result
    except Exception as e:
        logger.error(f"Error retrieving RAG context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed")
async def embed_text(request: EmbedRequest):
    """
    Raw text embedding — reuses the same sentence-transformers model already
    loaded for document/RAG search (engine.vector_store.embeddings), so this
    adds no new model download or memory cost. Used by the Node backend's
    semantic search (Phase 10 AI Search) to embed both stored question text
    and live search queries for cosine-similarity ranking.
    """
    try:
        vector = engine.vector_store.embeddings.encode(request.text, convert_to_numpy=True).tolist()
        return {"vector": vector, "model": config.embedding.model_name}
    except Exception as e:
        logger.error(f"Error embedding text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Analytics ──────────────────────────────────────────────────────────

@app.post("/analytics/knowledge-gaps")
async def analyze_gaps(request: AnalyzeGapsRequest):
    """Analyze knowledge gaps for topics"""
    try:
        result = engine.analyze_knowledge_gaps(topics=request.topics)
        return result
    except Exception as e:
        logger.error(f"Error analyzing knowledge gaps: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Admin ──────────────────────────────────────────────────────────────

@app.delete("/admin/knowledge-base/clear")
async def clear_knowledge_base(api_key: str = Depends(verify_api_key)):
    """Clear knowledge base (admin only)"""
    try:
        success = engine.vector_store.clear_collection()
        return {"success": success, "message": "Knowledge base cleared"}
    except Exception as e:
        logger.error(f"Error clearing knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Root ───────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "AI Question Bank Engine",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=config.api.host,
        port=config.api.port,
        reload=config.api.reload,
    )
