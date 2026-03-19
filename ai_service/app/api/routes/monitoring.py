import time

from fastapi import APIRouter, Query, Request

from app.core.log_buffer import log_buffer
from app.core.system_metrics import get_system_metrics

_metrics_cache: dict[str, object] = {
    "timestamp": 0.0,
    "data": None,
}
_METRICS_TTL_SECONDS = 30

router = APIRouter(tags=["monitoring"])


@router.get("/health")
async def health(request: Request) -> dict:
    runtime = request.app.state.runtime_stats
    queue = request.app.state.processing_queue
    db = request.app.state.mongodb

    return {
        "status": "ok",
        "service": "civisence-ai-service",
        "replicaSetEnabled": runtime.replica_set_enabled,
        "changeStreamRunning": runtime.change_stream_running,
        "queueSize": queue.queue_size(),
        "pendingCount": await db.count_pending_complaints(),
    }


@router.get("/stats")
async def stats(request: Request) -> dict:
    runtime = request.app.state.runtime_stats
    queue = request.app.state.processing_queue

    return runtime.to_dict(queue_size=queue.queue_size())


@router.get("/pending-count")
async def pending_count(request: Request) -> dict:
    db = request.app.state.mongodb
    count = await db.count_pending_complaints()
    return {"pendingCount": count}


@router.get("/sensitive-locations")
async def sensitive_locations(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
) -> dict:
    db = request.app.state.mongodb
    collection = db.sensitive_locations
    if collection is None:
        return {"count": 0, "items": []}

    cursor = collection.find(
        {},
        projection={
            "_id": 1,
            "name": 1,
            "type": 1,
            "category": 1,
            "priorityWeight": 1,
            "radiusMeters": 1,
            "location": 1,
            "isActive": 1,
            "updatedAt": 1,
        },
    ).sort("priorityWeight", -1).limit(int(limit))

    items = []
    async for item in cursor:
        item["_id"] = str(item.get("_id"))
        items.append(item)

    return {"count": len(items), "items": items}


@router.get("/logs/overview")
async def logs_overview(request: Request) -> dict:
    now = time.time()
    cached = _metrics_cache.get("data")
    if cached and (now - float(_metrics_cache.get("timestamp", 0))) < _METRICS_TTL_SECONDS:
        return cached

    data = log_buffer.overview()
    data["system"] = get_system_metrics()

    runtime = request.app.state.runtime_stats
    queue = request.app.state.processing_queue
    db = request.app.state.mongodb

    if runtime is not None and queue is not None:
        runtime_data = runtime.to_dict(queue_size=queue.queue_size())
        runtime_data["processedTotal"] = runtime_data.get("processedSuccess", 0) + runtime_data.get("processedFailed", 0)
        data["runtime"] = runtime_data

    if db is not None and db.complaints is not None:
        try:
            pending = await db.count_pending_complaints()
            done = await db.complaints.count_documents({"priority.aiProcessingStatus": "done"})
            failed = await db.complaints.count_documents({"priority.aiProcessingStatus": "failed"})
            processing = await db.complaints.count_documents({"priority.aiProcessingStatus": "processing"})
            data["pendingCount"] = pending
            data["processedCounts"] = {
                "done": done,
                "failed": failed,
                "processing": processing,
                "total": done + failed,
            }
        except Exception:
            data["pendingCount"] = None
            data["processedCounts"] = None

    _metrics_cache["timestamp"] = now
    _metrics_cache["data"] = data
    return data


@router.get("/logs/recent")
async def logs_recent(
    limit: int = Query(default=120, ge=1, le=200),
    level: str | None = Query(default=None),
) -> dict:
    return {"items": log_buffer.recent(limit=limit, level=level)}
