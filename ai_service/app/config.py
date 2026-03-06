from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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
    hf_caption_model_name: str = Field(
        "Salesforce/blip-image-captioning-base",
        alias="HF_CAPTION_MODEL_NAME",
    )
    hf_caption_max_new_tokens: int = Field(32, alias="HF_CAPTION_MAX_NEW_TOKENS")
    hf_caption_num_beams: int = Field(3, alias="HF_CAPTION_NUM_BEAMS")
    hf_clip_model_name: str = Field("openai/clip-vit-base-patch32", alias="HF_CLIP_MODEL_NAME")
    hf_clip_score_weight: float = Field(3.0, alias="HF_CLIP_SCORE_WEIGHT")
    hf_clip_min_confidence: float = Field(0.28, alias="HF_CLIP_MIN_CONFIDENCE")
    civic_classifier_enabled: bool = Field(True, alias="CIVIC_CLASSIFIER_ENABLED")
    civic_classifier_model_path: str | None = Field(None, alias="CIVIC_CLASSIFIER_MODEL_PATH")
    civic_classifier_state_file: str = Field(
        "training_data/train_state.json",
        alias="CIVIC_CLASSIFIER_STATE_FILE",
    )
    civic_classifier_image_size: int = Field(224, alias="CIVIC_CLASSIFIER_IMAGE_SIZE")
    civic_classifier_score_weight: float = Field(4.2, alias="CIVIC_CLASSIFIER_SCORE_WEIGHT")
    civic_classifier_min_confidence: float = Field(0.5, alias="CIVIC_CLASSIFIER_MIN_CONFIDENCE")
    reason_nlp_enabled: bool = Field(True, alias="REASON_NLP_ENABLED")
    hf_reason_model_name: str = Field("google/flan-t5-small", alias="HF_REASON_MODEL_NAME")
    hf_reason_max_new_tokens: int = Field(72, alias="HF_REASON_MAX_NEW_TOKENS")
    category_validation_review_confidence: float = Field(
        0.6,
        alias="CATEGORY_VALIDATION_REVIEW_CONFIDENCE",
    )

    image_download_timeout_seconds: int = Field(15, alias="IMAGE_DOWNLOAD_TIMEOUT_SECONDS")
    image_max_bytes: int = Field(10 * 1024 * 1024, alias="IMAGE_MAX_BYTES")

    school_radius_meters: int = Field(2000, alias="SCHOOL_RADIUS_METERS")
    hospital_radius_meters: int = Field(1400, alias="HOSPITAL_RADIUS_METERS")
    transit_radius_meters: int = Field(1200, alias="TRANSIT_RADIUS_METERS")
    government_radius_meters: int = Field(1000, alias="GOVERNMENT_RADIUS_METERS")
    duplicate_similarity_threshold: float = Field(0.92, alias="DUPLICATE_SIMILARITY_THRESHOLD")
    duplicate_lookback_days: int = Field(7, alias="DUPLICATE_LOOKBACK_DAYS")
    duplicate_compare_limit: int = Field(50, alias="DUPLICATE_COMPARE_LIMIT")
    user_mismatch_blacklist_threshold: int = Field(3, alias="USER_MISMATCH_BLACKLIST_THRESHOLD")
    retry_interval_seconds: int = Field(60, alias="RETRY_INTERVAL_SECONDS")
    max_retry_attempts: int = Field(3, alias="MAX_RETRY_ATTEMPTS")
    retry_batch_size: int = Field(25, alias="RETRY_BATCH_SIZE")

    aws_region: str | None = Field(default=None, alias="AWS_REGION")
    aws_access_key_id: str | None = Field(default=None, alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(default=None, alias="AWS_SECRET_ACCESS_KEY")
    aws_bucket_name: str | None = Field(default=None, alias="AWS_BUCKET_NAME")
    aws_s3_endpoint_url: str | None = Field(default=None, alias="AWS_S3_ENDPOINT_URL")

    ai_output_prefix: str = Field("ai-outputs", alias="AI_OUTPUT_PREFIX")
    ai_max_annotations: int = Field(6, alias="AI_MAX_ANNOTATIONS")
    ai_model_disclaimer: str = Field(
        "Note: This AI result is generated using a stock pre-trained model and will be fine-tuned in later versions.",
        alias="AI_MODEL_DISCLAIMER",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
