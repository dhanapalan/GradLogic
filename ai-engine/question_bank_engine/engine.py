"""
Main Question Bank Engine Orchestrator
=======================================
Unified interface for document management, retrieval, and question generation.
"""

import logging
from typing import List, Dict, Optional
from pathlib import Path

from document_loader import DocumentLoader, Document, DocumentChunk
from vector_store import VectorStore
from rag_engine import QuestionGenerator
from config import config

logger = logging.getLogger(__name__)


class QuestionBankEngine:
    """Main orchestrator for AI Question Bank system"""

    def __init__(self):
        self.document_loader = DocumentLoader()
        self.vector_store = VectorStore()
        self.question_generator = QuestionGenerator()
        self.logger = logger

    # ── Document Management ────────────────────────────────────────────────

    def ingest_document(self, file_path: str) -> Dict:
        """Ingest a single document"""
        self.logger.info(f"Ingesting document: {file_path}")

        # Load document
        doc = self.document_loader.load_document(file_path)
        if not doc:
            return {"success": False, "error": "Failed to load document"}

        # Add chunks to vector store
        result = self.vector_store.add_chunks(doc.chunks)

        return {
            "success": True,
            "document_id": doc.id,
            "title": doc.title,
            "chunks_count": len(doc.chunks),
            "added_to_vector_store": result["added"],
            "errors": result["errors"],
        }

    def ingest_batch(self, directory: str = None) -> Dict:
        """Ingest all documents from a directory"""
        self.logger.info(f"Ingesting batch from: {directory or config.document.documents_dir}")

        docs = self.document_loader.load_batch(directory)
        if not docs:
            return {"success": False, "error": "No documents found", "ingested": 0}

        total_chunks = 0
        total_added = 0
        total_errors = 0

        for doc in docs:
            result = self.vector_store.add_chunks(doc.chunks)
            total_chunks += len(doc.chunks)
            total_added += result["added"]
            total_errors += result["errors"]

        return {
            "success": True,
            "documents_ingested": len(docs),
            "total_chunks": total_chunks,
            "added_to_vector_store": total_added,
            "errors": total_errors,
        }

    def get_knowledge_base_status(self) -> Dict:
        """Get knowledge base status"""
        stats = self.vector_store.get_collection_stats()

        return {
            "status": "healthy" if stats.get("total_chunks", 0) > 0 else "empty",
            "knowledge_base": stats,
            "embedding_model": config.embedding.model_name,
            "llm_provider": config.llm.provider,
        }

    # ── Question Generation ────────────────────────────────────────────────

    def generate_questions(
        self,
        topic: str,
        difficulty: str = "medium",
        question_type: str = "multiple_choice",
        count: int = 3,
        use_rag: bool = True,
    ) -> Dict:
        """Generate questions for a topic"""

        if self.vector_store.get_collection_stats().get("total_chunks", 0) == 0 and use_rag:
            self.logger.warning("Knowledge base is empty, using LLM without RAG")
            use_rag = False

        questions = self.question_generator.generate_questions(
            topic=topic,
            difficulty=difficulty,
            question_type=question_type,
            count=count,
            use_rag=use_rag,
        )

        # Verification can reject drafts, so generated_count may be below what was
        # requested. Report both plus the reasons: a caller cannot otherwise tell
        # a misconfigured model from questions that failed their own check.
        rejected = getattr(self.question_generator, "last_run_rejections", [])

        return {
            "success": True,
            "topic": topic,
            "difficulty": difficulty,
            "question_type": question_type,
            "requested_count": count,
            "generated_count": len(questions),
            "rejected_count": len(rejected),
            "rejections": rejected,
            "questions": questions,
        }

    def generate_exam(
        self,
        topics: List[str],
        difficulty: str = "medium",
        questions_per_topic: int = 3,
        mix_types: bool = True,
    ) -> Dict:
        """Generate a complete exam with questions on multiple topics"""

        questions = []
        question_types = ["multiple_choice", "short_answer", "true_false"]

        for topic in topics:
            for i in range(questions_per_topic):
                # Vary question types if mix_types is True
                qtype = question_types[i % len(question_types)] if mix_types else "multiple_choice"

                gen_questions = self.question_generator.generate_questions(
                    topic=topic,
                    difficulty=difficulty,
                    question_type=qtype,
                    count=1,
                )

                questions.extend(gen_questions)

        return {
            "success": True,
            "exam": {
                "topics": topics,
                "difficulty": difficulty,
                "total_questions": len(questions),
                "questions": questions,
            },
        }

    # ── Search & Retrieval ─────────────────────────────────────────────────

    def search_knowledge_base(self, query: str, top_k: int = 5) -> Dict:
        """Search the knowledge base for relevant content"""

        results = self.vector_store.search(query, top_k=top_k)

        return {
            "success": True,
            "query": query,
            "results_count": len(results),
            "results": results,
        }

    def get_rag_context(self, query: str, top_k: int = 3) -> Dict:
        """Get RAG context for a query"""

        context = self.question_generator.retrieve_context(query, top_k=top_k)

        return {
            "success": True,
            "query": query,
            "context": context,
            "context_length": len(context),
        }

    # ── Analytics & Insights ───────────────────────────────────────────────

    def analyze_knowledge_gaps(self, topics: List[str]) -> Dict:
        """Analyze knowledge gaps for given topics"""

        analysis = {}

        for topic in topics:
            # Check if topic has sufficient coverage in knowledge base
            search_results = self.vector_store.search(topic, top_k=5)

            coverage_score = (
                sum(r["similarity"] for r in search_results) / len(search_results)
                if search_results
                else 0
            )

            analysis[topic] = {
                "coverage_score": coverage_score,
                "coverage_status": (
                    "well_covered" if coverage_score > 0.7
                    else "partially_covered" if coverage_score > 0.4
                    else "needs_content"
                ),
                "relevant_chunks_found": len(search_results),
            }

        return {
            "success": True,
            "analysis": analysis,
        }

    # ── Configuration & Management ─────────────────────────────────────────

    def get_config(self) -> Dict:
        """Get current engine configuration"""

        return {
            "llm": {
                "provider": config.llm.provider,
                "model": (
                    config.llm.groq_model
                    if config.llm.provider == "groq"
                    else config.llm.openai_model
                    if config.llm.provider == "openai"
                    else config.llm.ollama_model
                ),
                "temperature": config.llm.groq_temperature,
            },
            "embeddings": {
                "model": config.embedding.model_name,
                "dimension": config.embedding.embedding_dim,
            },
            "vector_store": {
                "backend": config.vector_store.backend,
                "chunk_size": config.vector_store.chunk_size,
                "chunk_overlap": config.vector_store.chunk_overlap,
                "top_k": config.vector_store.top_k,
            },
            "question_generation": {
                "supported_types": config.question_generation.question_types,
                "supported_difficulties": config.question_generation.difficulty_levels,
            },
        }

    def health_check(self) -> Dict:
        """Check system health"""

        try:
            stats = self.vector_store.get_collection_stats()
            kb_status = "healthy" if stats.get("total_chunks", 0) > 0 else "no_data"

            return {
                "status": "healthy",
                "components": {
                    "vector_store": kb_status,
                    "document_loader": "healthy",
                    "llm": "healthy",
                },
                "knowledge_base": stats,
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
            }


if __name__ == "__main__":
    print("AI Question Bank Engine Initialized")
    print("=" * 60)

    engine = QuestionBankEngine()

    # Check health
    health = engine.health_check()
    print("\n✅ Health Check:")
    print(f"  Status: {health['status']}")
    print(f"  Knowledge Base: {health.get('components', {}).get('vector_store')}")

    # Get config
    config_info = engine.get_config()
    print("\n⚙️  Configuration:")
    print(f"  LLM Provider: {config_info['llm']['provider']}")
    print(f"  Embedding Model: {config_info['embeddings']['model']}")
    print(f"  Vector Store: {config_info['vector_store']['backend']}")

    print("\n✨ Engine ready for use!")
