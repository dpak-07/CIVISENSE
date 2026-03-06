import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.config import Settings
from app.services.ai_service import ComplaintImageValidationService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Predict the civic issue shown in a local image or image URL.",
    )
    parser.add_argument("--image", required=True, help="Local image path or http/https image URL.")
    parser.add_argument(
        "--reported-category",
        default="",
        help="Optional reported category to compare against the prediction.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Print a short human-readable summary before the JSON output.",
    )
    return parser.parse_args()


def build_settings() -> Settings:
    env_file = ROOT_DIR / ".env"
    mongo_uri = os.environ.get("MONGO_URI") or "mongodb://localhost:27017"
    return Settings(_env_file=env_file, MONGO_URI=mongo_uri)


async def run() -> int:
    args = parse_args()
    settings = build_settings()
    service = ComplaintImageValidationService(settings)
    await service.load_model()

    result = await service.validate_image_category(
        image_path=args.image,
        reported_category=args.reported_category,
    )

    if args.pretty:
        detected_issue = str(result.get("detected_issue") or "unknown").replace("_", " ")
        confidence = float(result.get("confidence") or 0.0)
        status = str(result.get("status") or "unknown")
        match_type = str(result.get("match_type") or "mismatch")
        print(f"Detected issue: {detected_issue}")
        print(f"Confidence: {confidence:.4f}")
        print(f"Status: {status}")
        print(f"Match type: {match_type}")
        print(f"Reason: {result.get('reason')}")
        print()

    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
