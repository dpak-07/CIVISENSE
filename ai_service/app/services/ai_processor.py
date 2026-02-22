import logging
import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from PIL import Image
from pymongo import ReturnDocument

from app.config import Settings
from app.core.runtime import RuntimeStats
from app.db import MongoDB
from app.services.image_downloader import ImageDownloader
from app.services.mobilenet_service import MobileNetClassification, MobileNetService
from app.services.model_loader import Detection, YOLOModelService
from app.services.priority_engine import PriorityEngine, PriorityResult
from app.utils.cosine_similarity import cosine_similarity

logger = logging.getLogger(__name__)

DUPLICATE_MAX_DISTANCE_METERS = 300.0

GENERIC_TRAFFIC_TERMS = {
    "person",
    "car",
    "truck",
    "bus",
    "motorcycle",
    "bicycle",
    "scooter",
    "vehicle",
    "traffic",
    "street",
    "road",
}

SEMANTIC_PROFILES: dict[str, dict[str, set[str]]] = {
    "garbage": {
        "positive": {"garbage", "trash", "waste", "litter", "bin", "dumpster", "refuse", "landfill"},
        "negative": {"bedroom", "kitchen", "sofa", "laptop", "keyboard", "television"},
    },
    "drainage": {
        "positive": {"drain", "sewer", "gutter", "manhole", "pipe", "water", "flood", "hydrant"},
        "negative": {"bedroom", "kitchen", "sofa", "laptop", "keyboard", "television"},
    },
    "water_leak": {
        "positive": {"leak", "pipe", "water", "flood", "hydrant", "valve", "tap"},
        "negative": {"bedroom", "kitchen", "sofa", "laptop", "keyboard", "television"},
    },
    "pothole": {
        "positive": {"pothole", "road", "street", "asphalt", "pavement", "crack", "hole"},
        "negative": {"bedroom", "kitchen", "sofa", "laptop", "keyboard", "television"},
    },
    "road_damage": {
        "positive": {"road", "street", "asphalt", "pavement", "crack", "damage", "hole"},
        "negative": {"bedroom", "kitchen", "sofa", "laptop", "keyboard", "television"},
    },
    "streetlight": {
        "positive": {"traffic light", "streetlight", "street lamp", "lamp post", "lamppost"},
        "negative": {"bedroom", "kitchen", "sofa", "laptop", "keyboard", "television"},
    },
}


@dataclass(frozen=True)
class DuplicateMatch:
    is_duplicate: bool
    similarity: float
    matched_complaint_id: str | None
    matched_distance_meters: float | None
    category_match: bool | None
    method: str | None


@dataclass(frozen=True)
class ImageContext:
    embedding: list[float] | None
    image_fingerprint: str | None
    yolo_detections: list[Detection]
    mobilenet_result: MobileNetClassification | None
    semantic_category_match: bool | None
    semantic_fallback_used: bool
    semantic_note: str


class AIProcessor:
    def __init__(
        self,
        settings: Settings,
        mongodb: MongoDB,
        model_service: YOLOModelService,
        mobilenet_service: MobileNetService,
        image_downloader: ImageDownloader,
        priority_engine: PriorityEngine,
        runtime_stats: RuntimeStats,
    ) -> None:
        self.settings = settings
        self.mongodb = mongodb
        self.model_service = model_service
        self.mobilenet_service = mobilenet_service
        self.image_downloader = image_downloader
        self.priority_engine = priority_engine
        self.runtime_stats = runtime_stats

    async def process_complaint(self, complaint_id: str) -> None:
        try:
            object_id = ObjectId(complaint_id)
        except Exception:
            logger.warning("Skipping invalid complaint id: %s", complaint_id)
            return

        complaint = await self._claim_for_processing(object_id)
        if complaint is None:
            return

        try:
            base_priority = await self.priority_engine.compute(complaint)
            image_context = await self._analyze_image(complaint)
            duplicate_match = await self._check_duplicate_from_embedding(
                complaint_id=object_id,
                complaint=complaint,
                embedding=image_context.embedding,
                image_fingerprint=image_context.image_fingerprint,
            )
            final_priority = self._apply_rules(
                base_priority=base_priority,
                duplicate_match=duplicate_match,
                image_context=image_context,
            )
            ai_meta = self._build_ai_meta(duplicate_match, image_context)

            await self._mark_success(object_id, final_priority, ai_meta)
            self.runtime_stats.processed_success += 1
            self.runtime_stats.retry_attempts.pop(str(object_id), None)

            logger.info(
                "Processed complaint %s level=%s score=%.2f duplicate=%s similarity=%.4f semanticMatch=%s",
                complaint_id,
                final_priority.priority_level,
                final_priority.priority_score,
                duplicate_match.is_duplicate,
                duplicate_match.similarity,
                image_context.semantic_category_match,
            )
        except Exception as exc:
            self.runtime_stats.processed_failed += 1
            await self._mark_failed(object_id, str(exc))
            logger.exception("AI processing failed for complaint %s: %s", complaint_id, exc)

    async def _claim_for_processing(self, complaint_id: ObjectId) -> dict[str, Any] | None:
        assert self.mongodb.complaints is not None

        return await self.mongodb.complaints.find_one_and_update(
            {
                "_id": complaint_id,
                "priority.aiProcessed": False,
                "priority.aiProcessingStatus": "pending",
            },
            {"$set": {"priority.aiProcessingStatus": "processing"}},
            return_document=ReturnDocument.AFTER,
        )

    async def _analyze_image(self, complaint: dict[str, Any]) -> ImageContext:
        image_url = self._extract_image_url(complaint)
        if not image_url:
            return ImageContext(
                embedding=None,
                image_fingerprint=None,
                yolo_detections=[],
                mobilenet_result=None,
                semantic_category_match=None,
                semantic_fallback_used=False,
                semantic_note="no_image",
            )

        image = None
        embedding = None
        mobilenet_result: MobileNetClassification | None = None

        try:
            image = await self.image_downloader.download_image(image_url)
        except Exception as exc:
            logger.warning("Image download failed for complaint %s: %s", complaint.get("_id"), exc)

        if image is None:
            return ImageContext(
                embedding=None,
                image_fingerprint=None,
                yolo_detections=[],
                mobilenet_result=None,
                semantic_category_match=None,
                semantic_fallback_used=False,
                semantic_note="image_unavailable",
            )

        fingerprint = self._compute_image_fingerprint(image)

        try:
            embedding = await self.mobilenet_service.extract_embedding(image)
        except Exception as exc:
            logger.warning(
                "Embedding extraction skipped for complaint %s: %s",
                complaint.get("_id"),
                exc,
            )

        try:
            mobilenet_result = await self.mobilenet_service.classify(image)
        except Exception as exc:
            logger.warning(
                "MobileNet classification skipped for complaint %s: %s",
                complaint.get("_id"),
                exc,
            )

        try:
            detections = await self.model_service.detect(image)
        except Exception as exc:
            logger.warning(
                "YOLO validation skipped for complaint %s: %s",
                complaint.get("_id"),
                exc,
            )
            detections = []

        semantic_match, semantic_note = self._validate_category_semantics(
            complaint=complaint,
            yolo_detections=detections,
            mobilenet_result=mobilenet_result,
        )

        return ImageContext(
            embedding=embedding,
            image_fingerprint=fingerprint,
            yolo_detections=detections,
            mobilenet_result=mobilenet_result,
            semantic_category_match=semantic_match,
            semantic_fallback_used=semantic_match is False,
            semantic_note=semantic_note,
        )

    async def _check_duplicate_from_embedding(
        self,
        complaint_id: ObjectId,
        complaint: dict[str, Any],
        embedding: list[float] | None,
        image_fingerprint: str | None,
    ) -> DuplicateMatch:
        if embedding is None and image_fingerprint is None:
            return DuplicateMatch(
                is_duplicate=False,
                similarity=0.0,
                matched_complaint_id=None,
                matched_distance_meters=None,
                category_match=None,
                method=None,
            )

        assert self.mongodb.complaints is not None
        lookback_start = datetime.now(timezone.utc) - timedelta(days=self.settings.duplicate_lookback_days)
        source_category = str(complaint.get("category") or "").strip().lower()
        source_coordinates = self._extract_coordinates(complaint)
        cursor = (
            self.mongodb.complaints.find(
                {
                    "_id": {"$ne": complaint_id},
                    "createdAt": {"$gte": lookback_start},
                    "$or": [
                        {"aiMeta.imageFingerprint": {"$exists": True}},
                        {"aiMeta.embedding": {"$exists": True}},
                    ],
                },
                projection={
                    "_id": 1,
                    "aiMeta.embedding": 1,
                    "aiMeta.imageFingerprint": 1,
                    "location": 1,
                    "category": 1,
                },
            )
            .sort("createdAt", -1)
            .limit(self.settings.duplicate_compare_limit)
        )

        max_similarity = 0.0
        matched_id: str | None = None
        matched_distance_meters: float | None = None
        matched_category_ok: bool | None = None
        matched_method: str | None = None

        async for document in cursor:
            similarity = self._duplicate_similarity(
                current_embedding=embedding,
                current_fingerprint=image_fingerprint,
                other_meta=document.get("aiMeta"),
            )
            if similarity is None:
                continue

            if similarity > max_similarity:
                max_similarity = similarity
                matched_id = str(document.get("_id"))
                matched_distance_meters = self._distance_between_complaints(
                    source_coordinates=source_coordinates,
                    other_coordinates=self._extract_coordinates(document),
                )
                matched_category_ok = self._is_same_category(
                    source_category=source_category,
                    other_category=document.get("category"),
                )
                matched_method = self._duplicate_method(
                    current_embedding=embedding,
                    current_fingerprint=image_fingerprint,
                    other_meta=document.get("aiMeta"),
                )

        duplicate_from_image = max_similarity > self.settings.duplicate_similarity_threshold
        duplicate_in_same_area = (
            matched_distance_meters is not None and matched_distance_meters <= DUPLICATE_MAX_DISTANCE_METERS
        )
        duplicate_same_category = bool(matched_category_ok)
        is_duplicate = duplicate_from_image and duplicate_in_same_area and duplicate_same_category

        return DuplicateMatch(
            is_duplicate=is_duplicate,
            similarity=round(max_similarity, 6),
            matched_complaint_id=matched_id,
            matched_distance_meters=None if matched_distance_meters is None else round(matched_distance_meters, 2),
            category_match=matched_category_ok,
            method=matched_method,
        )

    @staticmethod
    def _extract_image_url(complaint: dict[str, Any]) -> str | None:
        images = complaint.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict):
                url = first.get("url")
                if isinstance(url, str) and url.strip():
                    return url.strip()
        return None

    def _apply_rules(
        self,
        base_priority: PriorityResult,
        duplicate_match: DuplicateMatch,
        image_context: ImageContext,
    ) -> PriorityResult:
        if duplicate_match.is_duplicate:
            duplicate_id = duplicate_match.matched_complaint_id or "unknown"
            duplicate_distance = (
                f"{duplicate_match.matched_distance_meters:.2f}m"
                if duplicate_match.matched_distance_meters is not None
                else "unknown distance"
            )
            duplicate_similarity = f"{duplicate_match.similarity * 100:.2f}%"
            method = duplicate_match.method or "unknown method"
            return PriorityResult(
                base_score=base_priority.base_score,
                geo_multiplier=base_priority.geo_multiplier,
                geo_context=base_priority.geo_context,
                time_score=base_priority.time_score,
                cluster_count=base_priority.cluster_count,
                cluster_boost=base_priority.cluster_boost,
                priority_score=0.0,
                priority_level="low",
                reason=(
                    "Duplicate complaint override applied: "
                    f"matched_complaint={duplicate_id}; "
                    f"similarity={duplicate_similarity}; "
                    f"distance={duplicate_distance}; "
                    f"category_match={duplicate_match.category_match}; "
                    f"method={method}"
                ),
                reason_sentence=(
                    "Priority Low because this report appears to duplicate an existing complaint "
                    f"(similarity {duplicate_similarity}, {duplicate_distance})."
                ),
            )

        reason = base_priority.reason
        reason_sentence = base_priority.reason_sentence
        if image_context.semantic_fallback_used:
            reason = f"{reason}; Image semantic mismatch fallback applied ({image_context.semantic_note})"
            reason_sentence = (
                f"{reason_sentence} Image analysis suggests a mismatch with the category."
            )

        return PriorityResult(
            base_score=base_priority.base_score,
            geo_multiplier=base_priority.geo_multiplier,
            geo_context=base_priority.geo_context,
            time_score=base_priority.time_score,
            cluster_count=base_priority.cluster_count,
            cluster_boost=base_priority.cluster_boost,
            priority_score=base_priority.priority_score,
            priority_level=base_priority.priority_level,
            reason=reason,
            reason_sentence=reason_sentence,
        )

    def _build_ai_meta(self, duplicate_match: DuplicateMatch, image_context: ImageContext) -> dict[str, Any]:
        top_yolo = sorted(image_context.yolo_detections, key=lambda d: d.confidence, reverse=True)[:3]
        mobilenet_top_labels: list[str] = []
        mobilenet_label = None
        mobilenet_confidence = None
        if image_context.mobilenet_result is not None:
            mobilenet_top_labels = list(image_context.mobilenet_result.top_labels)
            mobilenet_label = image_context.mobilenet_result.label
            mobilenet_confidence = round(image_context.mobilenet_result.confidence, 4)

        return {
            "processedAt": datetime.now(timezone.utc),
            "isAIDuplicate": duplicate_match.is_duplicate,
            "duplicateSimilarity": duplicate_match.similarity,
            "duplicateComplaintId": duplicate_match.matched_complaint_id,
            "duplicateDistanceMeters": duplicate_match.matched_distance_meters,
            "duplicateCategoryMatch": duplicate_match.category_match,
            "duplicateMethod": duplicate_match.method,
            "imageFingerprint": image_context.image_fingerprint,
            "yoloTopDetections": [
                {"label": detection.label, "confidence": round(detection.confidence, 4)}
                for detection in top_yolo
            ],
            "mobilenetTopLabel": mobilenet_label,
            "mobilenetConfidence": mobilenet_confidence,
            "mobilenetTopLabels": mobilenet_top_labels,
            "semanticCategoryMatch": image_context.semantic_category_match,
            "semanticFallbackUsed": image_context.semantic_fallback_used,
            "semanticNote": image_context.semantic_note,
            "yoloCategoryMatch": image_context.semantic_category_match,
            "yoloFallbackUsed": image_context.semantic_fallback_used,
            "yoloNote": image_context.semantic_note,
        }

    async def _mark_success(
        self,
        complaint_id: ObjectId,
        result: PriorityResult,
        ai_meta: dict[str, Any],
    ) -> None:
        assert self.mongodb.complaints is not None

        await self.mongodb.complaints.update_one(
            {"_id": complaint_id},
            {
                "$set": {
                    "severityScore": float(result.priority_score),
                    "priority.score": float(result.priority_score),
                    "priority.level": str(result.priority_level),
                    "priority.reason": str(result.reason),
                    "priority.reasonSentence": str(result.reason_sentence),
                    "priority.aiProcessed": True,
                    "priority.aiProcessingStatus": "done",
                    "aiMeta": ai_meta,
                }
            },
        )

    async def _mark_failed(self, complaint_id: ObjectId, error_message: str) -> None:
        assert self.mongodb.complaints is not None

        safe_message = error_message.strip().replace("\n", " ")[:240]
        await self.mongodb.complaints.update_one(
            {"_id": complaint_id},
            {
                "$set": {
                    "priority.reason": f"AI processing failed: {safe_message}",
                    "priority.reasonSentence": "Priority could not be computed due to an AI processing error.",
                    "priority.aiProcessed": False,
                    "priority.aiProcessingStatus": "failed",
                    "aiMeta": {
                        "processedAt": datetime.now(timezone.utc),
                        "error": safe_message,
                    },
                }
            },
        )

    def _validate_category_semantics(
        self,
        complaint: dict[str, Any],
        yolo_detections: list[Detection],
        mobilenet_result: MobileNetClassification | None,
    ) -> tuple[bool | None, str]:
        category = str(complaint.get("category") or "").strip().lower()
        profile = SEMANTIC_PROFILES.get(category)
        if profile is None:
            return None, "category_profile_missing"

        phrases: list[str] = []
        phrases.extend(
            [
                detection.label.lower()
                for detection in yolo_detections
                if detection.confidence >= self.settings.yolo_min_confidence_for_severity
            ]
        )
        if mobilenet_result is not None:
            phrases.append(mobilenet_result.label.lower())
            phrases.extend([label.lower() for label in mobilenet_result.top_labels[:3]])

        normalized_phrases = [self._normalize_phrase(phrase) for phrase in phrases if phrase]
        normalized_phrases = [phrase for phrase in normalized_phrases if phrase]
        if not normalized_phrases:
            return None, "no_semantic_signals"

        positive_hits = self._match_terms(profile["positive"], normalized_phrases)
        if positive_hits:
            return True, f"positive:{','.join(sorted(positive_hits))}"

        token_pool = self._token_pool(normalized_phrases)
        if token_pool and token_pool.issubset(GENERIC_TRAFFIC_TERMS):
            return None, f"generic_only:{','.join(sorted(token_pool))}"

        negative_hits = self._match_terms(profile["negative"], normalized_phrases)
        if negative_hits and len(normalized_phrases) >= 2:
            return False, f"negative:{','.join(sorted(negative_hits))}"

        return None, "insufficient_semantic_signal"

    @staticmethod
    def _normalize_phrase(text: str) -> str:
        cleaned = re.sub(r"[^a-z0-9\s]+", " ", text.lower())
        return " ".join(cleaned.split())

    @staticmethod
    def _match_terms(terms: set[str], phrases: list[str]) -> set[str]:
        hits: set[str] = set()
        for term in terms:
            normalized = " ".join(term.lower().split())
            for phrase in phrases:
                if normalized in phrase:
                    hits.add(term)
                    break
        return hits

    @staticmethod
    def _token_pool(phrases: list[str]) -> set[str]:
        tokens: set[str] = set()
        for phrase in phrases:
            tokens.update(phrase.split())
        return tokens

    @staticmethod
    def _is_same_category(source_category: str, other_category: Any) -> bool | None:
        other = str(other_category or "").strip().lower()
        if not source_category or not other:
            return None
        return source_category == other

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

    def _distance_between_complaints(
        self,
        source_coordinates: tuple[float, float] | None,
        other_coordinates: tuple[float, float] | None,
    ) -> float | None:
        if source_coordinates is None or other_coordinates is None:
            return None

        return self._haversine_meters(
            source_coordinates[0],
            source_coordinates[1],
            other_coordinates[0],
            other_coordinates[1],
        )

    def _compute_image_fingerprint(self, image: Image.Image) -> str:
        grayscale = image.convert("L").resize((9, 8), Image.Resampling.BILINEAR)
        pixels = list(grayscale.getdata())

        bits: list[str] = []
        for row in range(8):
            row_offset = row * 9
            for col in range(8):
                left = pixels[row_offset + col]
                right = pixels[row_offset + col + 1]
                bits.append("1" if left > right else "0")

        return f"{int(''.join(bits), 2):016x}"

    def _duplicate_similarity(
        self,
        current_embedding: list[float] | None,
        current_fingerprint: str | None,
        other_meta: Any,
    ) -> float | None:
        other = other_meta if isinstance(other_meta, dict) else {}

        other_fingerprint = other.get("imageFingerprint")
        if isinstance(current_fingerprint, str) and isinstance(other_fingerprint, str):
            return self._fingerprint_similarity(current_fingerprint, other_fingerprint)

        other_embedding = other.get("embedding")
        if current_embedding is not None and isinstance(other_embedding, list):
            return cosine_similarity(current_embedding, [float(value) for value in other_embedding])

        return None

    @staticmethod
    def _duplicate_method(
        current_embedding: list[float] | None,
        current_fingerprint: str | None,
        other_meta: Any,
    ) -> str | None:
        other = other_meta if isinstance(other_meta, dict) else {}

        other_fingerprint = other.get("imageFingerprint")
        if isinstance(current_fingerprint, str) and isinstance(other_fingerprint, str):
            return "dhash64"

        other_embedding = other.get("embedding")
        if current_embedding is not None and isinstance(other_embedding, list):
            return "mobilenet_cosine_legacy"

        return None

    @staticmethod
    def _fingerprint_similarity(left_hex: str, right_hex: str) -> float:
        try:
            left_value = int(left_hex, 16)
            right_value = int(right_hex, 16)
        except ValueError:
            return 0.0

        distance = (left_value ^ right_value).bit_count()
        return max(0.0, min(1.0, 1.0 - (distance / 64.0)))

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
