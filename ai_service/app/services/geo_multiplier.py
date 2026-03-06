import asyncio
import logging
import math
import re
from dataclasses import dataclass
from typing import Any

from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo.errors import OperationFailure

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GeoMultiplierResult:
    multiplier: float
    matched_type: str
    matched_name: str | None
    matched_distance_meters: float | None
    matched_keyword: str | None


@dataclass(frozen=True)
class GeoRule:
    location_type: str
    multiplier: float
    keywords: list[str]
    radius_meters: int


class GeoMultiplier:
    def __init__(self, sensitive_locations: AsyncIOMotorCollection, settings: Settings) -> None:
        self.settings = settings
        self.sensitive_locations = sensitive_locations
        self._rules: list[GeoRule] = [
            GeoRule(
                location_type="school",
                multiplier=1.6,
                keywords=[
                    "school",
                    "higher secondary",
                    "secondary school",
                    "public school",
                    "matriculation",
                    "vidyalaya",
                    "academy",
                    "college",
                    "university",
                    "institute",
                ],
                radius_meters=max(100, int(self.settings.school_radius_meters)),
            ),
            GeoRule(
                location_type="hospital",
                multiplier=1.45,
                keywords=["hospital", "clinic", "medical", "health", "trauma"],
                radius_meters=max(100, int(self.settings.hospital_radius_meters)),
            ),
            GeoRule(
                location_type="metro",
                multiplier=1.25,
                keywords=["metro", "subway", "station", "railway", "bus stand"],
                radius_meters=max(100, int(self.settings.transit_radius_meters)),
            ),
            GeoRule(
                location_type="government",
                multiplier=1.2,
                keywords=["government", "collectorate", "secretariat", "court", "office", "police"],
                radius_meters=max(100, int(self.settings.government_radius_meters)),
            ),
        ]
        self._geo_query_supported: bool | None = None
        self._geo_support_lock = asyncio.Lock()
        self._geo_warning_emitted = False

    async def resolve(self, complaint: dict[str, Any]) -> GeoMultiplierResult:
        coordinates = self._extract_coordinates(complaint)
        if coordinates is None:
            return GeoMultiplierResult(
                multiplier=1.0,
                matched_type="none",
                matched_name=None,
                matched_distance_meters=None,
                matched_keyword=None,
            )

        lng, lat = coordinates
        for rule in self._rules:
            match = await self._find_near_location_match(lng, lat, rule)
            if match is None:
                continue
            return GeoMultiplierResult(
                multiplier=rule.multiplier,
                matched_type=rule.location_type,
                matched_name=match.get("name"),
                matched_distance_meters=match.get("distance_meters"),
                matched_keyword=match.get("keyword"),
            )

        return GeoMultiplierResult(
            multiplier=1.0,
            matched_type="none",
            matched_name=None,
            matched_distance_meters=None,
            matched_keyword=None,
        )

    async def _find_near_location_match(
        self,
        lng: float,
        lat: float,
        rule: GeoRule,
    ) -> dict[str, Any] | None:
        if not await self._is_geo_query_supported():
            return await self._fallback_scan(lng, lat, rule)

        conditions: list[dict[str, Any]] = []
        for keyword in rule.keywords:
            escaped = re.escape(keyword)
            conditions.extend(
                [
                    {"type": {"$regex": escaped, "$options": "i"}},
                    {"name": {"$regex": escaped, "$options": "i"}},
                    {"category": {"$regex": escaped, "$options": "i"}},
                ]
            )

        query = {
            "location": {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "$maxDistance": int(rule.radius_meters),
                }
            },
            "$or": conditions,
        }

        try:
            match = await self.sensitive_locations.find_one(
                query,
                projection={"_id": 1, "name": 1, "type": 1, "category": 1, "location": 1},
            )
            if match is None:
                return None
            distance_meters = self._distance_for_document(lng, lat, match)
            keyword = self._extract_best_keyword(match, rule.keywords)
            return {
                "name": match.get("name"),
                "distance_meters": distance_meters,
                "keyword": keyword,
            }
        except OperationFailure as exc:
            if getattr(exc, "code", None) == 291:
                self._geo_query_supported = False
                self._log_geo_disabled_once(exc)
                return await self._fallback_scan(lng, lat, rule)
            logger.warning("Geo multiplier fallback due to operation error: %s", exc)
            return await self._fallback_scan(lng, lat, rule)
        except Exception as exc:
            logger.warning("Geo multiplier fallback due to query error: %s", exc)
            return await self._fallback_scan(lng, lat, rule)

    async def _fallback_scan(self, lng: float, lat: float, rule: GeoRule) -> dict[str, Any] | None:
        cursor = self.sensitive_locations.find(
            {},
            projection={"location": 1, "type": 1, "name": 1, "category": 1},
        )

        best_match: dict[str, Any] | None = None
        best_distance = float("inf")

        async for document in cursor:
            if not self._matches_keywords(document, rule.keywords):
                continue

            coordinates = self._extract_coordinates(document)
            if coordinates is None:
                continue

            distance = self._haversine_meters(lng, lat, coordinates[0], coordinates[1])
            if distance > int(rule.radius_meters):
                continue

            if distance < best_distance:
                best_distance = distance
                best_match = {
                    "name": document.get("name"),
                    "distance_meters": round(distance, 1),
                    "keyword": self._extract_best_keyword(document, rule.keywords),
                }

        return best_match

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
    def _matches_keywords(document: dict[str, Any], keywords: list[str]) -> bool:
        text_parts = []
        for field in ("type", "name", "category"):
            value = document.get(field)
            if isinstance(value, str):
                text_parts.append(value.lower())

        if not text_parts:
            return False

        joined = " ".join(text_parts)
        return any(keyword in joined for keyword in keywords)

    def _distance_for_document(self, source_lng: float, source_lat: float, document: dict[str, Any]) -> float | None:
        coordinates = self._extract_coordinates(document)
        if coordinates is None:
            return None
        return round(self._haversine_meters(source_lng, source_lat, coordinates[0], coordinates[1]), 1)

    @staticmethod
    def _extract_best_keyword(document: dict[str, Any], keywords: list[str]) -> str | None:
        text_parts = []
        for field in ("type", "name", "category"):
            value = document.get(field)
            if isinstance(value, str):
                text_parts.append(value.lower())
        joined = " ".join(text_parts)
        for keyword in keywords:
            if keyword.lower() in joined:
                return keyword
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
