import asyncio
import io
import logging
import math
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from PIL import Image, ImageDraw, ImageFont
from pymongo import ReturnDocument

from app.config import Settings
from app.core.runtime import RuntimeStats
from app.db import MongoDB
from app.services.ai_service import ComplaintImageValidationService
from app.services.image_downloader import ImageDownloader
from app.services.mobilenet_service import MobileNetClassification, MobileNetService
from app.services.model_loader import Detection, YOLOModelService
from app.services.priority_engine import PriorityEngine, PriorityResult
from app.services.priority_reasoning_service import PriorityReasoningService
from app.services.s3_uploader import S3Uploader
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

SCENE_SUMMARY_COLOR_TERMS = {
    "pink",
    "green",
    "blue",
    "red",
    "white",
    "black",
    "brown",
    "yellow",
    "orange",
    "purple",
    "grey",
    "gray",
}

NON_CIVIC_REVIEW_TERMS = {
    "laptop",
    "laptops",
    "computer",
    "monitor",
    "keyboard",
    "chair",
    "table",
    "desk",
    "room",
    "bathroom",
    "kitchen",
    "sofa",
    "bed",
    "stove",
    "screen",
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
    "traffic_sign": {
        "positive": {
            "traffic sign",
            "road sign",
            "signboard",
            "sign board",
            "signal pole",
            "warning sign",
            "stop sign",
        },
        "negative": {"bedroom", "kitchen", "sofa", "laptop", "keyboard", "television"},
    },
}

ANNOTATION_COLORS: list[tuple[int, int, int]] = [
    (37, 99, 235),
    (2, 132, 199),
    (5, 150, 105),
    (217, 119, 6),
    (220, 38, 38),
    (124, 58, 237),
]

MODEL_LABEL_HINTS: dict[str, set[str]] = {
    "garbage": {
        "garbage",
        "trash",
        "waste",
        "litter",
        "plastic bag",
        "garbage bag",
        "toilet tissue",
        "diaper",
        "dumpster",
        "rubbish",
        "bin",
    },
    "drainage": {
        "drain",
        "sewer",
        "manhole",
        "gutter",
        "drainage",
    },
    "water_leak": {
        "water leak",
        "leak",
        "leaking",
        "pipe",
        "hose",
        "tap",
        "faucet",
        "water",
        "spill",
    },
    "streetlight": {
        "streetlight",
        "street lamp",
        "lamp post",
        "lamppost",
        "traffic light",
    },
    "traffic_sign": {
        "traffic sign",
        "road sign",
        "signboard",
        "sign board",
        "warning sign",
        "stop sign",
        "signal post",
        "traffic pole",
    },
    "pothole": {
        "pothole",
        "road hole",
        "asphalt crack",
        "pavement hole",
    },
    "road_damage": {
        "road damage",
        "damaged road",
        "broken asphalt",
        "road crack",
        "asphalt",
    },
}

RELATED_CATEGORY_GROUPS: tuple[set[str], ...] = (
    {"pothole", "road_damage"},
    {"drainage", "water_leak"},
    {"streetlight", "traffic_sign"},
)

IMAGE_ISSUE_PRIORITY_WEIGHTS: dict[str, float] = {
    "pothole": 0.9,
    "garbage": 0.6,
    "drainage": 1.0,
    "water_leak": 1.0,
    "streetlight": 0.7,
    "road_damage": 0.9,
    "traffic_sign": 0.75,
}

IMAGE_SCORE_MULTIPLIER = 2.8
IMAGE_SCORE_MAX = 3.0
IMAGE_ALIGNMENT_MATCH_BONUS = 0.25
IMAGE_ALIGNMENT_HIGH_CONF_MISMATCH_PENALTY = -0.45
IMAGE_ALIGNMENT_LOW_CONF_MISMATCH_PENALTY = -0.15
IMAGE_MISMATCH_SIGNAL_FACTOR = 0.35
IMAGE_MISMATCH_SIGNAL_MAX = 1.2
IMAGE_MISMATCH_NON_CIVIC_THRESHOLD = 0.35


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
    source_image: Image.Image | None
    embedding: list[float] | None
    image_fingerprint: str | None
    yolo_detections: list[Detection]
    mobilenet_result: MobileNetClassification | None
    category_validation: dict[str, Any] | None
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
        image_validation_service: ComplaintImageValidationService,
        priority_reasoning_service: PriorityReasoningService | None,
        image_downloader: ImageDownloader,
        priority_engine: PriorityEngine,
        s3_uploader: S3Uploader,
        runtime_stats: RuntimeStats,
    ) -> None:
        self.settings = settings
        self.mongodb = mongodb
        self.model_service = model_service
        self.mobilenet_service = mobilenet_service
        self.image_validation_service = image_validation_service
        self.priority_reasoning_service = priority_reasoning_service
        self.image_downloader = image_downloader
        self.priority_engine = priority_engine
        self.s3_uploader = s3_uploader
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
            final_priority, image_priority_meta = self._apply_rules(
                base_priority=base_priority,
                duplicate_match=duplicate_match,
                image_context=image_context,
            )
            ai_output_meta = await self._create_and_store_ai_output_image(
                complaint=complaint,
                priority_result=final_priority,
                duplicate_match=duplicate_match,
                image_context=image_context,
            )
            ai_meta = self._build_ai_meta(
                duplicate_match=duplicate_match,
                image_context=image_context,
                ai_output_meta=ai_output_meta,
                base_priority=base_priority,
                final_priority=final_priority,
                image_priority_meta=image_priority_meta,
            )

            await self._mark_success(object_id, final_priority, ai_meta)
            self.runtime_stats.processed_success += 1
            self.runtime_stats.retry_attempts.pop(str(object_id), None)

            logger.info(
                (
                    "Processed complaint %s level=%s score=%.2f duplicate=%s similarity=%.4f "
                    "semanticMatch=%s categoryValid=%s categoryConfidence=%.4f imageScore=%.2f"
                ),
                complaint_id,
                final_priority.priority_level,
                final_priority.priority_score,
                duplicate_match.is_duplicate,
                duplicate_match.similarity,
                image_context.semantic_category_match,
                (image_context.category_validation or {}).get("is_valid"),
                float((image_context.category_validation or {}).get("confidence") or 0.0),
                float(image_priority_meta.get("imageScoreApplied") or 0.0),
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
        reported_category = str(complaint.get("category") or "").strip().lower()

        if not image_url:
            return ImageContext(
                source_image=None,
                embedding=None,
                image_fingerprint=None,
                yolo_detections=[],
                mobilenet_result=None,
                category_validation={
                    "detected_issue": "unknown",
                    "reported_category": reported_category,
                    "is_valid": False,
                    "confidence": 0.0,
                    "reason": "No image was attached to this complaint.",
                    "caption": None,
                    "keyword_hits": [],
                    "status": "skipped",
                },
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
                source_image=None,
                embedding=None,
                image_fingerprint=None,
                yolo_detections=[],
                mobilenet_result=None,
                category_validation={
                    "detected_issue": "unknown",
                    "reported_category": reported_category,
                    "is_valid": False,
                    "confidence": 0.0,
                    "reason": "Complaint image could not be downloaded for AI validation.",
                    "caption": None,
                    "keyword_hits": [],
                    "status": "failed",
                },
                semantic_category_match=None,
                semantic_fallback_used=False,
                semantic_note="image_unavailable",
            )

        category_validation = await self.image_validation_service.validate_pil_image_category(
            image=image,
            reported_category=reported_category,
            source=image_url,
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

        category_validation = self._refine_category_validation_with_model_signals(
            complaint=complaint,
            category_validation=category_validation,
            yolo_detections=detections,
            mobilenet_result=mobilenet_result,
        )

        semantic_match, semantic_note = self._validate_category_semantics(
            complaint=complaint,
            yolo_detections=detections,
            mobilenet_result=mobilenet_result,
        )

        return ImageContext(
            source_image=image,
            embedding=embedding,
            image_fingerprint=fingerprint,
            yolo_detections=detections,
            mobilenet_result=mobilenet_result,
            category_validation=category_validation,
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

    def _refine_category_validation_with_model_signals(
        self,
        complaint: dict[str, Any],
        category_validation: dict[str, Any] | None,
        yolo_detections: list[Detection],
        mobilenet_result: MobileNetClassification | None,
    ) -> dict[str, Any] | None:
        if not isinstance(category_validation, dict):
            return category_validation

        status = str(category_validation.get("status") or "").strip().lower()
        if status != "ok":
            return category_validation

        detected_issue = self._normalize_category_token(category_validation.get("detected_issue"))
        current_confidence = float(category_validation.get("confidence") or 0.0)

        # Keep the caption-first result when it already produced a category.
        if detected_issue and detected_issue != "unknown" and current_confidence > 0.0:
            return category_validation

        label_candidates: list[tuple[str, float]] = []
        if mobilenet_result is not None:
            label_candidates.append((self._normalize_phrase(mobilenet_result.label), 1.0))
            for label in mobilenet_result.top_labels[:5]:
                label_candidates.append((self._normalize_phrase(label), 0.65))

        for detection in yolo_detections:
            if detection.confidence < self.settings.yolo_min_confidence_for_severity:
                continue
            label_candidates.append(
                (
                    self._normalize_phrase(detection.label),
                    0.6 + min(0.4, float(detection.confidence)),
                )
            )

        if not label_candidates:
            return category_validation

        score_by_category: dict[str, float] = {category: 0.0 for category in MODEL_LABEL_HINTS.keys()}
        hits_by_category: dict[str, set[str]] = {category: set() for category in MODEL_LABEL_HINTS.keys()}

        for normalized_label, weight in label_candidates:
            if not normalized_label:
                continue
            for category, hints in MODEL_LABEL_HINTS.items():
                for hint in hints:
                    normalized_hint = self._normalize_phrase(hint)
                    if not normalized_hint:
                        continue
                    if normalized_hint in normalized_label:
                        score_by_category[category] += weight
                        hits_by_category[category].add(hint)

        best_category = "unknown"
        best_score = 0.0
        for category, score in score_by_category.items():
            if score > best_score:
                best_category = category
                best_score = score

        if best_category == "unknown" or best_score < 1.1:
            return category_validation

        fallback_confidence = round(min(0.88, 0.42 + (best_score * 0.12)), 4)
        reported_category = self._normalize_category_token(complaint.get("category"))
        match_type = self._determine_category_match_type(best_category, reported_category)
        is_valid = match_type in {"exact", "related"}
        hits = sorted(hits_by_category.get(best_category, set()))

        if match_type == "exact":
            reason = (
                "The detected issue matches the reported category. "
                f"Fallback used model label signals ({', '.join(hits) if hits else 'none'})."
            )
        elif match_type == "related":
            reason = (
                f"The detected issue '{best_category}' is closely related to the reported category "
                f"'{reported_category or 'unknown'}'. Fallback used model label signals "
                f"({', '.join(hits) if hits else 'none'})."
            )
        else:
            reason = (
                f"The image label signals suggest '{best_category}' while the complaint was reported as "
                f"'{reported_category or 'unknown'}'."
            )

        enriched = dict(category_validation)
        enriched.update(
            {
                "detected_issue": best_category,
                "reported_category": reported_category,
                "is_valid": is_valid,
                "match_type": match_type,
                "confidence": max(current_confidence, fallback_confidence),
                "reason": reason,
                "keyword_hits": hits,
                "fallback_source": "mobilenet_yolo_labels",
            }
        )
        return enriched

    def _apply_rules(
        self,
        base_priority: PriorityResult,
        duplicate_match: DuplicateMatch,
        image_context: ImageContext,
    ) -> tuple[PriorityResult, dict[str, Any]]:
        if duplicate_match.is_duplicate:
            duplicate_id = duplicate_match.matched_complaint_id or "unknown"
            duplicate_distance = (
                f"{duplicate_match.matched_distance_meters:.2f}m"
                if duplicate_match.matched_distance_meters is not None
                else "unknown distance"
            )
            duplicate_similarity = f"{duplicate_match.similarity * 100:.2f}%"
            method = duplicate_match.method or "unknown method"
            result = PriorityResult(
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
            return result, {
                "imageScoreApplied": 0.0,
                "issueScore": 0.0,
                "alignmentAdjustment": 0.0,
                "detectedIssue": (image_context.category_validation or {}).get("detected_issue"),
                "reportedCategory": (image_context.category_validation or {}).get("reported_category"),
                "validationConfidence": float((image_context.category_validation or {}).get("confidence") or 0.0),
                "isCategoryValid": (image_context.category_validation or {}).get("is_valid"),
                "source": "duplicate_override",
                "note": "Duplicate complaint override forced low priority",
            }

        reason = base_priority.reason
        reason_sentence = base_priority.reason_sentence
        if image_context.semantic_fallback_used:
            reason = f"{reason}; Image semantic mismatch fallback applied ({image_context.semantic_note})"
            reason_sentence = (
                f"{reason_sentence} Image analysis suggests a mismatch with the category."
            )

        category_validation = image_context.category_validation or {}
        image_priority_meta = self._compute_image_priority_score(
            base_priority=base_priority,
            category_validation=category_validation,
        )
        image_score_applied = float(image_priority_meta.get("imageScoreApplied") or 0.0)

        validation_status = str(category_validation.get("status") or "").lower()
        validation_is_valid = category_validation.get("is_valid")
        match_type = str(category_validation.get("match_type") or "").strip().lower()
        detected_issue = str(category_validation.get("detected_issue") or "unknown")
        reported_category = str(category_validation.get("reported_category") or "unknown")
        confidence = float(category_validation.get("confidence") or 0.0)
        clip_non_civic_score = float(category_validation.get("clip_non_civic_score") or 0.0)
        scene_summary = self._build_scene_summary(image_context=image_context, category_validation=category_validation)
        manual_review_required = (
            validation_status == "unsupported_category"
            or (
                validation_status == "ok"
                and validation_is_valid is False
                and match_type != "related"
                and (
                    confidence >= float(self.settings.category_validation_review_confidence)
                    or (
                        detected_issue == "unknown"
                        and (
                            clip_non_civic_score >= 0.45
                            or self._scene_summary_requires_manual_review(scene_summary)
                        )
                    )
                )
            )
        )

        if validation_status == "unsupported_category":
            reason = (
                f"{reason}; AI category validation skipped because reported category is unsupported "
                f"(reported_category={reported_category})"
            )
            reason_sentence = (
                f"{reason_sentence} AI image validation skipped because '{reported_category.replace('_', ' ')}' "
                "is not in the supported AI categories."
            )
        elif validation_status == "ok" and validation_is_valid is False:
            if detected_issue == "unknown" and clip_non_civic_score >= 0.75:
                reason = (
                    f"{reason}; non-civic image likely uploaded "
                    f"(detected_issue={detected_issue}; reported_category={reported_category}; "
                    f"non_civic_score={clip_non_civic_score:.2f})"
                )
                reason_sentence = (
                    f"{reason_sentence} Uploaded image appears unrelated to a civic issue "
                    f"(non-civic score {clip_non_civic_score:.2f}), so image evidence was ignored."
                )
                if manual_review_required:
                    reason_sentence = f"{reason_sentence} This complaint was flagged for manual review."
            elif confidence >= float(self.settings.category_validation_review_confidence):
                reason = (
                    f"{reason}; image does not match reported issue "
                    f"(detected_issue={detected_issue}; reported_category={reported_category}; confidence={confidence:.2f})"
                )
                reason_sentence = (
                    f"{reason_sentence} AI image validation indicates '{detected_issue.replace('_', ' ')}' "
                    f"instead of '{reported_category.replace('_', ' ')}'."
                )
                if manual_review_required:
                    reason_sentence = f"{reason_sentence} This complaint was flagged for manual review."
            else:
                reason = (
                    f"{reason}; possible category mismatch detected "
                    f"(detected_issue={detected_issue}; reported_category={reported_category}; confidence={confidence:.2f})"
                )
                reason_sentence = (
                    f"{reason_sentence} AI image validation suggests a possible category mismatch "
                    f"with low confidence ({confidence:.2f})."
                )
        elif validation_status == "failed":
            reason = f"{reason}; Image category validation failed"
            reason_sentence = f"{reason_sentence} AI image validation could not complete."
        elif validation_status == "ok" and validation_is_valid is True and match_type == "related":
            reason = (
                f"{reason}; related category match "
                f"(detected_issue={detected_issue}; reported_category={reported_category}; confidence={confidence:.2f})"
            )
            reason_sentence = (
                f"{reason_sentence} AI image validation found a related issue category "
                f"('{detected_issue.replace('_', ' ')}' vs '{reported_category.replace('_', ' ')}')."
            )

        final_score = round(max(0.0, min(10.0, base_priority.priority_score + image_score_applied)), 2)
        final_level = self._map_priority_level(final_score)
        reason = (
            f"{reason}; image_score={image_score_applied:+.2f} "
            f"(issue_score={float(image_priority_meta.get('issueScore') or 0.0):.2f}; "
            f"alignment_adjustment={float(image_priority_meta.get('alignmentAdjustment') or 0.0):+.2f}; "
            f"detected_issue={image_priority_meta.get('detectedIssue') or 'unknown'}; "
            f"reported_category={image_priority_meta.get('reportedCategory') or 'unknown'}; "
            f"validation_confidence={float(image_priority_meta.get('validationConfidence') or 0.0):.2f}); "
            f"final_with_image={final_score:.2f}; level={final_level.upper()}"
        )
        reason_sentence = (
            f"{reason_sentence} Image evidence contributed {image_score_applied:+.2f} to priority "
            f"(issue score {float(image_priority_meta.get('issueScore') or 0.0):.2f}, "
            f"alignment adjustment {float(image_priority_meta.get('alignmentAdjustment') or 0.0):+.2f}), "
            f"resulting in final score {final_score:.2f} ({final_level.upper()})."
        )

        if self.priority_reasoning_service is not None:
            try:
                reason_sentence = self.priority_reasoning_service.generate_reason(
                    category=str(category_validation.get("reported_category") or "unknown"),
                    detected_issue=str(category_validation.get("detected_issue") or "unknown"),
                    match_type=match_type or "mismatch",
                    confidence=float(category_validation.get("confidence") or 0.0),
                    validation_status=validation_status or "unknown",
                    non_civic_score=float(category_validation.get("clip_non_civic_score") or 0.0),
                    manual_review_required=manual_review_required,
                    scene_summary=scene_summary,
                    base_score=float(base_priority.priority_score),
                    image_score=float(image_score_applied),
                    final_score=float(final_score),
                    final_level=str(final_level),
                )
            except Exception as exc:
                logger.warning("Priority NLP reason generation failed in AIProcessor: %s", exc)

        result = PriorityResult(
            base_score=base_priority.base_score,
            geo_multiplier=base_priority.geo_multiplier,
            geo_context=base_priority.geo_context,
            time_score=base_priority.time_score,
            cluster_count=base_priority.cluster_count,
            cluster_boost=base_priority.cluster_boost,
            priority_score=final_score,
            priority_level=final_level,
            reason=reason,
            reason_sentence=reason_sentence,
        )
        return result, image_priority_meta

    def _compute_image_priority_score(
        self,
        base_priority: PriorityResult,
        category_validation: dict[str, Any],
    ) -> dict[str, Any]:
        status = str(category_validation.get("status") or "").strip().lower()
        detected_issue = self._normalize_category_token(category_validation.get("detected_issue"))
        reported_category = self._normalize_category_token(category_validation.get("reported_category"))
        validation_confidence = float(category_validation.get("confidence") or 0.0)
        non_civic_score = float(category_validation.get("clip_non_civic_score") or 0.0)
        is_category_valid = category_validation.get("is_valid")
        match_type = str(category_validation.get("match_type") or "").strip().lower()

        if status != "ok" or not detected_issue or detected_issue == "unknown":
            if status == "unsupported_category":
                note = "Image score not applied because the reported category is unsupported by AI validation"
            else:
                note = "Image score not applied due to missing/unknown image category signals"
            return {
                "imageScoreApplied": 0.0,
                "issueScore": 0.0,
                "alignmentAdjustment": 0.0,
                "detectedIssue": detected_issue or "unknown",
                "reportedCategory": reported_category or "unknown",
                "validationConfidence": validation_confidence,
                "nonCivicScore": round(non_civic_score, 4),
                "isCategoryValid": is_category_valid,
                "matchType": match_type or "mismatch",
                "basePriorityScore": float(base_priority.priority_score),
                "note": note,
            }

        issue_weight = float(IMAGE_ISSUE_PRIORITY_WEIGHTS.get(detected_issue, 0.6))
        if match_type == "exact":
            issue_score = min(IMAGE_SCORE_MAX, validation_confidence * issue_weight * IMAGE_SCORE_MULTIPLIER)
            alignment_adjustment = IMAGE_ALIGNMENT_MATCH_BONUS
        elif match_type == "related":
            issue_score = min(
                IMAGE_SCORE_MAX,
                validation_confidence * issue_weight * IMAGE_SCORE_MULTIPLIER * 0.75,
            )
            alignment_adjustment = round(IMAGE_ALIGNMENT_MATCH_BONUS * 0.4, 2)
        else:
            if validation_confidence < float(self.settings.category_validation_review_confidence):
                return {
                    "imageScoreApplied": 0.0,
                    "issueScore": 0.0,
                    "alignmentAdjustment": 0.0,
                    "issueWeight": issue_weight,
                    "detectedIssue": detected_issue,
                    "reportedCategory": reported_category or "unknown",
                    "validationConfidence": round(validation_confidence, 4),
                    "nonCivicScore": round(non_civic_score, 4),
                    "isCategoryValid": is_category_valid,
                    "matchType": match_type or "mismatch",
                    "basePriorityScore": float(base_priority.priority_score),
                    "note": "Low-confidence mismatch: image score not applied",
                }

            if non_civic_score >= IMAGE_MISMATCH_NON_CIVIC_THRESHOLD:
                issue_score = 0.0
            else:
                issue_score = min(
                    IMAGE_MISMATCH_SIGNAL_MAX,
                    validation_confidence * issue_weight * IMAGE_SCORE_MULTIPLIER * IMAGE_MISMATCH_SIGNAL_FACTOR,
                )
            alignment_adjustment = IMAGE_ALIGNMENT_HIGH_CONF_MISMATCH_PENALTY

        image_score_applied = round(max(0.0, issue_score + alignment_adjustment), 2)
        return {
            "imageScoreApplied": image_score_applied,
            "issueScore": round(issue_score, 2),
            "alignmentAdjustment": round(alignment_adjustment, 2),
            "issueWeight": issue_weight,
            "detectedIssue": detected_issue,
            "reportedCategory": reported_category or "unknown",
            "validationConfidence": round(validation_confidence, 4),
            "nonCivicScore": round(non_civic_score, 4),
            "isCategoryValid": is_category_valid,
            "matchType": match_type or "mismatch",
            "basePriorityScore": float(base_priority.priority_score),
            "note": "Image score contribution calibrated using detected issue, confidence, mismatch penalty, and non-civic guard",
        }

    @staticmethod
    def _map_priority_level(score: float) -> str:
        if score < 3.0:
            return "low"
        if score <= 6.0:
            return "medium"
        return "high"

    def _build_ai_meta(
        self,
        duplicate_match: DuplicateMatch,
        image_context: ImageContext,
        ai_output_meta: dict[str, Any],
        base_priority: PriorityResult,
        final_priority: PriorityResult,
        image_priority_meta: dict[str, Any],
    ) -> dict[str, Any]:
        top_yolo = sorted(image_context.yolo_detections, key=lambda d: d.confidence, reverse=True)[:3]
        mobilenet_top_labels: list[str] = []
        mobilenet_label = None
        mobilenet_confidence = None
        if image_context.mobilenet_result is not None:
            mobilenet_top_labels = list(image_context.mobilenet_result.top_labels)
            mobilenet_label = image_context.mobilenet_result.label
            mobilenet_confidence = round(image_context.mobilenet_result.confidence, 4)

        category_validation = image_context.category_validation or {}
        validation_status = str(category_validation.get("status") or "").lower()
        match_type = str(category_validation.get("match_type") or "").lower()
        validation_confidence = float(category_validation.get("confidence") or 0.0)
        non_civic_score = float(category_validation.get("clip_non_civic_score") or 0.0)
        detected_issue = self._normalize_category_token(category_validation.get("detected_issue"))
        scene_summary = self._build_scene_summary(
            image_context=image_context,
            category_validation=category_validation,
        )
        review_required = (
            (
                validation_status == "ok"
                and category_validation.get("is_valid") is False
                and match_type != "related"
                and (
                    validation_confidence >= float(self.settings.category_validation_review_confidence)
                    or (
                        detected_issue == "unknown"
                        and (
                            non_civic_score >= 0.45
                            or self._scene_summary_requires_manual_review(scene_summary)
                        )
                    )
                )
            )
            or validation_status == "unsupported_category"
        )

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
            "categoryValidation": category_validation,
            "detectedIssue": category_validation.get("detected_issue"),
            "reportedCategory": category_validation.get("reported_category"),
            "isCategoryValid": category_validation.get("is_valid"),
            "categoryValidationMatchType": category_validation.get("match_type"),
            "categoryValidationConfidence": category_validation.get("confidence"),
            "categoryValidationReason": category_validation.get("reason"),
            "categoryValidationStatus": category_validation.get("status"),
            "categoryCaption": category_validation.get("caption"),
            "categoryValidationClipTopIssue": category_validation.get("clip_top_issue"),
            "categoryValidationClipTopConfidence": category_validation.get("clip_top_confidence"),
            "categoryValidationClipNonCivicScore": category_validation.get("clip_non_civic_score"),
            "categoryValidationSceneSummary": scene_summary,
            "reviewRequired": review_required,
            "reviewReason": category_validation.get("reason") if review_required else None,
            "imagePriorityScore": image_priority_meta.get("imageScoreApplied"),
            "imagePriorityIssueScore": image_priority_meta.get("issueScore"),
            "imagePriorityAlignmentAdjustment": image_priority_meta.get("alignmentAdjustment"),
            "imagePriorityIssueWeight": image_priority_meta.get("issueWeight"),
            "imagePriorityDetectedIssue": image_priority_meta.get("detectedIssue"),
            "imagePriorityValidationConfidence": image_priority_meta.get("validationConfidence"),
            "imagePriorityNonCivicScore": image_priority_meta.get("nonCivicScore"),
            "imagePriorityMatchType": image_priority_meta.get("matchType"),
            "imagePriorityBaseScore": round(float(base_priority.priority_score), 2),
            "imagePriorityFinalScore": round(float(final_priority.priority_score), 2),
            "imagePriorityLevel": final_priority.priority_level,
            "imagePriorityNote": image_priority_meta.get("note"),
            "modelVariant": "stock_pretrained_yolov8n_mobilenetv2_blip",
            "modelNote": self.settings.ai_model_disclaimer,
            "aiOutputImageUrl": ai_output_meta.get("outputImageUrl"),
            "aiOutputImageKey": ai_output_meta.get("outputImageKey"),
            "aiOutputStatus": ai_output_meta.get("status"),
            "aiOutputError": ai_output_meta.get("error"),
            "aiOutputGeneratedAt": ai_output_meta.get("generatedAt"),
            "aiGeneratedOutputPath": ai_output_meta.get("outputImageUrl"),
        }

    async def _create_and_store_ai_output_image(
        self,
        complaint: dict[str, Any],
        priority_result: PriorityResult,
        duplicate_match: DuplicateMatch,
        image_context: ImageContext,
    ) -> dict[str, Any]:
        if image_context.source_image is None:
            return {"status": "skipped", "error": "source_image_unavailable", "generatedAt": datetime.now(timezone.utc)}

        try:
            rendered = await asyncio.to_thread(
                self._render_ai_output_image,
                complaint,
                priority_result,
                duplicate_match,
                image_context,
            )
        except Exception as exc:
            logger.warning(
                "AI output rendering failed for complaint %s: %s",
                complaint.get("_id"),
                exc,
            )
            return {
                "status": "render_failed",
                "error": str(exc)[:240],
                "generatedAt": datetime.now(timezone.utc),
            }

        if not rendered:
            return {
                "status": "render_failed",
                "error": "empty_render_result",
                "generatedAt": datetime.now(timezone.utc),
            }

        if not self.s3_uploader.enabled:
            return {
                "status": "upload_skipped",
                "error": "s3_not_configured",
                "generatedAt": datetime.now(timezone.utc),
            }

        complaint_id = str(complaint.get("_id") or "unknown")
        prefix = (self.settings.ai_output_prefix or "ai-outputs").strip().strip("/")
        if not prefix:
            prefix = "ai-outputs"
        key = (
            f"{prefix}/{complaint_id}/"
            f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}-{uuid.uuid4().hex[:8]}.jpg"
        )
        url = await self.s3_uploader.upload_bytes(data=rendered, key=key, content_type="image/jpeg")
        generated_at = datetime.now(timezone.utc)
        if not url:
            return {
                "status": "upload_failed",
                "outputImageKey": key,
                "error": "s3_upload_failed",
                "generatedAt": generated_at,
            }

        return {
            "status": "uploaded",
            "outputImageUrl": url,
            "outputImageKey": key,
            "generatedAt": generated_at,
        }

    def _render_ai_output_image(
        self,
        complaint: dict[str, Any],
        priority_result: PriorityResult,
        duplicate_match: DuplicateMatch,
        image_context: ImageContext,
    ) -> bytes:
        assert image_context.source_image is not None

        base = image_context.source_image.convert("RGB")
        width, height = base.size
        max_dim = max(1, int(self.settings.yolo_max_image_dimension))
        if max(width, height) > max_dim:
            scale = max_dim / max(width, height)
            base = base.resize(
                (
                    max(1, int(width * scale)),
                    max(1, int(height * scale)),
                ),
                Image.Resampling.BILINEAR,
            )

        draw_font = ImageFont.load_default()
        base_width, base_height = base.size
        header_height = 108
        footer_height = 44
        canvas = Image.new("RGB", (base_width, base_height + header_height + footer_height), (244, 247, 252))
        canvas.paste(base, (0, header_height))
        draw = ImageDraw.Draw(canvas)

        draw.rectangle((0, 0, base_width, header_height), fill=(20, 72, 109))
        title = self._clip_text(str(complaint.get("title") or "CiviSense Complaint"), 84)
        draw.text((12, 10), "CiviSense AI Review Output", fill=(245, 250, 255), font=draw_font)
        draw.text((12, 28), title, fill=(245, 250, 255), font=draw_font)

        category = self._clip_text(str(complaint.get("category") or "unknown"), 28)
        summary = (
            f"Priority {priority_result.priority_level.upper()} ({priority_result.priority_score:.2f}) | "
            f"Category: {category} | Duplicate: {'Yes' if duplicate_match.is_duplicate else 'No'}"
        )
        draw.text((12, 46), self._clip_text(summary, 116), fill=(214, 233, 247), font=draw_font)

        validation = image_context.category_validation or {}
        detected_issue = self._clip_text(str(validation.get("detected_issue") or "unknown"), 20)
        match_type = self._clip_text(str(validation.get("match_type") or "mismatch"), 14)
        confidence = float(validation.get("confidence") or 0.0)
        non_civic_score = float(validation.get("clip_non_civic_score") or 0.0)
        ai_findings = (
            f"AI Findings: detected={detected_issue} | match={match_type} | "
            f"confidence={confidence:.2f} | non_civic={non_civic_score:.2f}"
        )
        draw.text((12, 64), self._clip_text(ai_findings, 116), fill=(199, 222, 243), font=draw_font)
        caption_text = str(validation.get("caption") or "").strip()
        if caption_text:
            draw.text(
                (12, 82),
                self._clip_text(f"Caption: {caption_text}", 116),
                fill=(178, 208, 232),
                font=draw_font,
            )

        sorted_detections = sorted(
            image_context.yolo_detections,
            key=lambda detection: detection.confidence,
            reverse=True,
        )[: max(1, int(self.settings.ai_max_annotations))]

        for idx, detection in enumerate(sorted_detections):
            color = ANNOTATION_COLORS[idx % len(ANNOTATION_COLORS)]
            x1, y1, x2, y2 = detection.bbox
            x1 = max(0, min(base_width - 1, int(x1)))
            x2 = max(0, min(base_width - 1, int(x2)))
            y1 = max(0, min(base_height - 1, int(y1)))
            y2 = max(0, min(base_height - 1, int(y2)))
            y1 += header_height
            y2 += header_height
            if x2 <= x1 or y2 <= y1:
                continue

            draw.rectangle((x1, y1, x2, y2), outline=color, width=3)
            label = self._clip_text(f"{detection.label} {detection.confidence:.2f}", 24)
            label_y = max(0, y1 - 17)
            draw.rectangle((x1, label_y, min(base_width - 1, x1 + 180), label_y + 15), fill=color)
            draw.text((x1 + 4, label_y + 3), label, fill=(255, 255, 255), font=draw_font)

        footer_top = header_height + base_height
        draw.rectangle((0, footer_top, base_width, footer_top + footer_height), fill=(231, 237, 248))
        disclaimer = self._clip_text(self.settings.ai_model_disclaimer, 140)
        draw.text((12, footer_top + 11), disclaimer, fill=(58, 76, 97), font=draw_font)

        with io.BytesIO() as buffer:
            canvas.save(buffer, format="JPEG", quality=90, optimize=True)
            return buffer.getvalue()

    @staticmethod
    def _clip_text(value: str, max_chars: int) -> str:
        text = str(value or "").strip()
        if len(text) <= max_chars:
            return text
        return f"{text[: max(0, max_chars - 3)]}..."

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

    def _build_scene_summary(
        self,
        image_context: ImageContext,
        category_validation: dict[str, Any],
    ) -> str | None:
        caption_summary = self._summarize_caption(category_validation.get("caption"))
        if caption_summary:
            return caption_summary

        yolo_labels = [
            detection.label
            for detection in sorted(image_context.yolo_detections, key=lambda item: item.confidence, reverse=True)[:3]
        ]
        label_summary = self._summarize_labels(yolo_labels)
        if label_summary:
            return label_summary

        mobilenet_result = image_context.mobilenet_result
        if mobilenet_result is not None:
            mobilenet_summary = self._summarize_labels(
                [mobilenet_result.label, *mobilenet_result.top_labels[:2]]
            )
            if mobilenet_summary:
                return mobilenet_summary

        return None

    def _summarize_caption(self, caption: Any) -> str | None:
        text = self._normalize_phrase(str(caption or ""))
        if not text:
            return None

        replacements = (
            (r"\ba couple of\b", "two"),
            (r"\bsitting on top of\b", "on"),
            (r"\bon top of\b", "on"),
            (r"\bside by side on\b", "on"),
            (r"\bin front of\b", "near"),
            (r"\bin the corner of\b", "in"),
            (r"\bnext to\b", "near"),
            (r"\battached to the side of\b", "on"),
            (r"\battached to\b", "on"),
            (r"\bhanging from\b", "on"),
            (r"\busing\b", "with"),
        )
        for pattern, replacement in replacements:
            text = re.sub(pattern, replacement, text)

        text = re.sub(r"^(there is|there are)\s+", "", text)
        text = re.sub(r"^(a|an|the)\s+(view|photo|picture)\s+of\s+", "", text)
        text = re.sub(r"\b(is|are)\b", " ", text)

        words = [
            word
            for word in text.split()
            if word not in SCENE_SUMMARY_COLOR_TERMS
        ]
        text = " ".join(words)
        text = re.sub(r"\s+", " ", text).strip(" .,;:")
        text = re.sub(r"^(a|an|the)\s+", "", text)

        if not text:
            return None

        if "laptops" in text and "table" in text:
            return "two laptops on a table"
        if ("laptop" in text or "computer" in text) and "table" in text:
            return "laptop on a table"
        if ("laptop" in text or "computer" in text) and "desk" in text:
            return "computer on a desk"
        if "room" in text and "chair" in text:
            return "room with a chair"
        if "bathroom" in text and "hose" in text:
            return "hose in a bathroom"

        words = text.split()
        if len(words) > 9:
            text = " ".join(words[:9])
        return text.strip(" .,;:") or None

    def _summarize_labels(self, labels: list[str]) -> str | None:
        candidates: list[str] = []
        for label in labels:
            normalized = self._normalize_phrase(str(label or ""))
            if not normalized or normalized in GENERIC_TRAFFIC_TERMS:
                continue
            candidates.append(normalized)

        if not candidates:
            return None

        prioritized = [
            candidate
            for candidate in candidates
            if any(term in candidate for term in NON_CIVIC_REVIEW_TERMS)
        ]
        return (prioritized[0] if prioritized else candidates[0]).strip() or None

    @staticmethod
    def _scene_summary_requires_manual_review(scene_summary: str | None) -> bool:
        summary = str(scene_summary or "").strip().lower()
        if not summary:
            return False
        return any(term in summary for term in NON_CIVIC_REVIEW_TERMS)

    @staticmethod
    def _normalize_phrase(text: str) -> str:
        cleaned = re.sub(r"[^a-z0-9\s]+", " ", text.lower())
        return " ".join(cleaned.split())

    @staticmethod
    def _normalize_category_token(value: Any) -> str:
        text = str(value or "").strip().lower()
        if not text:
            return ""
        text = text.replace("-", "_")
        text = re.sub(r"\s+", "_", text)
        text = re.sub(r"_+", "_", text).strip("_")
        return text

    def _determine_category_match_type(self, detected_issue: str, reported_category: str) -> str:
        detected = self._normalize_category_token(detected_issue)
        reported = self._normalize_category_token(reported_category)
        if not detected or detected == "unknown" or not reported:
            return "mismatch"
        if detected == reported:
            return "exact"

        for group in RELATED_CATEGORY_GROUPS:
            if detected in group and reported in group:
                return "related"
        return "mismatch"

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
