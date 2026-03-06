import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes.monitoring import router as monitoring_router
from app.config import Settings, get_settings
from app.core.runtime import RuntimeStats
from app.db import MongoDB
from app.logging_config import configure_logging
from app.services.ai_service import ComplaintImageValidationService
from app.services.ai_processor import AIProcessor
from app.services.image_downloader import ImageDownloader
from app.services.mobilenet_service import MobileNetService
from app.services.model_loader import YOLOModelService
from app.services.priority_reasoning_service import PriorityReasoningService
from app.services.priority_engine import PriorityEngine
from app.services.s3_uploader import S3Uploader
from app.workers.change_stream_listener import ChangeStreamListener
from app.workers.processing_queue import ProcessingQueue
from app.workers.retry_worker import RetryWorker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings: Settings = get_settings()
    configure_logging(settings.log_level)

    runtime_stats = RuntimeStats()
    runtime_stats.replica_set_enabled = False

    mongodb = MongoDB(settings)
    image_downloader = ImageDownloader(settings)
    model_service = YOLOModelService(settings)
    mobilenet_service = MobileNetService(settings)
    image_validation_service = ComplaintImageValidationService(settings)
    priority_reasoning_service = PriorityReasoningService(settings)
    s3_uploader = S3Uploader(settings)
    processing_queue = None
    change_stream_listener = None
    retry_worker = None

    try:
        await mongodb.connect()
        runtime_stats.replica_set_enabled = mongodb.replica_set_enabled

        await image_downloader.start()
        await model_service.load()
        await mobilenet_service.load()
        await image_validation_service.load_model()
        await priority_reasoning_service.load_model()

        assert mongodb.complaints is not None
        assert mongodb.sensitive_locations is not None
        priority_engine = PriorityEngine(settings, mongodb.complaints, mongodb.sensitive_locations)
        ai_processor = AIProcessor(
            settings=settings,
            mongodb=mongodb,
            model_service=model_service,
            mobilenet_service=mobilenet_service,
            image_validation_service=image_validation_service,
            priority_reasoning_service=priority_reasoning_service,
            image_downloader=image_downloader,
            priority_engine=priority_engine,
            s3_uploader=s3_uploader,
            runtime_stats=runtime_stats,
        )

        processing_queue = ProcessingQueue(ai_processor=ai_processor, runtime_stats=runtime_stats)
        change_stream_listener = ChangeStreamListener(
            mongodb=mongodb,
            queue=processing_queue,
            runtime_stats=runtime_stats,
        )
        retry_worker = RetryWorker(
            settings=settings,
            mongodb=mongodb,
            queue=processing_queue,
            runtime_stats=runtime_stats,
        )

        await processing_queue.start()
        await change_stream_listener.start()
        await retry_worker.start()
        await retry_worker.run_once()

        app.state.settings = settings
        app.state.runtime_stats = runtime_stats
        app.state.mongodb = mongodb
        app.state.processing_queue = processing_queue
        app.state.change_stream_listener = change_stream_listener
        app.state.retry_worker = retry_worker

        logger.info("AI service started")
        yield
    finally:
        logger.info("AI service shutting down")

        if retry_worker is not None:
            await retry_worker.stop()
        if change_stream_listener is not None:
            await change_stream_listener.stop()
        if processing_queue is not None:
            await processing_queue.stop()

        await image_downloader.close()
        await mongodb.close()


app = FastAPI(
    title="CiviSense AI Decision Engine Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(monitoring_router)
