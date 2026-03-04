import asyncio
import logging
import math
from dataclasses import dataclass
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo.errors import OperationFailure


logger = logging.getLogger(__name__)

GEO_MAX_SEARCH_METERS = 5000
DEFAULT_RADIUS_METERS = 150.0

TYPE_BASE_MULTIPLIER: dict[str, float] = {
    "school": 1.28,
    "hospital": 1.35,
    "police": 1.22,
    "station": 1.2,
    "government_building": 1.24,
    "other": 1.12,
}


@dataclass(frozen=True)
class GeoMultiplierResult:
    multiplier: float
    matched_type: str
    matched_name: str | None = None


class GeoMultiplier:
    def __init__(self, sensitive_locations: AsyncIOMotorCollection) -> None:
        self.sensitive_locations = sensitive_locations
        self._geo_query_supported: bool | None = None
        self._geo_support_lock = asyncio.Lock()
        self._geo_warning_emitted = False

    async def resolve(self, complaint: dict[str, Any]) -> GeoMultiplierResult:
        linked_location = await self._resolve_linked_sensitive_location(complaint)
        if linked_location is not None:
            return self._to_result(linked_location)

        coordinates = self._extract_coordinates(complaint)
        if coordinates is None:
            return GeoMultiplierResult(multiplier=1.0, matched_type="none", matched_name=None)

        lng, lat = coordinates
        nearby_location = await self._find_nearby_sensitive_location(lng, lat)
        if nearby_location is None:
            return GeoMultiplierResult(multiplier=1.0, matched_type="none", matched_name=None)

        return self._to_result(nearby_location)

    async def _resolve_linked_sensitive_location(self, complaint: dict[str, Any]) -> dict[str, Any] | None:
        location_id = self._extract_sensitive_location_id(complaint)
        if location_id is None:
            return None

        try:
            return await self.sensitive_locations.find_one(
                {"_id": location_id, "isActive": {"$ne": False}},
                projection={
                    "_id": 1,
                    "name": 1,
                    "type": 1,
                    "category": 1,
                    "priorityWeight": 1,
                    "radiusMeters": 1,
                    "location": 1,
                },
            )
        except Exception as exc:
            logger.warning("Linked sensitive location lookup failed: %s", exc)
            return None

    async def _find_nearby_sensitive_location(self, lng: float, lat: float) -> dict[str, Any] | None:
        if not await self._is_geo_query_supported():
            return await self._fallback_scan(lng, lat)

        query = {
            "isActive": {"$ne": False},
            "location": {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "$maxDistance": GEO_MAX_SEARCH_METERS,
                }
            },
        }

        try:
            cursor = self.sensitive_locations.find(
                query,
                projection={
                    "_id": 1,
                    "name": 1,
                    "type": 1,
                    "category": 1,
                    "priorityWeight": 1,
                    "radiusMeters": 1,
                    "location": 1,
                },
            ).limit(30)
            async for location in cursor:
                if self._within_location_radius(lng, lat, location):
                    return location
            return None
        except OperationFailure as exc:
            if getattr(exc, "code", None) == 291:
                self._geo_query_supported = False
                self._log_geo_disabled_once(exc)
                return await self._fallback_scan(lng, lat)
            logger.warning("Geo multiplier fallback due to operation error: %s", exc)
            return await self._fallback_scan(lng, lat)
        except Exception as exc:
            logger.warning("Geo multiplier fallback due to query error: %s", exc)
            return await self._fallback_scan(lng, lat)

    async def _fallback_scan(self, lng: float, lat: float) -> dict[str, Any] | None:
        cursor = self.sensitive_locations.find(
            {"isActive": {"$ne": False}},
            projection={
                "_id": 1,
                "name": 1,
                "type": 1,
                "category": 1,
                "priorityWeight": 1,
                "radiusMeters": 1,
                "location": 1,
            },
        )

        async for document in cursor:
            if self._within_location_radius(lng, lat, document):
                return document

        return None

    async def _is_geo_query_supported(self) -> bool:
        if self._geo_query_supported is not None:
            return self._geo_query_supported

        async with self._geo_support_lock:
            if self._geo_query_supported is not None:
                return self._geo_query_supported

            try:
                index_info = await self.sensitive_locations.index_information()
                self._geo_query_supported = self._has_location_geo_index(index_info)
                if not self._geo_query_supported:
                    self._log_geo_disabled_once(
                        "missing geo index on sensitive_locations.location; using fallback scan"
                    )
            except Exception as exc:
                self._geo_query_supported = False
                self._log_geo_disabled_once(f"index inspection failed ({exc}); using fallback scan")

            return self._geo_query_supported

    def _log_geo_disabled_once(self, detail: Any) -> None:
        if self._geo_warning_emitted:
            return

        self._geo_warning_emitted = True
        logger.warning("Geo multiplier geo query disabled: %s", detail)

    @staticmethod
    def _has_location_geo_index(index_info: dict[str, Any]) -> bool:
        for _, details in index_info.items():
            key_spec = details.get("key")
            if not isinstance(key_spec, list):
                continue
            for entry in key_spec:
                if not isinstance(entry, tuple) or len(entry) != 2:
                    continue
                field_name, index_type = entry
                if field_name == "location" and str(index_type) in {"2dsphere", "2d"}:
                    return True
        return False

    def _to_result(self, location: dict[str, Any]) -> GeoMultiplierResult:
        location_type = self._normalize_type(location)
        multiplier = self._compute_multiplier(location, location_type)
        location_name = str(location.get("name") or "").strip() or None
        return GeoMultiplierResult(
            multiplier=multiplier,
            matched_type=location_type or "sensitive_location",
            matched_name=location_name,
        )

    def _within_location_radius(self, lng: float, lat: float, location: dict[str, Any]) -> bool:
        coordinates = self._extract_coordinates(location)
        if coordinates is None:
            return False

        radius_meters = self._safe_radius(location.get("radiusMeters"))
        distance = self._haversine_meters(lng, lat, coordinates[0], coordinates[1])
        return distance <= radius_meters

    @staticmethod
    def _extract_coordinates(document: dict[str, Any]) -> tuple[float, float] | None:
        location = document.get("location")
        if not isinstance(location, dict):
            return None

        coordinates = location.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) != 2:
            return None

        try:
            return float(coordinates[0]), float(coordinates[1])
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _normalize_type(location: dict[str, Any]) -> str:
        raw_type = location.get("type") or location.get("category") or "other"
        normalized = str(raw_type).strip().lower().replace(" ", "_")
        return normalized or "other"

    @staticmethod
    def _safe_radius(value: Any) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return DEFAULT_RADIUS_METERS
        return max(25.0, min(10000.0, numeric))

    @staticmethod
    def _safe_priority_weight(value: Any) -> int:
        try:
            numeric = int(float(value))
        except (TypeError, ValueError):
            return 1
        return max(1, min(10, numeric))

    def _compute_multiplier(self, location: dict[str, Any], location_type: str) -> float:
        base_multiplier = TYPE_BASE_MULTIPLIER.get(location_type, TYPE_BASE_MULTIPLIER["other"])
        priority_weight = self._safe_priority_weight(location.get("priorityWeight"))
        radius = self._safe_radius(location.get("radiusMeters"))

        priority_boost = 1.0 + ((priority_weight - 1) * 0.05)
        radius_boost = 1.08 if radius <= 120 else 1.04 if radius <= 250 else 1.0
        multiplier = base_multiplier * priority_boost * radius_boost
        return round(min(2.4, max(1.0, multiplier)), 2)

    @staticmethod
    def _extract_sensitive_location_id(complaint: dict[str, Any]) -> ObjectId | None:
        raw = complaint.get("sensitiveLocation") or complaint.get("sensitiveLocationId")

        if isinstance(raw, dict):
            raw = raw.get("_id") or raw.get("id")

        if isinstance(raw, ObjectId):
            return raw

        if isinstance(raw, str):
            trimmed = raw.strip()
            if ObjectId.is_valid(trimmed):
                return ObjectId(trimmed)

        return None

    @staticmethod
    def _haversine_meters(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
        radius = 6_371_000.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        d_phi = math.radians(lat2 - lat1)
        d_lambda = math.radians(lng2 - lng1)

        value = (
            math.sin(d_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
        )
        value = min(1.0, max(0.0, value))
        return radius * (2 * math.atan2(math.sqrt(value), math.sqrt(1 - value)))
