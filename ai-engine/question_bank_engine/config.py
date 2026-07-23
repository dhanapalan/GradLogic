"""
AI Question Bank Engine Configuration
======================================
Centralized configuration for LLM, vector DB, and document processing.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
# Plain BaseModel: every field sources its value via os.getenv() defaults after
# load_dotenv(), so pydantic-settings' own env parsing is unnecessary (and its
# JSON-decoding of complex fields like lists breaks on comma-separated values).
from pydantic import BaseModel as BaseSettings

# Load environment variables
load_dotenv()

# Project root paths
PROJECT_ROOT = Path(__file__).parent
DATA_DIR = PROJECT_ROOT / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
VECTOR_STORE_DIR = DATA_DIR / "chroma_db"
LOGS_DIR = PROJECT_ROOT / "logs"

# Create directories if they don't exist
DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)


class LLMConfig(BaseSettings):
    """LLM Configuration"""

    # Primary LLM Provider
    provider: str = os.getenv("LLM_PROVIDER", "groq")  # groq|openai|ollama

    # Groq (Fast & Cheap - Recommended)
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")  # mixtral-8x7b was decommissioned
    groq_temperature: float = float(os.getenv("GROQ_TEMPERATURE", "0.4"))  # lower = better arithmetic accuracy
    groq_max_tokens: int = 2048

    # OpenAI (Fallback)
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview")
    openai_temperature: float = 0.7
    openai_max_tokens: int = 2048

    # Ollama (Fully Local - No API key needed)
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama2")

    # Anthropic Claude (Alternative)
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-opus")

    model_config = {"extra": "ignore"}


class EmbeddingConfig(BaseSettings):
    """Embedding Model Configuration"""

    # HuggingFace Embeddings (Local, Open-Source)
    model_name: str = os.getenv(
        "EMBEDDING_MODEL",
        "sentence-transformers/all-MiniLM-L6-v2"  # Fast, 384-dim, ~70MB
    )

    # Alternative models (uncomment to use):
    # "sentence-transformers/all-mpnet-base-v2"         # Better quality, ~430MB
    # "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"  # Multi-language
    # "sentence-transformers/all-roberta-large-v1"      # High quality, ~700MB

    embedding_dim: int = 384  # Dimension for all-MiniLM
    cache_folder: str = os.getenv("EMBEDDING_CACHE", str(DATA_DIR / "embeddings"))
    device: str = os.getenv("EMBEDDING_DEVICE", "cpu")  # cpu|cuda|mps

    model_config = {"extra": "ignore"}


class VectorStoreConfig(BaseSettings):
    """Vector Store Configuration (ChromaDB)"""

    backend: str = "chroma"  # chromadb for now
    persist_directory: str = str(VECTOR_STORE_DIR)

    # ChromaDB Settings
    collection_name: str = "knowledge_base"
    distance_metric: str = "cosine"  # cosine|l2|ip

    # Chunking Strategy
    chunk_size: int = 1024  # Characters per chunk
    chunk_overlap: int = 256  # Overlap between chunks

    # Retrieval
    top_k: int = 5  # Number of chunks to retrieve for RAG
    similarity_threshold: float = 0.5  # Minimum similarity score

    model_config = {"extra": "ignore"}


class DocumentConfig(BaseSettings):
    """Document Processing Configuration"""

    # Supported file types
    supported_formats: list = ["pdf", "docx", "txt", "md"]

    # Processing
    max_file_size_mb: int = 50
    documents_dir: str = str(DOCUMENTS_DIR)
    extract_metadata: bool = True

    # OCR (if needed for scanned PDFs)
    enable_ocr: bool = False
    ocr_language: str = "eng"

    model_config = {"extra": "ignore"}


class QuestionGenerationConfig(BaseSettings):
    """Question Generation Configuration"""

    # Question Types
    question_types: list = [
        "multiple_choice",
        "short_answer",
        "true_false",
        "fill_in_blank",
        "essay",
        "coding_challenge"
    ]

    # Difficulty Levels
    difficulty_levels: list = ["easy", "medium", "hard", "expert"]

    # Generation Parameters
    questions_per_chunk: int = 3  # Questions generated per document chunk
    batch_size: int = 5  # Process chunks in batches

    # Quality
    validate_questions: bool = True

    # Self-verification: after generating a question, solve it again in a separate
    # call without showing the claimed answer, and reject on disagreement. Costs
    # one extra LLM call per attempt but catches the common failure where the
    # model states an answer inconsistent with its own working.
    verify_answers: bool = os.getenv("QUESTION_VERIFY", "true").lower() in ("1", "true", "yes")
    verify_max_attempts: int = int(os.getenv("QUESTION_VERIFY_ATTEMPTS", "2"))
    min_confidence: float = 0.7  # Minimum LLM confidence to accept question

    # Subject Categories (Knowledge Base Structure)
    subject_categories: dict = {
        "aptitude": "Quantitative Aptitude & Reasoning",
        "data_structures": "Data Structures & Algorithms",
        "programming": "Programming & Software Engineering",
        "databases": "Databases & SQL",
        "system_design": "System Design",
        "communication": "Communication & Soft Skills",
        "logical_reasoning": "Logical Reasoning",
        "verbal_ability": "Verbal Ability",
    }

    model_config = {"extra": "ignore"}


class KnowledgeSourceConfig(BaseSettings):
    """Reference Books & Knowledge Sources Configuration"""

    # Curated Knowledge Sources (can seed initial data)
    knowledge_sources: dict = {
        "quantitative_aptitude": {
            "books": [
                "R.S. Aggarwal - Quantitative Aptitude",
                "Arun Sharma - How to Prepare for Quantitative Aptitude",
                "S. Chand - Arithmetic",
            ],
            "topics": ["Percentages", "Profit & Loss", "Time & Work", "Ratios", "Algebra"],
        },
        "logical_reasoning": {
            "books": [
                "R.S. Aggarwal - A Modern Approach to Logical Reasoning",
                "Lsat Logic Games",
            ],
            "topics": ["Syllogisms", "Analogies", "Series", "Puzzles", "Coding-Decoding"],
        },
        "verbal_ability": {
            "books": [
                "Wren & Martin - High School English Grammar",
                "Word Power Made Easy - Norman Lewis",
            ],
            "topics": ["Vocabulary", "Grammar", "Comprehension", "Critical Reasoning"],
        },
        "programming": {
            "books": [
                "Introduction to Algorithms - CLRS",
                "Cracking the Coding Interview",
            ],
            "topics": ["Arrays", "Linked Lists", "Trees", "Graphs", "Dynamic Programming"],
        },
    }

    model_config = {"extra": "ignore"}


class APIConfig(BaseSettings):
    """API Configuration for Question Bank Engine Endpoints"""

    host: str = os.getenv("API_HOST", "0.0.0.0")
    port: int = int(os.getenv("API_PORT", "8001"))
    reload: bool = os.getenv("API_RELOAD", "false").lower() == "true"

    # API Keys for authentication
    admin_api_key: str = os.getenv("QUESTION_ENGINE_API_KEY", "dev-key-question-engine")

    # CORS
    cors_origins: list = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5000").split(",")

    model_config = {"extra": "ignore"}


class LoggingConfig(BaseSettings):
    """Logging Configuration"""

    level: str = os.getenv("LOG_LEVEL", "INFO")
    format: str = "json"  # json|text
    log_file: str = str(LOGS_DIR / "question_engine.log")

    model_config = {"extra": "ignore"}


# ── Consolidated Configuration ────────────────────────────────────────────

class Config(BaseSettings):
    """Master Configuration"""

    # Environment
    env: str = os.getenv("ENV", "development")
    debug: bool = env == "development"

    # Components
    llm: LLMConfig = LLMConfig()
    embedding: EmbeddingConfig = EmbeddingConfig()
    vector_store: VectorStoreConfig = VectorStoreConfig()
    document: DocumentConfig = DocumentConfig()
    question_generation: QuestionGenerationConfig = QuestionGenerationConfig()
    knowledge_source: KnowledgeSourceConfig = KnowledgeSourceConfig()
    api: APIConfig = APIConfig()
    logging: LoggingConfig = LoggingConfig()

    # Paths
    project_root: Path = PROJECT_ROOT
    data_dir: Path = DATA_DIR
    documents_dir: Path = DOCUMENTS_DIR
    vector_store_dir: Path = VECTOR_STORE_DIR
    logs_dir: Path = LOGS_DIR

    model_config = {"extra": "ignore"}


# ── Global Configuration Instance ─────────────────────────────────────────

config = Config()


# ── Validation Functions ──────────────────────────────────────────────────

def validate_config():
    """Validate that required configuration is set"""

    issues = []

    # Check LLM configuration
    if config.llm.provider == "groq" and not config.llm.groq_api_key:
        issues.append("❌ GROQ_API_KEY not set (required for provider=groq)")

    if config.llm.provider == "openai" and not config.llm.openai_api_key:
        issues.append("❌ OPENAI_API_KEY not set (required for provider=openai)")

    if config.llm.provider == "anthropic" and not config.llm.anthropic_api_key:
        issues.append("❌ ANTHROPIC_API_KEY not set (required for provider=anthropic)")

    # Check embedding model
    if not config.embedding.model_name:
        issues.append("❌ EMBEDDING_MODEL not set")

    # Warnings
    warnings = []

    if config.debug:
        warnings.append("⚠️  Running in development mode")

    if config.llm.provider == "ollama":
        warnings.append(f"⚠️  Using local Ollama at {config.llm.ollama_base_url}")

    return issues, warnings


if __name__ == "__main__":
    print("AI Question Bank Engine Configuration")
    print("=" * 60)
    print(f"Environment: {config.env}")
    print(f"LLM Provider: {config.llm.provider}")
    print(f"Embedding Model: {config.embedding.model_name}")
    print(f"Vector Store: {config.vector_store.persist_directory}")
    print(f"Documents Dir: {config.document.documents_dir}")
    print(f"Logs Dir: {config.logging.log_file}")
    print()

    issues, warnings = validate_config()

    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  {w}")
        print()

    if issues:
        print("Configuration Issues:")
        for issue in issues:
            print(f"  {issue}")
        print("\nPlease set missing environment variables in .env file")
    else:
        print("✅ Configuration valid - ready to use!")
