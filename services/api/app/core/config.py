from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path

# Walk up from this file to find the .env at the project root
_HERE = Path(__file__).resolve()
for _p in _HERE.parents:
    _candidate = _p / ".env"
    if _candidate.exists():
        _ENV_FILE = str(_candidate)
        break
else:
    _ENV_FILE = ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://machinemind:machinemind_pass@localhost:5432/machinemind"
    SYNC_DATABASE_URL: str = "postgresql://machinemind:machinemind_pass@localhost:5432/machinemind"

    # Groq
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Embeddings
    EMBEDDING_MODEL: str = "intfloat/multilingual-e5-large"

    # Storage
    STORAGE_TYPE: str = "local"
    UPLOAD_DIR: str = "./uploads"

    # Auth
    SECRET_KEY: str = "change_me_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"

    # App
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    MAX_UPLOAD_SIZE_MB: int = 50
    MAX_PDF_PAGES: int = 500

    # RAG
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 100
    TOP_K_RETRIEVAL: int = 8

    # Page rendering / figures (roadmap item 2 + vision option A)
    PAGE_RENDER_DPI: int = 150
    FIGURE_DRAWING_PATHS: int = 100         # vector paths outside tables → schematic page
    FIGURE_IMAGE_AREA_RATIO: float = 0.15   # raster image area / page area → photo page
    FIGURE_MAX_PAGES: int = 12              # max pages sent to vision per manual

    # Vision: multi-provider with automatic fallback
    # auto = first provider having credentials (groq → gemini → openrouter)
    # groq | gemini | openrouter = force one provider; none = disabled
    VISION_PROVIDER: str = "auto"
    VISION_TIMEOUT_SECONDS: int = 90
    GROQ_VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    GEMINI_API_KEY: str = ""
    GEMINI_VISION_MODEL: str = "gemini-3.6-flash"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_VISION_MODEL: str = "meta-llama/llama-4-scout:free"

    # OCR (local Tesseract baseline — always available, no API key)
    OCR_DPI: int = 300
    OCR_LANG: str = "eng+fra"
    OCR_MAX_PAGES: int = 50                 # max scanned pages OCR'd per manual
    TESSERACT_CMD: str = ""                 # optional explicit path to tesseract.exe

    @property
    def allowed_origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        # In development always allow localhost variants
        if self.ENVIRONMENT == "development":
            for port in ("3000", "3001", "3002"):
                for o in (f"http://localhost:{port}", f"http://127.0.0.1:{port}"):
                    if o not in origins:
                        origins.append(o)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
