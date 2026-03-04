import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorCollection

from app.services.cluster_detector import ClusterDetector
from app.services.geo_multiplier import GeoMultiplier
from app.services.text_scoring_engine import TextScoringEngine


@dataclass(frozen=True)
class PriorityResult:
    base_score: float
    geo_multiplier: float
    geo_context: str
    time_score: float
    cluster_count: int
    cluster_boost: float
    priority_score: float
    priority_level: str
    reason: str
    reason_sentence: str


class PriorityEngine:
    def __init__(
        self,
        complaints: AsyncIOMotorCollection,
        sensitive_locations: AsyncIOMotorCollection,
    ) -> None:
        self.text_engine = TextScoringEngine()
        self.geo_multiplier = GeoMultiplier(sensitive_locations)
        self.cluster_detector = ClusterDetector(complaints)

    async def compute(self, complaint: dict[str, Any]) -> PriorityResult:
        title = complaint.get("title")
        description = complaint.get("description")

        text_result = self.text_engine.score(
            title=title if isinstance(title, str) else "",
            description=description if isinstance(description, str) else "",
        )
        geo_result = await self.geo_multiplier.resolve(complaint)
        cluster_result = await self.cluster_detector.detect(complaint)
        time_score = self._time_score(complaint.get("createdAt"))

        final_score = round(
            (text_result.base_score * geo_result.multiplier) + time_score + cluster_result.cluster_boost,
            2,
        )
        level = self._map_level(final_score)

        reason = (
            "Priority computation details: "
            f"text_base={text_result.base_score:.2f} "
            f"[high={text_result.high_count} ({self._format_keywords(text_result.matched_high)}), "
            f"medium={text_result.medium_count} ({self._format_keywords(text_result.matched_medium)}), "
            f"normal={text_result.normal_count} ({self._format_keywords(text_result.matched_normal)})]; "
            f"geo_multiplier={geo_result.multiplier:.2f} (context={geo_result.matched_type}); "
            f"time_boost={time_score:.2f}; "
            f"cluster_boost={cluster_result.cluster_boost:.2f} (nearby_reports={cluster_result.nearby_count}); "
            f"final_score={final_score:.2f}; level={level.upper()}"
        )

        reason_sentence = self._build_reason_sentence(
            level=level,
            text_result=text_result,
            geo_result=geo_result,
            cluster_count=cluster_result.nearby_count,
            time_score=time_score,
        )

        return PriorityResult(
            base_score=text_result.base_score,
            geo_multiplier=geo_result.multiplier,
            geo_context=geo_result.matched_type,
            time_score=time_score,
            cluster_count=cluster_result.nearby_count,
            cluster_boost=cluster_result.cluster_boost,
            priority_score=final_score,
            priority_level=level,
            reason=reason,
            reason_sentence=reason_sentence,
        )

    def _time_score(self, created_at: Any) -> float:
        parsed = self._parse_datetime(created_at)
        if parsed is None:
            return 0.0

        now = datetime.now(timezone.utc)
        elapsed_seconds = max(0.0, (now - parsed).total_seconds())
        days_pending = elapsed_seconds / 86_400.0
        score = math.log(days_pending + 1.0) * 2.0
        return round(min(3.0, score), 2)

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc)

        if isinstance(value, str):
            text = value.strip().replace("Z", "+00:00")
            if not text:
                return None

            try:
                parsed = datetime.fromisoformat(text)
            except ValueError:
                return None

            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)

        return None

    @staticmethod
    def _map_level(score: float) -> str:
        if score < 3.0:
            return "low"
        if score <= 6.0:
            return "medium"
        return "high"

    @staticmethod
    def _build_reason_sentence(
        level: str,
        text_result: Any,
        geo_result: Any,
        cluster_count: int,
        time_score: float,
    ) -> str:
        level_label = level.capitalize()

        if getattr(text_result, "high_count", 0) > 0:
            text_phrase = "urgent wording was detected"
        elif getattr(text_result, "medium_count", 0) > 0:
            text_phrase = "moderate severity wording was detected"
        elif getattr(text_result, "normal_count", 0) > 0:
            text_phrase = "issue keywords were detected"
        else:
            text_phrase = "no strong severity keywords were detected"

        matched_type = getattr(geo_result, "matched_type", "none")
        matched_name = getattr(geo_result, "matched_name", None)
        if matched_type and matched_type != "none":
            if isinstance(matched_name, str) and matched_name.strip():
                geo_phrase = f"it is near sensitive location {matched_name.strip()} ({matched_type})"
            else:
                geo_phrase = f"it is near a {matched_type}"
        else:
            geo_phrase = "it is not near a sensitive location"

        if cluster_count >= 3:
            cluster_phrase = f"there are {cluster_count} similar reports nearby"
        elif cluster_count > 0:
            cluster_phrase = f"there is {cluster_count} similar report nearby"
        else:
            cluster_phrase = "there are no nearby similar reports"

        time_phrase = "it has been pending for a while" if time_score >= 1.5 else "it is recent"

        return (
            f"Priority {level_label} because {text_phrase}, {geo_phrase}, "
            f"{cluster_phrase}, and {time_phrase}. "
            f"Computed score components include text severity, geo sensitivity multiplier, "
            f"time aging boost, and nearby cluster impact."
        )

    @staticmethod
    def _format_keywords(keywords: list[str]) -> str:
        if not keywords:
            return "none"
        return ", ".join(sorted(set(keywords)))
