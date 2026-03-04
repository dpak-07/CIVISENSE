from fastapi import APIRouter, HTTPException, Request, status

router = APIRouter(tags=["monitoring"])

def _ensure_monitoring_auth(request: Request) -> None:
    settings = request.app.state.settings
    required_key = str(getattr(settings, "monitor_api_key", "") or "").strip()
    if not required_key:
        return

    header_key = (request.headers.get("x-ai-monitor-key") or "").strip()
    bearer = (request.headers.get("authorization") or "").strip()
    bearer_token = ""
    if bearer.lower().startswith("bearer "):
        bearer_token = bearer.split(" ", 1)[1].strip()

    if header_key == required_key or bearer_token == required_key:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized monitoring request",
    )


@router.get("/health")
async def health(request: Request) -> dict:
    _ensure_monitoring_auth(request)
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
    _ensure_monitoring_auth(request)
    runtime = request.app.state.runtime_stats
    queue = request.app.state.processing_queue

    return runtime.to_dict(queue_size=queue.queue_size())


@router.get("/pending-count")
async def pending_count(request: Request) -> dict:
    _ensure_monitoring_auth(request)
    db = request.app.state.mongodb
    count = await db.count_pending_complaints()
    return {"pendingCount": count}
