import argparse
import asyncio
import hashlib
import json
import logging
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import aiohttp
from PIL import Image, UnidentifiedImageError
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from ultralytics import YOLO

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.config import get_settings
from app.db import MongoDB

logger = logging.getLogger("auto_train_from_s3")

DEFAULT_CATEGORIES = (
    "pothole",
    "garbage",
    "drainage",
    "water_leak",
    "streetlight",
    "road_damage",
    "traffic_sign",
)


@dataclass(frozen=True)
class TrainingConfig:
    dataset_root: Path
    output_root: Path
    state_file: Path
    categories: tuple[str, ...]
    min_images_per_class: int
    min_total_images: int
    max_images_per_class: int
    train_ratio: float
    download_concurrency: int
    epochs: int
    imgsz: int
    batch: int
    workers: int
    base_model: str
    cooldown_hours: int
    loop_seconds: int
    weekly_sunday_midnight: bool
    force_train: bool


@dataclass(frozen=True)
class ImageSample:
    complaint_id: str
    category: str
    url: str


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(
        description="Build civic image dataset from complaint S3 URLs and auto-train YOLO classifier when ready."
    )
    parser.add_argument("--dataset-root", default="training_data", help="Dataset workspace root.")
    parser.add_argument("--output-root", default="training_runs", help="YOLO training outputs root.")
    parser.add_argument("--state-file", default="training_data/train_state.json", help="Training state file path.")
    parser.add_argument("--categories", default=",".join(DEFAULT_CATEGORIES), help="Comma-separated categories.")
    parser.add_argument("--min-images-per-class", type=int, default=50, help="Minimum images required per category.")
    parser.add_argument("--min-total-images", type=int, default=300, help="Minimum total images required.")
    parser.add_argument(
        "--max-images-per-class",
        type=int,
        default=4000,
        help="Upper cap while collecting per category to keep training bounded.",
    )
    parser.add_argument("--train-ratio", type=float, default=0.8, help="Train split ratio [0.5..0.95].")
    parser.add_argument("--download-concurrency", type=int, default=8, help="Concurrent download workers.")
    parser.add_argument("--epochs", type=int, default=40, help="YOLO training epochs.")
    parser.add_argument("--imgsz", type=int, default=224, help="Classification image size.")
    parser.add_argument("--batch", type=int, default=16, help="Training batch size.")
    parser.add_argument("--workers", type=int, default=2, help="YOLO data loader workers.")
    parser.add_argument("--base-model", default="yolov8n-cls.pt", help="Base YOLO classification model.")
    parser.add_argument("--cooldown-hours", type=int, default=24, help="Minimum hours between trainings.")
    parser.add_argument(
        "--loop-seconds",
        type=int,
        default=0,
        help="If >0, continuously re-check and auto-train every N seconds.",
    )
    parser.add_argument(
        "--weekly-sunday-midnight",
        action="store_true",
        help="Run on weekly schedule: every Sunday at 12:00 AM local time.",
    )
    parser.add_argument("--force-train", action="store_true", help="Train even if state signature is unchanged.")
    args = parser.parse_args()

    categories = tuple(
        category.strip().lower()
        for category in args.categories.split(",")
        if category.strip()
    )
    train_ratio = min(0.95, max(0.5, float(args.train_ratio)))

    return TrainingConfig(
        dataset_root=Path(args.dataset_root),
        output_root=Path(args.output_root),
        state_file=Path(args.state_file),
        categories=categories,
        min_images_per_class=max(1, int(args.min_images_per_class)),
        min_total_images=max(1, int(args.min_total_images)),
        max_images_per_class=max(1, int(args.max_images_per_class)),
        train_ratio=train_ratio,
        download_concurrency=max(1, int(args.download_concurrency)),
        epochs=max(1, int(args.epochs)),
        imgsz=max(64, int(args.imgsz)),
        batch=max(1, int(args.batch)),
        workers=max(0, int(args.workers)),
        base_model=args.base_model,
        cooldown_hours=max(0, int(args.cooldown_hours)),
        loop_seconds=max(0, int(args.loop_seconds)),
        weekly_sunday_midnight=bool(args.weekly_sunday_midnight),
        force_train=bool(args.force_train),
    )


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def connect_mongo_with_fallback() -> tuple[MongoClient, str]:
    settings = get_settings()
    uri = settings.mongo_uri

    client = MongoClient(uri, serverSelectionTimeoutMS=settings.mongo_server_selection_timeout_ms)
    try:
        client.admin.command("ping")
        return client, uri
    except ServerSelectionTimeoutError:
        client.close()
        uri = MongoDB._to_standalone_uri(settings.mongo_uri)
        client = MongoClient(uri, serverSelectionTimeoutMS=settings.mongo_server_selection_timeout_ms)
        client.admin.command("ping")
        return client, uri


def collect_samples(config: TrainingConfig) -> list[ImageSample]:
    settings = get_settings()
    client, used_uri = connect_mongo_with_fallback()
    logger.info("Connected to Mongo for training data export: %s", used_uri)

    try:
        collection = client[settings.mongo_db_name][settings.mongo_complaints_collection]
        cursor = collection.find(
            {
                "category": {"$in": list(config.categories)},
                "images.0.url": {"$exists": True},
            },
            projection={"_id": 1, "category": 1, "images.url": 1},
        ).sort("createdAt", -1)

        per_category_count: dict[str, int] = {category: 0 for category in config.categories}
        url_seen: set[str] = set()
        samples: list[ImageSample] = []

        for document in cursor:
            category_raw = document.get("category")
            category = str(category_raw or "").strip().lower()
            if category not in per_category_count:
                continue
            if per_category_count[category] >= config.max_images_per_class:
                continue

            images = document.get("images")
            if not isinstance(images, list) or not images:
                continue

            first = images[0]
            if not isinstance(first, dict):
                continue

            url = first.get("url")
            if not isinstance(url, str) or not url.strip():
                continue
            url = url.strip()
            if url in url_seen:
                continue

            url_seen.add(url)
            per_category_count[category] += 1
            samples.append(
                ImageSample(
                    complaint_id=str(document.get("_id")),
                    category=category,
                    url=url,
                )
            )

        logger.info(
            "Collected candidate samples: total=%d counts=%s",
            len(samples),
            per_category_count,
        )
        return samples
    finally:
        client.close()


def canonical_name(sample: ImageSample) -> str:
    digest = hashlib.sha1(sample.url.encode("utf-8")).hexdigest()
    return f"{sample.complaint_id}_{digest}.jpg"


def ensure_dirs(config: TrainingConfig) -> None:
    for category in config.categories:
        (config.dataset_root / "raw" / category).mkdir(parents=True, exist_ok=True)
        (config.dataset_root / "classification" / "train" / category).mkdir(parents=True, exist_ok=True)
        (config.dataset_root / "classification" / "val" / category).mkdir(parents=True, exist_ok=True)
    config.output_root.mkdir(parents=True, exist_ok=True)
    config.state_file.parent.mkdir(parents=True, exist_ok=True)


def clear_split_dirs(config: TrainingConfig) -> None:
    train_root = config.dataset_root / "classification" / "train"
    val_root = config.dataset_root / "classification" / "val"
    for root in (train_root, val_root):
        if root.exists():
            for child in root.iterdir():
                if child.is_dir():
                    shutil.rmtree(child)
        root.mkdir(parents=True, exist_ok=True)

    for category in config.categories:
        (train_root / category).mkdir(parents=True, exist_ok=True)
        (val_root / category).mkdir(parents=True, exist_ok=True)


async def download_missing_images(config: TrainingConfig, samples: list[ImageSample]) -> dict[str, int]:
    semaphore = asyncio.Semaphore(config.download_concurrency)
    counters = {"downloaded": 0, "skipped_existing": 0, "failed": 0}

    timeout = aiohttp.ClientTimeout(total=30)
    connector = aiohttp.TCPConnector(limit=config.download_concurrency)

    async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
        tasks = [
            _download_one(
                session=session,
                semaphore=semaphore,
                dataset_root=config.dataset_root,
                sample=sample,
                counters=counters,
            )
            for sample in samples
        ]
        await asyncio.gather(*tasks)

    return counters


async def _download_one(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    dataset_root: Path,
    sample: ImageSample,
    counters: dict[str, int],
) -> None:
    destination = dataset_root / "raw" / sample.category / canonical_name(sample)
    if destination.exists():
        counters["skipped_existing"] += 1
        return

    async with semaphore:
        try:
            async with session.get(sample.url) as response:
                if response.status != 200:
                    counters["failed"] += 1
                    return
                payload = await response.read()
        except Exception:
            counters["failed"] += 1
            return

        try:
            from io import BytesIO

            destination.parent.mkdir(parents=True, exist_ok=True)
            image = Image.open(BytesIO(payload)).convert("RGB")
            image.save(destination, format="JPEG", quality=92, optimize=True)
            counters["downloaded"] += 1
        except (UnidentifiedImageError, OSError, ValueError):
            counters["failed"] += 1


def collect_raw_images(config: TrainingConfig) -> dict[str, list[Path]]:
    per_category: dict[str, list[Path]] = {}
    for category in config.categories:
        directory = config.dataset_root / "raw" / category
        images = sorted([path for path in directory.glob("*.jpg") if path.is_file()])
        per_category[category] = images
    return per_category


def is_dataset_ready(config: TrainingConfig, per_category_images: dict[str, list[Path]]) -> tuple[bool, dict[str, int], int]:
    counts = {category: len(paths) for category, paths in per_category_images.items()}
    total = sum(counts.values())

    enough_per_class = all(count >= config.min_images_per_class for count in counts.values())
    enough_total = total >= config.min_total_images
    return enough_per_class and enough_total, counts, total


def deterministic_split(config: TrainingConfig, per_category_images: dict[str, list[Path]]) -> None:
    clear_split_dirs(config)
    train_root = config.dataset_root / "classification" / "train"
    val_root = config.dataset_root / "classification" / "val"

    train_threshold = int(config.train_ratio * 1000)

    for category, files in per_category_images.items():
        train_files: list[Path] = []
        val_files: list[Path] = []

        for file_path in files:
            key = hashlib.sha1(file_path.name.encode("utf-8")).hexdigest()
            bucket = int(key, 16) % 1000
            if bucket < train_threshold:
                train_files.append(file_path)
            else:
                val_files.append(file_path)

        if not val_files and len(train_files) > 1:
            val_files.append(train_files.pop())
        if not train_files and val_files:
            train_files.append(val_files.pop())

        for source in train_files:
            shutil.copy2(source, train_root / category / source.name)
        for source in val_files:
            shutil.copy2(source, val_root / category / source.name)


def state_signature(per_category_images: dict[str, list[Path]]) -> str:
    hasher = hashlib.sha1()
    for category in sorted(per_category_images.keys()):
        hasher.update(category.encode("utf-8"))
        for image_path in per_category_images[category]:
            hasher.update(image_path.name.encode("utf-8"))
    return hasher.hexdigest()


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_state(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def cooldown_passed(previous_iso: str | None, cooldown_hours: int) -> bool:
    if cooldown_hours <= 0 or not previous_iso:
        return True
    try:
        previous = datetime.fromisoformat(previous_iso)
    except ValueError:
        return True
    if previous.tzinfo is None:
        previous = previous.replace(tzinfo=timezone.utc)
    elapsed = datetime.now(timezone.utc) - previous.astimezone(timezone.utc)
    return elapsed.total_seconds() >= cooldown_hours * 3600


def run_training(config: TrainingConfig, counts: dict[str, int], signature: str) -> Path:
    model = YOLO(config.base_model)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_name = f"civic_cls_{timestamp}"

    logger.info(
        "Starting YOLO training run=%s epochs=%d imgsz=%d batch=%d counts=%s",
        run_name,
        config.epochs,
        config.imgsz,
        config.batch,
        counts,
    )

    result = model.train(
        data=str(config.dataset_root / "classification"),
        epochs=config.epochs,
        imgsz=config.imgsz,
        batch=config.batch,
        workers=config.workers,
        project=str(config.output_root),
        name=run_name,
        device="cpu",
        exist_ok=False,
        verbose=False,
    )

    save_dir = Path(getattr(result, "save_dir"))
    best_path = save_dir / "weights" / "best.pt"
    last_path = save_dir / "weights" / "last.pt"
    selected = best_path if best_path.exists() else last_path
    logger.info("Training completed. weights=%s signature=%s", selected, signature)
    return selected


def activate_trained_weights(config: TrainingConfig, weights_path: Path) -> Path:
    active_path = config.dataset_root / "active_civic_classifier.pt"
    active_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(weights_path, active_path)
    logger.info("Activated fine-tuned civic classifier weights at %s", active_path)
    return active_path


async def run_once(config: TrainingConfig) -> None:
    ensure_dirs(config)

    samples = collect_samples(config)
    download_stats = await download_missing_images(config, samples)
    logger.info("Download stats: %s", download_stats)

    per_category_images = collect_raw_images(config)
    ready, counts, total = is_dataset_ready(config, per_category_images)
    logger.info("Dataset counts=%s total=%d", counts, total)
    if not ready:
        logger.info(
            "Not enough images to train (need per_class>=%d and total>=%d).",
            config.min_images_per_class,
            config.min_total_images,
        )
        return

    deterministic_split(config, per_category_images)
    signature = state_signature(per_category_images)
    state = load_state(config.state_file)
    previous_signature = str(state.get("lastSignature") or "")
    previous_trained_at = state.get("lastTrainedAt")

    if not config.force_train:
        if signature == previous_signature:
            logger.info("Dataset unchanged since last training. Skipping.")
            return
        if not cooldown_passed(previous_trained_at, config.cooldown_hours):
            logger.info("Cooldown active (%d h). Skipping training.", config.cooldown_hours)
            return

    weights_path = run_training(config, counts, signature)
    active_weights_path = activate_trained_weights(config, weights_path)
    save_state(
        config.state_file,
        {
            "lastTrainedAt": datetime.now(timezone.utc).isoformat(),
            "lastSignature": signature,
            "lastWeightsPath": str(weights_path),
            "activeWeightsPath": str(active_weights_path),
            "counts": counts,
            "totalImages": total,
            "baseModel": config.base_model,
        },
    )


async def run_loop(config: TrainingConfig) -> None:
    if config.weekly_sunday_midnight:
        await run_weekly_sunday_midnight(config)
        return

    if config.loop_seconds <= 0:
        await run_once(config)
        return

    logger.info("Auto-train loop started. interval_seconds=%d", config.loop_seconds)
    while True:
        try:
            await run_once(config)
        except Exception:
            logger.exception("Auto-train run failed")
        await asyncio.sleep(config.loop_seconds)


def next_sunday_midnight_local(now: datetime | None = None) -> datetime:
    current = now or datetime.now().astimezone()
    local_now = current.astimezone()
    days_until_sunday = (6 - local_now.weekday()) % 7

    target = local_now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=days_until_sunday)
    if target <= local_now:
        target += timedelta(days=7)
    return target


async def run_weekly_sunday_midnight(config: TrainingConfig) -> None:
    logger.info("Auto-train weekly schedule started: Sunday 12:00 AM (local time)")
    while True:
        local_now = datetime.now().astimezone()
        target = next_sunday_midnight_local(local_now)
        wait_seconds = max(0.0, (target - local_now).total_seconds())

        logger.info(
            "Next scheduled run at %s (in %.1f hours)",
            target.isoformat(),
            wait_seconds / 3600.0,
        )
        await asyncio.sleep(wait_seconds)

        try:
            await run_once(config)
        except Exception:
            logger.exception("Weekly auto-train run failed")


def main() -> None:
    configure_logging()
    config = parse_args()
    asyncio.run(run_loop(config))


if __name__ == "__main__":
    main()
