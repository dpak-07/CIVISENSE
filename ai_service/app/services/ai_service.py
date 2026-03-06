import asyncio
import io
import logging
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import torch
from PIL import Image, UnidentifiedImageError
from transformers import (
    BlipForConditionalGeneration,
    BlipProcessor,
    CLIPModel,
    CLIPProcessor,
)

from app.config import Settings

logger = logging.getLogger(__name__)

SUPPORTED_CATEGORIES: tuple[str, ...] = (
    "pothole",
    "garbage",
    "drainage",
    "water_leak",
    "streetlight",
    "road_damage",
    "traffic_sign",
    "other",
)

CATEGORY_ALIASES: dict[str, str] = {
    "street_light": "streetlight",
    "street_lights": "streetlight",
    "streetlamp": "streetlight",
    "street_lamp": "streetlight",
    "waterleak": "water_leak",
    "water_leakage": "water_leak",
    "water_supply": "water_leak",
    "road_crack": "road_damage",
    "road_cracks": "road_damage",
    "road_break": "road_damage",
    "road_broken": "road_damage",
    "traffic": "traffic_sign",
    "traffic_light": "traffic_sign",
    "traffic_signal": "traffic_sign",
    "road_sign": "traffic_sign",
    "traffic_signboard": "traffic_sign",
    "others": "other",
    "misc": "other",
    "miscellaneous": "other",
}

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "pothole": (
        "pothole",
        "road hole",
        "road crack",
        "asphalt damage",
        "asphalt crack",
        "pavement hole",
        "road surface hole",
        "water filled pothole",
        "puddle on road",
        "puddle",
    ),
    "garbage": (
        "garbage",
        "trash",
        "waste pile",
        "waste",
        "litter",
        "dump",
        "overflowing bin",
        "garbage pile",
        "garbage bag",
        "trash bag",
        "rubbish",
        "rubbish pile",
        "dustbin",
        "bin overflow",
        "overflowing garbage",
        "roadside waste",
        "waste dump",
        "debris pile",
        "municipal waste",
        "open waste bag",
        "overflowing dustbin",
        "roadside trash",
        "street garbage",
    ),
    "drainage": (
        "drain",
        "drainage",
        "sewer",
        "drainage blockage",
        "blocked drain",
        "clogged drain",
        "manhole overflow",
    ),
    "water_leak": (
        "water leak",
        "water leaking",
        "water leaking from pipe",
        "pipe leak",
        "water spill",
        "leaking pipe",
        "leaking",
        "leaking hose",
        "hose leak",
        "water flowing from hose",
        "wet wall",
        "water on wall",
        "water stain",
        "broken pipe",
        "burst pipe",
        "water overflowing",
        "leakage",
    ),
    "streetlight": (
        "street light",
        "streetlight",
        "lamp post",
        "lamp",
        "broken light",
        "broken streetlight",
        "light pole",
        "dark street",
        "light not working",
        "fused street light",
    ),
    "road_damage": (
        "damaged road",
        "broken asphalt",
        "road damage",
        "road surface damage",
        "broken road",
        "collapsed road",
        "asphalt broken",
        "road crack",
        "uneven road",
        "broken pavement",
        "road surface crack",
    ),
    "traffic_sign": (
        "traffic sign",
        "road sign",
        "bent sign board",
        "broken sign board",
        "damaged sign",
        "stop sign",
        "warning sign",
        "signal post",
        "traffic pole",
        "fallen sign",
    ),
    "other": tuple(),
}

CATEGORY_CLIP_PROMPTS: dict[str, tuple[str, ...]] = {
    "pothole": (
        "a photo of a pothole in the road",
        "a damaged asphalt road with a pothole",
        "a street with a deep road hole",
    ),
    "garbage": (
        "a photo of garbage piled on a street",
        "a trash dump near roadside",
        "a waste pile in a public area",
        "overflowing garbage bins on roadside",
        "litter and waste bags dumped in public street",
    ),
    "drainage": (
        "a blocked drainage channel on a road",
        "a sewer overflow near a street",
        "a clogged drain causing waterlogging",
        "open drain with stagnant dirty water",
    ),
    "water_leak": (
        "a leaking water pipe on a street",
        "water leaking from a pipe or hose",
        "water spill due to pipe leakage",
        "burst pipeline causing water flow on road",
    ),
    "streetlight": (
        "a broken streetlight pole near road",
        "a street lamp post not working",
        "a damaged lamp post in public street",
        "a dark road due to failed streetlight",
    ),
    "road_damage": (
        "a photo of damaged road surface",
        "a cracked and broken asphalt road",
        "a road with heavy surface damage",
        "a sunken road patch with broken pavement",
    ),
    "traffic_sign": (
        "a damaged traffic sign board on roadside",
        "a bent or broken road sign pole",
        "a fallen traffic sign in public street",
        "a faded warning signboard near junction",
    ),
    "other": tuple(),
}

RELATED_CATEGORY_GROUPS: tuple[set[str], ...] = (
    {"pothole", "road_damage"},
    {"drainage", "water_leak"},
    {"streetlight", "traffic_sign"},
)

NON_CIVIC_CLIP_CATEGORY = "__non_civic__"
NON_CIVIC_TERMS: set[str] = {
    "laptop",
    "keyboard",
    "monitor",
    "screen",
    "notebook",
    "stove",
    "bowl",
    "plate",
    "food",
    "kitchen",
    "table",
    "desk",
    "cup",
    "sofa",
    "bed",
    "room",
    "bathroom",
    "washroom",
    "toilet",
    "sink",
    "indoor",
    "home",
    "office",
}
NON_CIVIC_CLIP_PROMPTS: tuple[str, ...] = (
    "an indoor scene with kitchen utensils and food",
    "a laptop or computer on a desk indoors",
    "a household object photo not related to civic infrastructure",
    "an indoor room with furniture and electronics",
    "an indoor bathroom or washroom scene",
    "a private home interior not related to public roads or civic assets",
)

INDOOR_SCENE_TERMS: set[str] = {
    "bathroom",
    "washroom",
    "toilet",
    "kitchen",
    "bedroom",
    "living room",
    "room",
    "desk",
    "table",
    "indoor",
    "office",
    "home",
}

CIVIC_CONTEXT_TERMS: set[str] = {
    "road",
    "street",
    "roadside",
    "footpath",
    "public",
    "asphalt",
    "pavement",
    "drain",
    "sewer",
    "manhole",
    "streetlight",
    "lamp post",
    "municipal",
}

WATER_LEAK_CONTEXT_TERMS: set[str] = {
    "water",
    "leak",
    "leaking",
    "pipe",
    "burst",
    "broken pipe",
    "wet",
    "spill",
    "overflow",
    "flood",
}

CATEGORY_MIN_CLIP_CONFIDENCE: dict[str, float] = {
    "pothole": 0.40,
    "garbage": 0.40,
    "drainage": 0.42,
    "water_leak": 0.50,
    "streetlight": 0.42,
    "road_damage": 0.40,
    "traffic_sign": 0.45,
    "other": 0.95,
}


@dataclass(frozen=True)
class IssueExtractionResult:
    detected_issue: str
    confidence: float
    matched_keywords: dict[str, list[str]]
    score_by_category: dict[str, float]
    clip_scores: dict[str, float]


class ComplaintImageValidationService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._processor: BlipProcessor | None = None
        self._model: BlipForConditionalGeneration | None = None
        self._clip_processor: CLIPProcessor | None = None
        self._clip_model: CLIPModel | None = None
        self._clip_prompt_category_pairs: list[tuple[str, str]] = []

    async def load_model(self) -> None:
        await asyncio.to_thread(self._load_model_sync)

    def load_model_sync(self) -> None:
        self._load_model_sync()

    def _load_model_sync(self) -> None:
        if (
            self._processor is not None
            and self._model is not None
            and self._clip_processor is not None
            and self._clip_model is not None
        ):
            return

        logger.info(
            "Loading BLIP image captioning model '%s' on CPU",
            self.settings.hf_caption_model_name,
        )
        torch.set_num_threads(max(1, int(self.settings.cpu_threads)))
        try:
            torch.set_num_interop_threads(1)
        except RuntimeError:
            # PyTorch allows setting this only once per process.
            pass

        self._processor = BlipProcessor.from_pretrained(self.settings.hf_caption_model_name)
        self._model = BlipForConditionalGeneration.from_pretrained(self.settings.hf_caption_model_name)
        self._model.to("cpu")
        self._model.eval()
        logger.info("BLIP image captioning model loaded")

        logger.info(
            "Loading CLIP zero-shot model '%s' on CPU",
            self.settings.hf_clip_model_name,
        )
        self._clip_processor = CLIPProcessor.from_pretrained(self.settings.hf_clip_model_name)
        self._clip_model = CLIPModel.from_pretrained(self.settings.hf_clip_model_name)
        self._clip_model.to("cpu")
        self._clip_model.eval()
        civic_pairs = [
            (category, prompt)
            for category in SUPPORTED_CATEGORIES
            for prompt in CATEGORY_CLIP_PROMPTS.get(category, ())
        ]
        non_civic_pairs = [(NON_CIVIC_CLIP_CATEGORY, prompt) for prompt in NON_CIVIC_CLIP_PROMPTS]
        self._clip_prompt_category_pairs = civic_pairs + non_civic_pairs
        logger.info("CLIP zero-shot model loaded")

    def analyze_image(self, image_path: str) -> dict[str, Any]:
        logger.info("Analyzing image source=%s", image_path)
        image = self._load_image_from_source(image_path)
        caption = self._generate_caption(image)
        clip_scores, clip_non_civic_score = self._classify_with_clip(image)
        clip_top_issue, clip_top_conf = self._top_clip_category(clip_scores)
        logger.info(
            "Generated caption source=%s caption='%s' clip_top=%s(%.4f) non_civic=%.4f",
            image_path,
            caption,
            clip_top_issue,
            clip_top_conf,
            clip_non_civic_score,
        )
        return {
            "source": image_path,
            "caption": caption,
            "clip_scores": clip_scores,
            "clip_non_civic_score": round(clip_non_civic_score, 4),
        }

    def analyze_pil_image(self, image: Image.Image, source: str = "memory") -> dict[str, Any]:
        logger.info("Analyzing in-memory image source=%s", source)
        caption = self._generate_caption(image)
        clip_scores, clip_non_civic_score = self._classify_with_clip(image)
        clip_top_issue, clip_top_conf = self._top_clip_category(clip_scores)
        logger.info(
            "Generated caption source=%s caption='%s' clip_top=%s(%.4f) non_civic=%.4f",
            source,
            caption,
            clip_top_issue,
            clip_top_conf,
            clip_non_civic_score,
        )
        return {
            "source": source,
            "caption": caption,
            "clip_scores": clip_scores,
            "clip_non_civic_score": round(clip_non_civic_score, 4),
        }

    def extract_issue(
        self,
        caption: str,
        clip_scores: dict[str, float] | None = None,
        clip_non_civic_score: float = 0.0,
    ) -> IssueExtractionResult:
        normalized_caption = self._normalize_text(caption)
        matched_keywords: dict[str, list[str]] = {}
        score_by_category: dict[str, float] = {}

        for category, keywords in CATEGORY_KEYWORDS.items():
            hits: list[str] = []
            score = 0.0
            for keyword in keywords:
                if self._contains_phrase(normalized_caption, keyword):
                    hits.append(keyword)
                    score += 1.25 if " " in keyword else 1.0
            if hits:
                score += min(1.0, len(hits) * 0.2)

            matched_keywords[category] = hits
            score_by_category[category] = score

        normalized_clip_scores = self._normalize_clip_scores(clip_scores)
        clip_weight = max(0.0, float(self.settings.hf_clip_score_weight))
        for category, probability in normalized_clip_scores.items():
            # Blend CLIP signal as score contribution so it can rescue weak captions.
            score_by_category[category] = score_by_category.get(category, 0.0) + (probability * clip_weight)

        top_category = "unknown"
        top_score = 0.0
        for category, score in score_by_category.items():
            if score > top_score:
                top_category = category
                top_score = score

        top_clip_category, top_clip_confidence = self._top_clip_category(normalized_clip_scores)
        has_hose_term = self._contains_phrase(normalized_caption, "hose")
        has_water_leak_context = self._count_term_hits(normalized_caption, WATER_LEAK_CONTEXT_TERMS) > 0
        if top_clip_category == "water_leak" and has_hose_term and not has_water_leak_context:
            # Avoid classifying hose-only captions as water leak without leakage context.
            score_by_category["water_leak"] = max(0.0, score_by_category.get("water_leak", 0.0) * 0.12)
            top_category = "unknown"
            top_score = 0.0
            for category, score in score_by_category.items():
                if score > top_score:
                    top_category = category
                    top_score = score

        non_civic_score = max(0.0, min(1.0, float(clip_non_civic_score or 0.0)))
        has_keyword_signal = any(bool(hits) for hits in matched_keywords.values())
        non_civic_hits = self._count_term_hits(normalized_caption, NON_CIVIC_TERMS)
        indoor_hits = self._count_term_hits(normalized_caption, INDOOR_SCENE_TERMS)
        civic_context_hits = self._count_term_hits(normalized_caption, CIVIC_CONTEXT_TERMS)

        if top_score <= 0.0:
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
            )

        if not has_keyword_signal and (non_civic_score >= 0.42 or non_civic_hits >= 2):
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
            )

        if indoor_hits >= 1 and civic_context_hits == 0 and not has_keyword_signal:
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
            )

        if all(not hits for hits in matched_keywords.values()) and top_clip_confidence < float(
            self.settings.hf_clip_min_confidence
        ):
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
            )

        if all(not hits for hits in matched_keywords.values()):
            required_clip_conf = CATEGORY_MIN_CLIP_CONFIDENCE.get(
                top_category,
                float(self.settings.hf_clip_min_confidence),
            )
            if top_clip_confidence < required_clip_conf:
                return IssueExtractionResult(
                    detected_issue="unknown",
                    confidence=0.0,
                    matched_keywords=matched_keywords,
                    score_by_category=score_by_category,
                    clip_scores=normalized_clip_scores,
                )

        confidence = self._compute_confidence(
            top_category=top_category,
            score_by_category=score_by_category,
            clip_top_confidence=top_clip_confidence,
            top_keyword_hits=len(matched_keywords.get(top_category, [])),
        )
        return IssueExtractionResult(
            detected_issue=top_category,
            confidence=round(confidence, 4),
            matched_keywords=matched_keywords,
            score_by_category=score_by_category,
            clip_scores=normalized_clip_scores,
        )

    def validate_category(self, detected_issue: str, reported_category: str) -> bool:
        match_type = self._determine_match_type(detected_issue, reported_category)
        return match_type in {"exact", "related", "other"}

    def generate_reason(
        self,
        detected_issue: str,
        reported_category: str,
        caption: str,
        *,
        clip_scores: dict[str, float] | None = None,
        clip_non_civic_score: float = 0.0,
        match_type: str | None = None,
    ) -> str:
        detected = self._normalize_category(detected_issue)
        reported = self._normalize_category(reported_category)
        resolved_match_type = (match_type or self._determine_match_type(detected, reported)).strip().lower()
        caption_text = caption.strip() if isinstance(caption, str) else ""
        caption_snippet = caption_text if len(caption_text) <= 180 else f"{caption_text[:177]}..."
        clip_top_issue, clip_top_confidence = self._top_clip_category(self._normalize_clip_scores(clip_scores))
        clip_evidence = f" CLIP top signal: {clip_top_issue} ({clip_top_confidence:.2f})."
        non_civic_evidence = f" Non-civic scene score: {max(0.0, min(1.0, float(clip_non_civic_score or 0.0))):.2f}."

        if not caption_snippet:
            caption_snippet = "No caption could be generated from the image."

        if detected == "unknown":
            return (
                "The model could not map the image to a supported civic issue category. "
                f"Generated caption: '{caption_snippet}'.{clip_evidence}{non_civic_evidence}"
            )

        if not reported:
            return (
                f"The detected issue is '{detected.replace('_', ' ')}', but the complaint category was empty or invalid."
            )

        if resolved_match_type == "exact":
            return (
                f"The detected issue matches the reported category ('{reported.replace('_', ' ')}'). "
                f"Generated caption: '{caption_snippet}'.{clip_evidence}"
            )

        if resolved_match_type == "related":
            return (
                f"The detected issue '{detected.replace('_', ' ')}' is closely related to the reported "
                f"category '{reported.replace('_', ' ')}', so this is treated as a valid related match. "
                f"Generated caption: '{caption_snippet}'.{clip_evidence}{non_civic_evidence}"
            )

        if resolved_match_type == "other":
            return (
                "The complaint was reported under a generic 'other' category, so AI category validation "
                f"is treated as informational only. Generated caption: '{caption_snippet}'."
            )

        return (
            f"The image suggests '{detected.replace('_', ' ')}' while the complaint was reported as "
            f"'{reported.replace('_', ' ')}'. Generated caption: '{caption_snippet}'.{clip_evidence}{non_civic_evidence}"
        )

    async def validate_image_category(
        self,
        image_path: str,
        reported_category: str,
    ) -> dict[str, Any]:
        try:
            return await asyncio.to_thread(
                self._validate_sync,
                image_path,
                reported_category,
            )
        except Exception as exc:
            logger.warning("Image category validation failed for source=%s: %s", image_path, exc)
            return self._build_error_result(reported_category, str(exc))

    async def validate_pil_image_category(
        self,
        image: Image.Image,
        reported_category: str,
        source: str = "memory",
    ) -> dict[str, Any]:
        try:
            return await asyncio.to_thread(
                self._validate_pil_sync,
                image,
                reported_category,
                source,
            )
        except Exception as exc:
            logger.warning("In-memory image category validation failed for source=%s: %s", source, exc)
            return self._build_error_result(reported_category, str(exc))

    def _validate_sync(self, image_path: str, reported_category: str) -> dict[str, Any]:
        analysis = self.analyze_image(image_path)
        caption = str(analysis.get("caption") or "")
        clip_scores = self._normalize_clip_scores(analysis.get("clip_scores"))
        clip_non_civic_score = float(analysis.get("clip_non_civic_score") or 0.0)
        extraction = self.extract_issue(
            caption,
            clip_scores=clip_scores,
            clip_non_civic_score=clip_non_civic_score,
        )

        normalized_reported = self._normalize_category(reported_category)
        if normalized_reported and normalized_reported not in SUPPORTED_CATEGORIES:
            return self._build_unsupported_category_result(
                reported_category=normalized_reported,
                caption=caption,
                clip_scores=extraction.clip_scores,
                clip_non_civic_score=clip_non_civic_score,
            )

        match_type = self._determine_match_type(extraction.detected_issue, normalized_reported)
        is_valid = match_type in {"exact", "related"}
        reason = self.generate_reason(
            extraction.detected_issue,
            normalized_reported,
            caption,
            clip_scores=extraction.clip_scores,
            clip_non_civic_score=clip_non_civic_score,
            match_type=match_type,
        )
        keyword_hits = extraction.matched_keywords.get(extraction.detected_issue, [])
        clip_top_issue, clip_top_confidence = self._top_clip_category(extraction.clip_scores)

        logger.info(
            (
                "Validation complete source=%s detected=%s reported=%s valid=%s "
                "confidence=%.4f match_type=%s clip_top=%s(%.4f) non_civic=%.4f"
            ),
            image_path,
            extraction.detected_issue,
            normalized_reported,
            is_valid,
            extraction.confidence,
            match_type,
            clip_top_issue,
            clip_top_confidence,
            clip_non_civic_score,
        )

        return {
            "detected_issue": extraction.detected_issue,
            "reported_category": normalized_reported,
            "is_valid": is_valid,
            "match_type": match_type,
            "confidence": extraction.confidence,
            "reason": reason,
            "caption": caption,
            "keyword_hits": keyword_hits,
            "clip_scores": extraction.clip_scores,
            "clip_top_issue": clip_top_issue,
            "clip_top_confidence": round(clip_top_confidence, 4),
            "clip_non_civic_score": round(clip_non_civic_score, 4),
            "status": "ok",
        }

    def _validate_pil_sync(
        self,
        image: Image.Image,
        reported_category: str,
        source: str,
    ) -> dict[str, Any]:
        analysis = self.analyze_pil_image(image=image, source=source)
        caption = str(analysis.get("caption") or "")
        clip_scores = self._normalize_clip_scores(analysis.get("clip_scores"))
        clip_non_civic_score = float(analysis.get("clip_non_civic_score") or 0.0)
        extraction = self.extract_issue(
            caption,
            clip_scores=clip_scores,
            clip_non_civic_score=clip_non_civic_score,
        )

        normalized_reported = self._normalize_category(reported_category)
        if normalized_reported and normalized_reported not in SUPPORTED_CATEGORIES:
            return self._build_unsupported_category_result(
                reported_category=normalized_reported,
                caption=caption,
                clip_scores=extraction.clip_scores,
                clip_non_civic_score=clip_non_civic_score,
            )

        match_type = self._determine_match_type(extraction.detected_issue, normalized_reported)
        is_valid = match_type in {"exact", "related"}
        reason = self.generate_reason(
            extraction.detected_issue,
            normalized_reported,
            caption,
            clip_scores=extraction.clip_scores,
            clip_non_civic_score=clip_non_civic_score,
            match_type=match_type,
        )
        keyword_hits = extraction.matched_keywords.get(extraction.detected_issue, [])
        clip_top_issue, clip_top_confidence = self._top_clip_category(extraction.clip_scores)

        logger.info(
            (
                "Validation complete source=%s detected=%s reported=%s valid=%s "
                "confidence=%.4f match_type=%s clip_top=%s(%.4f) non_civic=%.4f"
            ),
            source,
            extraction.detected_issue,
            normalized_reported,
            is_valid,
            extraction.confidence,
            match_type,
            clip_top_issue,
            clip_top_confidence,
            clip_non_civic_score,
        )

        return {
            "detected_issue": extraction.detected_issue,
            "reported_category": normalized_reported,
            "is_valid": is_valid,
            "match_type": match_type,
            "confidence": extraction.confidence,
            "reason": reason,
            "caption": caption,
            "keyword_hits": keyword_hits,
            "clip_scores": extraction.clip_scores,
            "clip_top_issue": clip_top_issue,
            "clip_top_confidence": round(clip_top_confidence, 4),
            "clip_non_civic_score": round(clip_non_civic_score, 4),
            "status": "ok",
        }

    def _generate_caption(self, image: Image.Image) -> str:
        if self._processor is None or self._model is None:
            raise RuntimeError("BLIP model is not loaded")

        prepared = image.convert("RGB")
        inputs = self._processor(images=prepared, return_tensors="pt")
        inputs = {key: value.to("cpu") for key, value in inputs.items()}

        with torch.inference_mode():
            output = self._model.generate(
                **inputs,
                max_new_tokens=self.settings.hf_caption_max_new_tokens,
                num_beams=self.settings.hf_caption_num_beams,
                do_sample=False,
            )

        caption = self._processor.decode(output[0], skip_special_tokens=True)
        return self._normalize_caption(caption)

    def _load_image_from_source(self, image_source: str) -> Image.Image:
        if not isinstance(image_source, str) or not image_source.strip():
            raise ValueError("Image source is required")

        source = image_source.strip()
        parsed = urlparse(source)
        if parsed.scheme in {"http", "https"}:
            return self._load_image_from_url(source)

        path = Path(source)
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"Image file not found: {source}")

        try:
            with Image.open(path) as image:
                return image.convert("RGB")
        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError(f"Invalid image file: {source}") from exc

    def _load_image_from_url(self, url: str) -> Image.Image:
        request = Request(url, headers={"User-Agent": "civisense-ai-service/1.0"})
        max_bytes = int(self.settings.image_max_bytes)
        timeout = int(self.settings.image_download_timeout_seconds)

        with urlopen(request, timeout=timeout) as response:  # nosec B310
            content_type = (response.headers.get("Content-Type") or "").lower()
            if "image" not in content_type:
                raise ValueError(f"Expected image URL, got content type '{content_type or 'unknown'}'")

            chunks = bytearray()
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                chunks.extend(chunk)
                if len(chunks) > max_bytes:
                    raise ValueError("Image size exceeds configured max size")

        try:
            with Image.open(io.BytesIO(bytes(chunks))) as image:
                return image.convert("RGB")
        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError(f"Invalid image payload from URL: {url}") from exc

    def _classify_with_clip(self, image: Image.Image) -> tuple[dict[str, float], float]:
        if self._clip_processor is None or self._clip_model is None:
            raise RuntimeError("CLIP model is not loaded")
        if not self._clip_prompt_category_pairs:
            return {category: 0.0 for category in SUPPORTED_CATEGORIES}, 0.0

        prompts = [prompt for _, prompt in self._clip_prompt_category_pairs]
        prepared = image.convert("RGB")
        inputs = self._clip_processor(
            text=prompts,
            images=prepared,
            return_tensors="pt",
            padding=True,
        )
        inputs = {key: value.to("cpu") for key, value in inputs.items()}

        with torch.inference_mode():
            outputs = self._clip_model(**inputs)
            logits = outputs.logits_per_image[0]
            probabilities = torch.softmax(logits, dim=0).detach().cpu().tolist()

        aggregated: dict[str, float] = {category: 0.0 for category in SUPPORTED_CATEGORIES}
        non_civic_total = 0.0
        for (category, _prompt), probability in zip(self._clip_prompt_category_pairs, probabilities):
            value = float(probability)
            if category == NON_CIVIC_CLIP_CATEGORY:
                non_civic_total += value
            else:
                aggregated[category] += value

        civic_total = sum(aggregated.values())
        all_total = civic_total + non_civic_total

        normalized_civic = (
            {category: (value / civic_total) for category, value in aggregated.items()}
            if civic_total > 0.0
            else {category: 0.0 for category in SUPPORTED_CATEGORIES}
        )
        non_civic_score = (non_civic_total / all_total) if all_total > 0.0 else 0.0
        return normalized_civic, max(0.0, min(1.0, non_civic_score))

    def _compute_confidence(
        self,
        top_category: str,
        score_by_category: dict[str, float],
        clip_top_confidence: float = 0.0,
        top_keyword_hits: int = 0,
    ) -> float:
        top_score = float(score_by_category.get(top_category, 0.0))
        if top_score <= 0.0:
            return 0.0

        positive_scores = [score for score in score_by_category.values() if score > 0.0]
        if not positive_scores:
            return 0.0

        max_score = max(positive_scores)
        exp_scores = [math.exp(score - max_score) for score in positive_scores]
        softmax_total = sum(exp_scores)
        softmax_top = math.exp(top_score - max_score) / softmax_total if softmax_total > 0 else 0.0

        strength = min(1.0, top_score / 3.5)
        keyword_support = min(1.0, max(0.0, float(top_keyword_hits)) / 2.0)
        combined = (
            (softmax_top * 0.45)
            + (strength * 0.20)
            + (max(0.0, min(1.0, clip_top_confidence)) * 0.20)
            + (keyword_support * 0.15)
        )

        # Penalize clip-only decisions with no caption keyword support.
        if top_keyword_hits <= 0:
            combined *= 0.78
        return max(0.0, min(1.0, combined))

    @staticmethod
    def _normalize_clip_scores(raw_scores: Any) -> dict[str, float]:
        if not isinstance(raw_scores, dict):
            return {}

        normalized: dict[str, float] = {}
        for key, value in raw_scores.items():
            category = str(key or "").strip().lower()
            if category not in SUPPORTED_CATEGORIES:
                continue
            try:
                numeric = float(value)
            except (TypeError, ValueError):
                continue
            normalized[category] = max(0.0, min(1.0, numeric))
        return normalized

    @staticmethod
    def _top_clip_category(clip_scores: dict[str, float]) -> tuple[str, float]:
        if not clip_scores:
            return "unknown", 0.0
        category, score = max(clip_scores.items(), key=lambda pair: float(pair[1]))
        return category, float(score)

    def _determine_match_type(self, detected_issue: str, reported_category: str) -> str:
        detected = self._normalize_category(detected_issue)
        reported = self._normalize_category(reported_category)

        if reported == "other":
            return "other"

        if not detected or detected == "unknown" or not reported:
            return "mismatch"
        if detected == reported:
            return "exact"

        for group in RELATED_CATEGORY_GROUPS:
            if detected in group and reported in group:
                return "related"
        return "mismatch"

    @staticmethod
    def _count_term_hits(text: str, terms: set[str]) -> int:
        normalized_text = re.sub(r"\s+", " ", str(text or "").strip().lower())
        hits = 0
        for term in terms:
            normalized_term = re.sub(r"\s+", " ", term.strip().lower())
            if not normalized_term:
                continue
            pattern = r"(?<!\w)" + re.escape(normalized_term).replace(r"\ ", r"\s+") + r"(?!\w)"
            if re.search(pattern, normalized_text):
                hits += 1
        return hits

    @staticmethod
    def _normalize_text(value: str) -> str:
        lowered = str(value or "").strip().lower()
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]+", " ", lowered)).strip()

    @staticmethod
    def _normalize_caption(caption: str) -> str:
        normalized = re.sub(r"\s+", " ", str(caption or "").strip().lower())
        return normalized or "unknown scene"

    @staticmethod
    def _contains_phrase(text: str, phrase: str) -> bool:
        normalized_phrase = re.sub(r"\s+", " ", phrase.strip().lower())
        if not normalized_phrase:
            return False
        pattern = r"(?<!\w)" + re.escape(normalized_phrase).replace(r"\ ", r"\s+") + r"(?!\w)"
        return re.search(pattern, text) is not None

    def _normalize_category(self, category: str | None) -> str:
        if not isinstance(category, str):
            return ""
        normalized = category.strip().lower().replace("-", "_")
        normalized = re.sub(r"\s+", "_", normalized)
        normalized = re.sub(r"_+", "_", normalized).strip("_")
        if not normalized:
            return ""
        return CATEGORY_ALIASES.get(normalized, normalized)

    def _build_error_result(self, reported_category: str, error_message: str) -> dict[str, Any]:
        normalized_reported = self._normalize_category(reported_category)
        safe_error = str(error_message or "").strip().replace("\n", " ")[:240]
        return {
            "detected_issue": "unknown",
            "reported_category": normalized_reported,
            "is_valid": False,
            "match_type": "mismatch",
            "confidence": 0.0,
            "reason": f"AI image validation failed: {safe_error or 'unknown_error'}",
            "caption": None,
            "keyword_hits": [],
            "clip_scores": {},
            "clip_top_issue": "unknown",
            "clip_top_confidence": 0.0,
            "clip_non_civic_score": 0.0,
            "status": "failed",
        }

    def _build_unsupported_category_result(
        self,
        *,
        reported_category: str,
        caption: str,
        clip_scores: dict[str, float],
        clip_non_civic_score: float,
    ) -> dict[str, Any]:
        clip_top_issue, clip_top_confidence = self._top_clip_category(clip_scores)
        return {
            "detected_issue": "unknown",
            "reported_category": reported_category,
            "is_valid": False,
            "match_type": "unsupported_category",
            "confidence": 0.0,
            "reason": (
                f"Reported category '{reported_category}' is not supported by AI validation. "
                f"Supported categories: {', '.join(SUPPORTED_CATEGORIES)}."
            ),
            "caption": caption,
            "keyword_hits": [],
            "clip_scores": clip_scores,
            "clip_top_issue": clip_top_issue,
            "clip_top_confidence": round(clip_top_confidence, 4),
            "clip_non_civic_score": round(max(0.0, min(1.0, float(clip_non_civic_score or 0.0))), 4),
            "status": "unsupported_category",
        }
