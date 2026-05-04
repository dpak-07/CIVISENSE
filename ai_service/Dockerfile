FROM python:3.11-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/home/appuser/.cache/huggingface \
    TORCH_HOME=/home/appuser/.cache/torch \
    YOLO_CONFIG_DIR=/home/appuser/.config/Ultralytics \
    MPLCONFIGDIR=/home/appuser/.cache/matplotlib

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libglib2.0-0 \
        libgomp1 \
        libxcb1 \
        libx11-6 \
        libxext6 \
        libsm6 \
        libxrender1 \
        libatk-bridge2.0-0 \
        libgtk-3-0 \
        libgl1 \
        libglx0 \
        libegl1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m pip install --upgrade pip \
    && pip install --only-binary=:all: -r requirements.txt

COPY app ./app
COPY scripts ./scripts

RUN adduser --disabled-password --gecos "" appuser \
    && mkdir -p /home/appuser/.cache /home/appuser/.config/Ultralytics \
    && chown -R appuser:appuser /app /home/appuser

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
