import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SHARED_ENV = PROJECT_ROOT / "backend" / ".env"
DEFAULT_LOCAL_ENV = PROJECT_ROOT / "ai_service" / ".env"

env_file_override = os.getenv("CIVISENSE_ENV_FILE")
if env_file_override:
    SELECTED_ENV_FILE = env_file_override
elif DEFAULT_SHARED_ENV.exists():
    SELECTED_ENV_FILE = str(DEFAULT_SHARED_ENV)
else:
    SELECTED_ENV_FILE = str(DEFAULT_LOCAL_ENV)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=SELECTED_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        populate_by_name=True,
        extra="ignore",
    )

    app_name: str = Field("CiviSense AI Decision Engine", alias="APP_NAME")
    environment: str = Field("production", alias="ENVIRONMENT")
    log_level: str = Field("INFO", alias="LOG_LEVEL")

    mongo_uri: str = Field(..., alias="MONGO_URI")
    mongo_db_name: str = Field("civisense", alias="MONGO_DB_NAME")
    mongo_complaints_collection: str = Field("complaints", alias="MONGO_COMPLAINTS_COLLECTION")
    mongo_sensitive_locations_collection: str = Field(
        "sensitive_locations", alias="MONGO_SENSITIVE_LOCATIONS_COLLECTION"
    )
    mongo_ai_blacklist_collection: str = Field("ai_blacklist", alias="MONGO_AI_BLACKLIST_COLLECTION")
    mongo_server_selection_timeout_ms: int = Field(5000, alias="MONGO_SERVER_SELECTION_TIMEOUT_MS")
    mongo_connect_timeout_ms: int = Field(10000, alias="MONGO_CONNECT_TIMEOUT_MS")
    mongo_allow_standalone_fallback: bool = Field(True, alias="MONGO_ALLOW_STANDALONE_FALLBACK")

    yolo_model_name: str = Field("yolov8n.pt", alias="YOLO_MODEL_NAME")
    yolo_confidence_threshold: float = Field(0.25, alias="YOLO_CONFIDENCE_THRESHOLD")
    yolo_image_size: int = Field(640, alias="YOLO_IMAGE_SIZE")
    yolo_max_image_dimension: int = Field(1024, alias="YOLO_MAX_IMAGE_DIMENSION")
    yolo_min_confidence_for_severity: float = Field(0.4, alias="YOLO_MIN_CONFIDENCE_FOR_SEVERITY")
    cpu_threads: int = Field(2, alias="CPU_THREADS")

    image_download_timeout_seconds: int = Field(15, alias="IMAGE_DOWNLOAD_TIMEOUT_SECONDS")
    image_max_bytes: int = Field(10 * 1024 * 1024, alias="IMAGE_MAX_BYTES")

    school_radius_meters: int = Field(2000, alias="SCHOOL_RADIUS_METERS")
    duplicate_similarity_threshold: float = Field(0.92, alias="DUPLICATE_SIMILARITY_THRESHOLD")
    duplicate_lookback_days: int = Field(7, alias="DUPLICATE_LOOKBACK_DAYS")
    duplicate_compare_limit: int = Field(50, alias="DUPLICATE_COMPARE_LIMIT")
    user_mismatch_blacklist_threshold: int = Field(3, alias="USER_MISMATCH_BLACKLIST_THRESHOLD")
    retry_interval_seconds: int = Field(60, alias="RETRY_INTERVAL_SECONDS")
    max_retry_attempts: int = Field(3, alias="MAX_RETRY_ATTEMPTS")
    retry_batch_size: int = Field(25, alias="RETRY_BATCH_SIZE")
    monitor_api_key: str = Field("", alias="AI_MONITOR_API_KEY")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
