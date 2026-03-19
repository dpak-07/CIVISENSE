import logging
import sys

from app.core.log_buffer import LogBufferHandler, log_buffer


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        handlers=[logging.StreamHandler(sys.stdout), LogBufferHandler(log_buffer)],
        force=True,
    )
