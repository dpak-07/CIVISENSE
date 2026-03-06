import argparse
import asyncio
import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.config import Settings
from app.services.ai_service import SUPPORTED_CATEGORIES, ComplaintImageValidationService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate civic issue identification accuracy on a labeled image folder.",
    )
    parser.add_argument(
        "--dataset-root",
        default="training_data/classification/val",
        help="Dataset root containing one folder per category.",
    )
    parser.add_argument(
        "--limit-per-class",
        type=int,
        default=0,
        help="Optional limit per class to speed up evaluation.",
    )
    parser.add_argument(
        "--output-json",
        default="",
        help="Optional path to save the evaluation report as JSON.",
    )
    return parser.parse_args()


def build_settings() -> Settings:
    env_file = ROOT_DIR / ".env"
    mongo_uri = os.environ.get("MONGO_URI") or "mongodb://localhost:27017"
    return Settings(_env_file=env_file, MONGO_URI=mongo_uri)


def collect_dataset(root: Path, limit_per_class: int) -> list[tuple[str, Path]]:
    samples: list[tuple[str, Path]] = []
    for category in SUPPORTED_CATEGORIES:
        category_dir = root / category
        if not category_dir.is_dir():
            continue
        files = sorted(
            [
                path
                for path in category_dir.iterdir()
                if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
            ]
        )
        if limit_per_class > 0:
            files = files[:limit_per_class]
        samples.extend((category, path) for path in files)
    return samples


async def run() -> int:
    args = parse_args()
    dataset_root = (ROOT_DIR / args.dataset_root).resolve() if not Path(args.dataset_root).is_absolute() else Path(args.dataset_root).resolve()
    if not dataset_root.is_dir():
        raise SystemExit(f"Dataset root not found: {dataset_root}")

    samples = collect_dataset(dataset_root, max(0, int(args.limit_per_class)))
    if not samples:
        raise SystemExit(f"No labeled images found under: {dataset_root}")

    settings = build_settings()
    service = ComplaintImageValidationService(settings)
    await service.load_model()

    overall_total = 0
    overall_exact = 0
    overall_valid = 0
    overall_unknown = 0
    per_class_total: Counter[str] = Counter()
    per_class_exact: Counter[str] = Counter()
    per_class_valid: Counter[str] = Counter()
    confusion: dict[str, Counter[str]] = defaultdict(Counter)

    for expected_category, image_path in samples:
        result = await service.validate_image_category(
            image_path=str(image_path),
            reported_category=expected_category,
        )
        predicted_category = str(result.get("detected_issue") or "unknown")
        match_type = str(result.get("match_type") or "mismatch")

        overall_total += 1
        per_class_total[expected_category] += 1
        confusion[expected_category][predicted_category] += 1

        if predicted_category == expected_category:
            overall_exact += 1
            per_class_exact[expected_category] += 1

        if match_type in {"exact", "related"}:
            overall_valid += 1
            per_class_valid[expected_category] += 1

        if predicted_category == "unknown":
            overall_unknown += 1

    report = {
        "datasetRoot": str(dataset_root),
        "samples": overall_total,
        "exactAccuracy": round((overall_exact / overall_total) if overall_total else 0.0, 4),
        "validMatchRate": round((overall_valid / overall_total) if overall_total else 0.0, 4),
        "unknownRate": round((overall_unknown / overall_total) if overall_total else 0.0, 4),
        "customClassifierActive": service._civic_classifier is not None,
        "customClassifierModelPath": service._civic_classifier_model_path,
        "perClass": {},
        "confusion": {actual: dict(counter) for actual, counter in confusion.items()},
    }

    for category in SUPPORTED_CATEGORIES:
        total = per_class_total[category]
        if total <= 0:
            continue
        report["perClass"][category] = {
            "samples": total,
            "exactAccuracy": round(per_class_exact[category] / total, 4),
            "validMatchRate": round(per_class_valid[category] / total, 4),
        }

    if args.output_json:
        output_path = Path(args.output_json)
        if not output_path.is_absolute():
            output_path = ROOT_DIR / output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
