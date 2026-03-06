import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    from pymongo import MongoClient, UpdateOne
    from pymongo.errors import PyMongoError
except ModuleNotFoundError:  # pragma: no cover - environment-specific
    MongoClient = None
    UpdateOne = None

    class PyMongoError(Exception):
        pass


@dataclass
class SeedSummary:
    collection: str
    existing_before: int
    inserted: int
    matched_existing: int
    skipped: bool
    total_after: int


DEFAULT_OFFICER_PASSWORD = "1234"
DEFAULT_OFFICER_EMAIL_DOMAIN = "gmail.com"
DEFAULT_SYSTEM_CONFIGS: list[dict[str, Any]] = [
    {
        "key": "app_distribution",
        "androidApkUrl": "https://civisence.s3.ap-south-1.amazonaws.com/app-release.apk",
        "iosNote": 'iOS build is coming soon. Apple dev tools asked for money, our startup wallet said "buffering...".',
        "updatedBy": None,
    }
]

EXTRA_CHENNAI_SENSITIVE_LOCATIONS: list[dict[str, Any]] = [
    {
        "name": "Marina Beach Police Outpost",
        "type": "police",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2833, 13.0505]},
    },
    {
        "name": "Santhome Police Station",
        "type": "police",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2786, 13.0332]},
    },
    {
        "name": "Triplicane MRTS Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2785, 13.0554]},
    },
    {
        "name": "Chepauk MRTS Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2796, 13.0639]},
    },
    {
        "name": "Kasturba Nagar MRTS Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2588, 13.0204]},
    },
    {
        "name": "Indira Nagar MRTS Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2582, 13.0143]},
    },
    {
        "name": "Taramani MRTS Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2413, 12.9854]},
    },
    {
        "name": "Luz Corner Police Booth",
        "type": "police",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2672, 13.0338]},
    },
    {
        "name": "Government Children Hospital Park Town",
        "type": "hospital",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2627, 13.0788]},
    },
    {
        "name": "Rajiv Gandhi Government General Hospital Emergency Block",
        "type": "hospital",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2809, 13.0804]},
    },
    {
        "name": "Egmore Railway Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2615, 13.0732]},
    },
    {
        "name": "Chennai Central Railway Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2746, 13.0827]},
    },
    {
        "name": "Tambaram Sanatorium Railway Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.1279, 12.9292]},
    },
    {
        "name": "Guindy Railway Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2129, 13.0066]},
    },
    {
        "name": "Velachery MRTS Station",
        "type": "station",
        "priorityWeight": 2,
        "location": {"type": "Point", "coordinates": [80.2185, 12.9815]},
    },
    {
        "name": "Chennai Port Trust",
        "type": "government_building",
        "priorityWeight": 1,
        "location": {"type": "Point", "coordinates": [80.3003, 13.0934]},
    },
    {
        "name": "CMRL Operations Control Centre Koyambedu",
        "type": "government_building",
        "priorityWeight": 1,
        "location": {"type": "Point", "coordinates": [80.2017, 13.0677]},
    },
    {
        "name": "Government Girls Higher Secondary School Nungambakkam",
        "type": "school",
        "priorityWeight": 3,
        "location": {"type": "Point", "coordinates": [80.2439, 13.0618]},
    },
    {
        "name": "Government High School Thiruvottiyur",
        "type": "school",
        "priorityWeight": 3,
        "location": {"type": "Point", "coordinates": [80.3045, 13.1598]},
    },
    {
        "name": "Government High School Velachery",
        "type": "school",
        "priorityWeight": 3,
        "location": {"type": "Point", "coordinates": [80.2167, 12.9759]},
    },
]


def parse_env_file(path: Path) -> dict[str, str]:
    parsed: dict[str, str] = {}
    if not path.exists():
        return parsed

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            parsed[key] = value

    return parsed


def load_seed_environment(script_dir: Path) -> None:
    # Environment variables already exported in shell always take precedence.
    env_candidates = [
        script_dir / ".env",
        script_dir.parent / "backend" / ".env",
        script_dir.parent / ".env",
    ]

    for env_path in env_candidates:
        for key, value in parse_env_file(env_path).items():
            os.environ.setdefault(key, value)


def load_json_file(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError(f"{path.name} must contain a JSON array")

    for index, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"{path.name} item at index {index} is not an object")

    return data


def resolve_database_name(mongo_uri: str) -> str:
    env_name = os.getenv("MONGO_DB_NAME")
    if env_name and env_name.strip():
        return env_name.strip()

    parsed = urlparse(mongo_uri)
    db_name = parsed.path.lstrip("/")
    if db_name:
        return db_name

    return "civisense"


def slugify(value: str) -> str:
    lowered = value.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "", lowered)
    return slug


def build_officer_email(document: dict[str, Any]) -> str:
    zone = str(document.get("zone") or "").strip()
    name = str(document.get("name") or "").strip()
    source = zone or name or "municipaloffice"
    local = slugify(source)
    if not local:
        local = "municipaloffice"
    if "zone" not in local:
        local = f"{local}zone"
    return f"{local}@{DEFAULT_OFFICER_EMAIL_DOMAIN}"


def normalize_sensitive_document(document: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(document)
    normalized.setdefault("priorityWeight", 1)
    normalized.setdefault("radiusMeters", 150)
    normalized["isActive"] = True
    return normalized


def merge_sensitive_documents(base_documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[tuple[str, str], dict[str, Any]] = {}
    for source in [*base_documents, *EXTRA_CHENNAI_SENSITIVE_LOCATIONS]:
        name = str(source.get("name") or "").strip()
        location_type = str(source.get("type") or source.get("category") or "").strip()
        if not name or not location_type:
            continue
        key = (name.lower(), location_type.lower())
        merged[key] = normalize_sensitive_document(source)
    return list(merged.values())


def normalize_system_config_document(document: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(document)
    key = str(normalized.get("key") or "").strip() or "app_distribution"
    normalized["key"] = key
    normalized["androidApkUrl"] = str(
        normalized.get("androidApkUrl") or "https://github.com/dpak-07/CIVISENCE/releases"
    ).strip()
    normalized["iosNote"] = str(
        normalized.get("iosNote")
        or 'iOS build is coming soon. Apple dev tools asked for money, our startup wallet said "buffering...".'
    ).strip()
    normalized.setdefault("updatedBy", None)
    return normalized


def load_system_config_documents(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return [normalize_system_config_document(item) for item in DEFAULT_SYSTEM_CONFIGS]

    return [normalize_system_config_document(item) for item in load_json_file(path)]


def backfill_municipal_credentials(municipal_collection) -> int:
    updated_count = 0
    cursor = municipal_collection.find({}, projection={"name": 1, "zone": 1, "officerCredentials": 1})
    for document in cursor:
        name = str(document.get("name") or "").strip()
        if not name:
            continue
        existing = document.get("officerCredentials") or {}
        snapshot = {
            "officerName": str(existing.get("officerName") or f"{name} Officer").strip(),
            "officerEmail": str(existing.get("officerEmail") or build_officer_email(document)).strip().lower(),
            "officerPassword": str(existing.get("officerPassword") or DEFAULT_OFFICER_PASSWORD).strip(),
        }
        result = municipal_collection.update_one(
            {"_id": document.get("_id")},
            {"$set": {"officerCredentials": snapshot, "isActive": True}},
        )
        updated_count += int(result.modified_count)
    return updated_count


def seed_collection(
    collection,
    documents: list[dict[str, Any]],
    unique_fields: tuple[str, ...],
    skip_if_non_empty: bool = True,
    update_existing: bool = False,
    create_location_index: bool = False,
) -> SeedSummary:
    existing_before = collection.count_documents({})
    if create_location_index:
        collection.create_index([("location", "2dsphere")], name="location_2dsphere")

    if existing_before > 0 and skip_if_non_empty:
        return SeedSummary(
            collection=collection.name,
            existing_before=existing_before,
            inserted=0,
            matched_existing=0,
            skipped=True,
            total_after=existing_before,
        )

    operations: list[Any] = []
    for document in documents:
        selector = {field: document[field] for field in unique_fields}
        if update_existing:
            set_payload = {key: value for key, value in document.items() if key not in unique_fields}
            update_doc: dict[str, Any] = {"$setOnInsert": selector}
            if set_payload:
                update_doc["$set"] = set_payload
        else:
            update_doc = {"$setOnInsert": document}
        operations.append(UpdateOne(selector, update_doc, upsert=True))

    inserted = 0
    matched_existing = 0
    if operations:
        result = collection.bulk_write(operations, ordered=False)
        inserted = result.upserted_count
        matched_existing = result.matched_count

    total_after = collection.count_documents({})
    return SeedSummary(
        collection=collection.name,
        existing_before=existing_before,
        inserted=inserted,
        matched_existing=matched_existing,
        skipped=False,
        total_after=total_after,
    )


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    municipal_file = script_dir / "municipal_offices_chennai.json"
    sensitive_file = script_dir / "sensitive_locations_chennai.json"
    system_config_file = script_dir / "system_config.json"

    try:
        if MongoClient is None or UpdateOne is None:
            raise ValueError(
                "Missing dependency 'pymongo'. Install it in current environment: pip install pymongo"
            )

        load_seed_environment(script_dir)

        mongo_uri = os.getenv("MONGO_URI")
        if not mongo_uri:
            raise ValueError("MONGO_URI is required (set in shell or in database/.env)")

        municipal_docs = load_json_file(municipal_file)
        sensitive_docs = merge_sensitive_documents(load_json_file(sensitive_file))
        system_config_docs = load_system_config_documents(system_config_file)

        database_name = resolve_database_name(mongo_uri)
        client = MongoClient(mongo_uri)
        db = client[database_name]

        municipal_collection = db["municipaloffices"]
        sensitive_collection = db["sensitive_locations"]
        system_config_collection = db["systemconfigs"]

        municipal_summary = seed_collection(
            collection=municipal_collection,
            documents=municipal_docs,
            unique_fields=("name", "zone", "type"),
            create_location_index=True,
        )
        sensitive_summary = seed_collection(
            collection=sensitive_collection,
            documents=sensitive_docs,
            unique_fields=("name", "type"),
            skip_if_non_empty=False,
            update_existing=True,
            create_location_index=True,
        )
        system_config_collection.create_index([("key", 1)], unique=True, name="system_config_key_unique")
        system_config_summary = seed_collection(
            collection=system_config_collection,
            documents=system_config_docs,
            unique_fields=("key",),
            skip_if_non_empty=False,
            update_existing=True,
        )

        activated_result = sensitive_collection.update_many({}, {"$set": {"isActive": True}})
        municipal_credentials_updated = backfill_municipal_credentials(municipal_collection)

        print("Seed run completed")
        for summary in (municipal_summary, sensitive_summary, system_config_summary):
            print(f"- Collection: {summary.collection}")
            print(f"  Existing before: {summary.existing_before}")
            print(f"  Inserted: {summary.inserted}")
            print(f"  Matched existing during upsert: {summary.matched_existing}")
            print(f"  Skipped due to non-empty: {summary.skipped}")
            print(f"  Total after: {summary.total_after}")
        print(f"- Sensitive locations forced active: {activated_result.modified_count}")
        print(f"- Municipal office credential snapshots updated: {municipal_credentials_updated}")

        client.close()
        return 0
    except (ValueError, FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"Seed data error: {exc}", file=sys.stderr)
        return 1
    except PyMongoError as exc:
        print(f"MongoDB error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Unexpected error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
