from fastapi import APIRouter, Query, Request

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
