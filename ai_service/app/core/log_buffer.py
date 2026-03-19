from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
import logging
import threading
import uuid

MAX_LOG_ENTRIES = 400
MAX_MESSAGE_LENGTH = 500


class LogBuffer:
    def __init__(self, max_entries: int = MAX_LOG_ENTRIES) -> None:
        self.max_entries = max_entries
        self.started_at = datetime.now(timezone.utc)
        self._entries: deque[dict] = deque(maxlen=max_entries)
        self._lock = threading.Lock()
        self._total = 0
        self._level_counts = {level: 0 for level in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")}

    def add(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        if len(message) > MAX_MESSAGE_LENGTH:
            message = f"{message[:MAX_MESSAGE_LENGTH]}..."

        entry = {
            "id": uuid.uuid4().hex,
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": message,
            "source": "ai_service",
        }

        for key in ("method", "path", "status_code", "duration_ms", "queue_size", "complaint_id"):
            value = getattr(record, key, None)
            if value is not None:
                entry[key] = value

        with self._lock:
            self._entries.append(entry)
            self._total += 1
            if record.levelname in self._level_counts:
                self._level_counts[record.levelname] += 1

    def recent(self, limit: int = 120, level: str | None = None) -> list[dict]:
        safe_limit = max(1, min(int(limit), 200))
        with self._lock:
            items = list(self._entries)

        if level:
            level_upper = level.upper()
            items = [item for item in items if item.get("level") == level_upper]

        return list(reversed(items[-safe_limit:]))

    def overview(self) -> dict:
        with self._lock:
            level_counts = dict(self._level_counts)
            total = self._total

        return {
            "startedAt": self.started_at.isoformat(),
            "total": total,
            "levelCounts": level_counts,
            "recentLimit": self.max_entries,
        }


class LogBufferHandler(logging.Handler):
    def __init__(self, buffer: LogBuffer) -> None:
        super().__init__()
        self.buffer = buffer

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self.buffer.add(record)
        except Exception:
            pass


log_buffer = LogBuffer()
