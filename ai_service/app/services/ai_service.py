import asyncio
import io
import json
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
from ultralytics import YOLO

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
        "sunken road",
        "road crater",
        "cracked pavement",
        "broken road patch",
        "damaged pavement",
        "hole in road",
        "collapsed road patch",
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
        "dirty bathroom",
        "dirty washroom",
        "dirty toilet area",
        "toilet waste",
        "waste near toilet",
        "trash near toilet",
        "trash near sink",
        "waste near sink",
        "used tissue",
        "tissue waste",
        "plastic wrapper",
        "discarded wrapper",
        "discarded plastic",
        "dirty corner",
    ),
    "drainage": (
        "drain",
        "drainage",
        "sewer",
        "drainage blockage",
        "blocked drain",
        "clogged drain",
        "manhole overflow",
        "open drain",
        "stagnant drain water",
        "dirty drain water",
        "drain cover missing",
        "gutter blockage",
        "sewage water",
        "wastewater near drain",
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
        "leaking tap",
        "broken tap",
        "leaking faucet",
        "burst water pipe",
        "water dripping",
        "wet floor near pipe",
        "water pooling from pipe",
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
        "street lamp",
        "lamp pole",
        "damaged lamp post",
        "electric pole light",
        "broken street lamp",
        "dark road",
        "pole light not working",
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
        "damaged pavement",
        "collapsed pavement",
        "sunken road",
        "broken concrete road",
        "cracked road surface",
        "damaged road patch",
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
        "sign post",
        "sign pole",
        "tilted signboard",
        "broken traffic sign",
        "damaged sign pole",
        "faded traffic sign",
    ),
}

CATEGORY_CLIP_PROMPTS: dict[str, tuple[str, ...]] = {
    "pothole": (
        "a photo of a pothole in the road",
        "a damaged asphalt road with a pothole",
        "a street with a deep road hole",
        "a sunken patch in the middle of a road",
        "a broken road surface with a hole and cracked asphalt",
    ),
    "garbage": (
        "a photo of garbage piled on a street",
        "a trash dump near roadside",
        "a waste pile in a public area",
        "overflowing garbage bins on roadside",
        "litter and waste bags dumped in public street",
        "a dirty bathroom corner with trash and waste",
        "plastic waste and litter near a toilet or sink",
        "a washroom area with discarded trash and wrappers",
        "garbage dumped in a dirty indoor corner",
    ),
    "drainage": (
        "a blocked drainage channel on a road",
        "a sewer overflow near a street",
        "a clogged drain causing waterlogging",
        "open drain with stagnant dirty water",
        "a roadside drain blocked with dirty water",
        "a manhole or gutter overflowing on a street",
    ),
    "water_leak": (
        "a leaking water pipe on a street",
        "water leaking from a pipe or hose",
        "water spill due to pipe leakage",
        "burst pipeline causing water flow on road",
        "a tap or pipe leaking water near a wall",
        "clean water spilling from a broken pipe or valve",
    ),
    "streetlight": (
        "a broken streetlight pole near road",
        "a street lamp post not working",
        "a damaged lamp post in public street",
        "a dark road due to failed streetlight",
        "a street light pole with broken lamp fixture",
        "a roadside electric lamp post that is damaged",
    ),
    "road_damage": (
        "a photo of damaged road surface",
        "a cracked and broken asphalt road",
        "a road with heavy surface damage",
        "a sunken road patch with broken pavement",
        "an uneven damaged pavement on a street",
        "a collapsed patch of road surface",
    ),
    "traffic_sign": (
        "a damaged traffic sign board on roadside",
        "a bent or broken road sign pole",
        "a fallen traffic sign in public street",
        "a faded warning signboard near junction",
        "a tilted signboard attached to a roadside pole",
        "a damaged stop sign or warning sign on a street",
    ),
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
    "a household object photo not related to civic infrastructure or waste",
    "an indoor room with furniture and electronics and no civic issue",
    "a clean indoor bathroom or washroom scene with no waste or civic problem",
    "a private home interior not related to public roads, public assets, or dumped waste",
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
    "pipeline",
    "tap",
    "faucet",
    "valve",
    "burst",
    "broken pipe",
    "wet",
    "spill",
    "overflow",
    "flood",
    "dripping",
    "damp wall",
    "wet floor",
}

GARBAGE_CONTEXT_TERMS: set[str] = {
    "garbage",
    "trash",
    "waste",
    "litter",
    "dirty bathroom",
    "dirty washroom",
    "dirty toilet area",
    "trash bag",
    "garbage bag",
    "plastic bag",
    "plastic wrapper",
    "wrapper",
    "discarded wrapper",
    "used tissue",
    "tissue waste",
    "discarded plastic",
    "dirty corner",
    "messy corner",
    "refuse",
    "rubbish",
}

GARBAGE_FIXTURE_TERMS: set[str] = {
    "bathroom",
    "washroom",
    "toilet",
    "sink",
}

ROAD_SURFACE_TERMS: set[str] = {
    "road",
    "street",
    "asphalt",
    "pavement",
    "lane",
    "road surface",
    "road patch",
    "concrete road",
    "footpath",
}

POTHOLE_CONTEXT_TERMS: set[str] = {
    "pothole",
    "road hole",
    "hole in road",
    "road crack",
    "asphalt crack",
    "pavement hole",
    "water filled pothole",
    "sunken road",
    "road crater",
    "broken road patch",
}

ROAD_DAMAGE_CONTEXT_TERMS: set[str] = {
    "road damage",
    "damaged road",
    "broken asphalt",
    "asphalt broken",
    "road surface damage",
    "road crack",
    "uneven road",
    "broken pavement",
    "collapsed road",
    "collapsed pavement",
    "sunken road",
    "cracked road surface",
}

DRAINAGE_CONTEXT_TERMS: set[str] = {
    "drain",
    "drainage",
    "sewer",
    "blocked drain",
    "clogged drain",
    "open drain",
    "drainage blockage",
    "stagnant drain water",
    "dirty drain water",
    "gutter blockage",
    "manhole overflow",
    "sewage water",
    "wastewater",
}

DRAINAGE_FIXTURE_TERMS: set[str] = {
    "drain",
    "gutter",
    "sewer",
    "manhole",
    "channel",
    "drainage",
    "culvert",
}

WATER_LEAK_FIXTURE_TERMS: set[str] = {
    "pipe",
    "hose",
    "tap",
    "faucet",
    "valve",
    "pipeline",
    "wall",
    "floor",
}

STREETLIGHT_CONTEXT_TERMS: set[str] = {
    "streetlight",
    "street light",
    "street lamp",
    "lamp post",
    "lamp pole",
    "light pole",
    "broken light",
    "broken streetlight",
    "light not working",
    "dark street",
    "dark road",
    "damaged lamp post",
    "electric pole light",
}

STREETLIGHT_FIXTURE_TERMS: set[str] = {
    "streetlight",
    "street light",
    "street lamp",
    "lamp post",
    "lamp pole",
    "light pole",
    "pole",
    "lamp",
    "street",
    "road",
}

TRAFFIC_SIGN_CONTEXT_TERMS: set[str] = {
    "traffic sign",
    "road sign",
    "sign board",
    "signboard",
    "stop sign",
    "warning sign",
    "signal post",
    "traffic pole",
    "fallen sign",
    "bent sign board",
    "broken traffic sign",
    "damaged sign pole",
    "tilted signboard",
}

TRAFFIC_SIGN_FIXTURE_TERMS: set[str] = {
    "sign",
    "sign board",
    "signboard",
    "pole",
    "post",
    "junction",
    "road",
    "street",
}

CATEGORY_SIGNAL_PROFILES: dict[str, dict[str, Any]] = {
    "pothole": {
        "context_terms": POTHOLE_CONTEXT_TERMS,
        "support_terms": ROAD_SURFACE_TERMS,
        "context_hit_min": 1,
        "support_min_hits": 1,
        "hybrid_context_min": 1,
        "clip_threshold": 0.53,
        "classifier_threshold": 0.40,
        "hybrid_threshold": 0.48,
        "boost": 1.10,
        "non_civic_multiplier": 0.32,
        "non_civic_floor": 0.08,
        "keyword_bonus": 2,
    },
    "garbage": {
        "context_terms": GARBAGE_CONTEXT_TERMS,
        "support_terms": GARBAGE_FIXTURE_TERMS,
        "context_hit_min": 1,
        "support_min_hits": 2,
        "hybrid_context_min": 1,
        "clip_threshold": 0.52,
        "classifier_threshold": 0.40,
        "hybrid_threshold": 0.48,
        "boost": 1.35,
        "non_civic_multiplier": 0.40,
        "non_civic_floor": 0.16,
        "keyword_bonus": 2,
    },
    "drainage": {
        "context_terms": DRAINAGE_CONTEXT_TERMS,
        "support_terms": DRAINAGE_FIXTURE_TERMS,
        "context_hit_min": 1,
        "support_min_hits": 1,
        "hybrid_context_min": 1,
        "clip_threshold": 0.50,
        "classifier_threshold": 0.38,
        "hybrid_threshold": 0.46,
        "boost": 1.12,
        "non_civic_multiplier": 0.38,
        "non_civic_floor": 0.12,
        "keyword_bonus": 2,
    },
    "water_leak": {
        "context_terms": WATER_LEAK_CONTEXT_TERMS,
        "support_terms": WATER_LEAK_FIXTURE_TERMS,
        "context_hit_min": 2,
        "support_min_hits": 1,
        "hybrid_context_min": 1,
        "clip_threshold": 0.60,
        "classifier_threshold": 0.44,
        "hybrid_threshold": 0.56,
        "boost": 0.95,
        "non_civic_multiplier": 0.48,
        "non_civic_floor": 0.14,
        "keyword_bonus": 1,
    },
    "streetlight": {
        "context_terms": STREETLIGHT_CONTEXT_TERMS,
        "support_terms": STREETLIGHT_FIXTURE_TERMS,
        "context_hit_min": 1,
        "support_min_hits": 1,
        "hybrid_context_min": 1,
        "clip_threshold": 0.50,
        "classifier_threshold": 0.38,
        "hybrid_threshold": 0.46,
        "boost": 1.10,
        "non_civic_multiplier": 0.30,
        "non_civic_floor": 0.10,
        "keyword_bonus": 2,
    },
    "road_damage": {
        "context_terms": ROAD_DAMAGE_CONTEXT_TERMS,
        "support_terms": ROAD_SURFACE_TERMS,
        "context_hit_min": 1,
        "support_min_hits": 1,
        "hybrid_context_min": 1,
        "clip_threshold": 0.50,
        "classifier_threshold": 0.38,
        "hybrid_threshold": 0.46,
        "boost": 1.05,
        "non_civic_multiplier": 0.34,
        "non_civic_floor": 0.08,
        "keyword_bonus": 2,
    },
    "traffic_sign": {
        "context_terms": TRAFFIC_SIGN_CONTEXT_TERMS,
        "support_terms": TRAFFIC_SIGN_FIXTURE_TERMS,
        "context_hit_min": 1,
        "support_min_hits": 1,
        "hybrid_context_min": 1,
        "clip_threshold": 0.52,
        "classifier_threshold": 0.40,
        "hybrid_threshold": 0.48,
        "boost": 1.08,
        "non_civic_multiplier": 0.32,
        "non_civic_floor": 0.10,
        "keyword_bonus": 2,
    },
}

CATEGORY_MIN_CLIP_CONFIDENCE: dict[str, float] = {
    "pothole": 0.40,
    "garbage": 0.40,
    "drainage": 0.42,
    "water_leak": 0.50,
    "streetlight": 0.42,
    "road_damage": 0.40,
    "traffic_sign": 0.45,
}


@dataclass(frozen=True)
class IssueExtractionResult:
    detected_issue: str
    confidence: float
    matched_keywords: dict[str, list[str]]
    score_by_category: dict[str, float]
    clip_scores: dict[str, float]
    classifier_scores: dict[str, float]


class ComplaintImageValidationService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._processor: BlipProcessor | None = None
        self._model: BlipForConditionalGeneration | None = None
        self._clip_processor: CLIPProcessor | None = None
        self._clip_model: CLIPModel | None = None
        self._clip_prompt_category_pairs: list[tuple[str, str]] = []
        self._civic_classifier: YOLO | None = None
        self._civic_classifier_model_path: str | None = None

    async def load_model(self) -> None:
        await asyncio.to_thread(self._load_model_sync)

    def load_model_sync(self) -> None:
        self._load_model_sync()

    def _load_model_sync(self) -> None:
        core_models_loaded = (
            self._processor is not None
            and self._model is not None
            and self._clip_processor is not None
            and self._clip_model is not None
        )
        if core_models_loaded and (not self.settings.civic_classifier_enabled or self._civic_classifier is not None):
            return

        torch.set_num_threads(max(1, int(self.settings.cpu_threads)))
        try:
            torch.set_num_interop_threads(1)
        except RuntimeError:
            # PyTorch allows setting this only once per process.
            pass

        if not core_models_loaded:
            logger.info(
                "Loading BLIP image captioning model '%s' on CPU",
                self.settings.hf_caption_model_name,
            )
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

        self._load_civic_classifier_sync()

    def _load_civic_classifier_sync(self) -> None:
        if not self.settings.civic_classifier_enabled or self._civic_classifier is not None:
            return

        weights_path = self._discover_civic_classifier_weights()
        if weights_path is None:
            logger.info("No fine-tuned civic classifier weights found. Using stock BLIP/CLIP validation only.")
            return

        try:
            logger.info("Loading fine-tuned civic classifier '%s' on CPU", weights_path)
            classifier = YOLO(str(weights_path))
            classifier.to("cpu")
            self._civic_classifier = classifier
            self._civic_classifier_model_path = str(weights_path)
            logger.info("Fine-tuned civic classifier loaded")
        except Exception as exc:
            logger.warning("Failed to load fine-tuned civic classifier '%s': %s", weights_path, exc)
            self._civic_classifier = None
            self._civic_classifier_model_path = None

    def _discover_civic_classifier_weights(self) -> Path | None:
        explicit_model_path = self._resolve_project_path(self.settings.civic_classifier_model_path)
        if explicit_model_path is not None and explicit_model_path.is_file():
            return explicit_model_path

        active_model_path = self._resolve_project_path("training_data/active_civic_classifier.pt")
        if active_model_path is not None and active_model_path.is_file():
            return active_model_path

        state_path = self._resolve_project_path(self.settings.civic_classifier_state_file)
        if state_path is not None and state_path.is_file():
            try:
                payload = json.loads(state_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("Could not read civic classifier state file '%s': %s", state_path, exc)
            else:
                for key in ("activeWeightsPath", "lastWeightsPath"):
                    candidate = self._resolve_project_path(payload.get(key))
                    if candidate is not None and candidate.is_file():
                        return candidate

        training_runs_dir = self._resolve_project_path("training_runs")
        if training_runs_dir is None or not training_runs_dir.is_dir():
            return None

        candidates = sorted(
            training_runs_dir.glob("*/weights/*.pt"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        return candidates[0] if candidates else None

    @staticmethod
    def _project_root() -> Path:
        return Path(__file__).resolve().parents[2]

    def _resolve_project_path(self, raw_path: str | None) -> Path | None:
        value = str(raw_path or "").strip()
        if not value:
            return None
        path = Path(value)
        if not path.is_absolute():
            path = self._project_root() / path
        return path.resolve()

    def _model_variant(self) -> str:
        if self._civic_classifier is not None:
            return "fine_tuned_civic_classifier_blip_clip_yolov8n_mobilenetv2"
        return "stock_pretrained_yolov8n_mobilenetv2_blip_clip"

    def _model_note(self) -> str:
        if self._civic_classifier is not None:
            model_name = Path(self._civic_classifier_model_path).name if self._civic_classifier_model_path else "best.pt"
            return (
                "Note: This AI result used the fine-tuned civic classifier ensemble "
                f"('{model_name}') together with BLIP and CLIP validation."
            )
        return self.settings.ai_model_disclaimer

    def analyze_image(self, image_path: str) -> dict[str, Any]:
        logger.info("Analyzing image source=%s", image_path)
        image = self._load_image_from_source(image_path)
        caption = self._generate_caption(image)
        clip_scores, raw_clip_non_civic_score = self._classify_with_clip(image)
        classifier_scores = self._classify_with_civic_classifier(image)
        clip_non_civic_score = self._calibrate_non_civic_score(
            caption=caption,
            clip_scores=clip_scores,
            classifier_scores=classifier_scores,
            raw_non_civic_score=raw_clip_non_civic_score,
        )
        clip_top_issue, clip_top_conf = self._top_clip_category(clip_scores)
        classifier_top_issue, classifier_top_conf = self._top_clip_category(classifier_scores)
        logger.info(
            (
                "Generated caption source=%s caption='%s' clip_top=%s(%.4f) "
                "classifier_top=%s(%.4f) non_civic=%.4f"
            ),
            image_path,
            caption,
            clip_top_issue,
            clip_top_conf,
            classifier_top_issue,
            classifier_top_conf,
            clip_non_civic_score,
        )
        return {
            "source": image_path,
            "caption": caption,
            "clip_scores": clip_scores,
            "classifier_scores": classifier_scores,
            "classifier_top_issue": classifier_top_issue,
            "classifier_top_confidence": round(classifier_top_conf, 4),
            "clip_non_civic_score": round(clip_non_civic_score, 4),
            "custom_classifier_active": self._civic_classifier is not None,
            "custom_classifier_model_path": self._civic_classifier_model_path,
            "model_variant": self._model_variant(),
            "model_note": self._model_note(),
        }

    def analyze_pil_image(self, image: Image.Image, source: str = "memory") -> dict[str, Any]:
        logger.info("Analyzing in-memory image source=%s", source)
        caption = self._generate_caption(image)
        clip_scores, raw_clip_non_civic_score = self._classify_with_clip(image)
        classifier_scores = self._classify_with_civic_classifier(image)
        clip_non_civic_score = self._calibrate_non_civic_score(
            caption=caption,
            clip_scores=clip_scores,
            classifier_scores=classifier_scores,
            raw_non_civic_score=raw_clip_non_civic_score,
        )
        clip_top_issue, clip_top_conf = self._top_clip_category(clip_scores)
        classifier_top_issue, classifier_top_conf = self._top_clip_category(classifier_scores)
        logger.info(
            (
                "Generated caption source=%s caption='%s' clip_top=%s(%.4f) "
                "classifier_top=%s(%.4f) non_civic=%.4f"
            ),
            source,
            caption,
            clip_top_issue,
            clip_top_conf,
            classifier_top_issue,
            classifier_top_conf,
            clip_non_civic_score,
        )
        return {
            "source": source,
            "caption": caption,
            "clip_scores": clip_scores,
            "classifier_scores": classifier_scores,
            "classifier_top_issue": classifier_top_issue,
            "classifier_top_confidence": round(classifier_top_conf, 4),
            "clip_non_civic_score": round(clip_non_civic_score, 4),
            "custom_classifier_active": self._civic_classifier is not None,
            "custom_classifier_model_path": self._civic_classifier_model_path,
            "model_variant": self._model_variant(),
            "model_note": self._model_note(),
        }

    def extract_issue(
        self,
        caption: str,
        clip_scores: dict[str, float] | None = None,
        clip_non_civic_score: float = 0.0,
        classifier_scores: dict[str, float] | None = None,
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

        normalized_clip_scores = self._normalize_category_scores(clip_scores)
        top_clip_category, top_clip_confidence = self._top_clip_category(normalized_clip_scores)
        clip_weight = max(0.0, float(self.settings.hf_clip_score_weight))
        for category, probability in normalized_clip_scores.items():
            # Blend CLIP signal as score contribution so it can rescue weak captions.
            score_by_category[category] = score_by_category.get(category, 0.0) + (probability * clip_weight)

        normalized_classifier_scores = self._normalize_category_scores(classifier_scores)
        top_classifier_category, top_classifier_confidence = self._top_clip_category(normalized_classifier_scores)
        classifier_weight = max(0.0, float(self.settings.civic_classifier_score_weight))
        for category, probability in normalized_classifier_scores.items():
            score_by_category[category] = score_by_category.get(category, 0.0) + (probability * classifier_weight)

        strong_scene_signals = self._collect_strong_scene_signals(
            normalized_caption=normalized_caption,
            clip_scores=normalized_clip_scores,
            classifier_scores=normalized_classifier_scores,
            matched_keywords=matched_keywords,
        )
        for category, has_signal in strong_scene_signals.items():
            if not has_signal:
                continue
            score_by_category[category] = score_by_category.get(category, 0.0) + self._scene_signal_boost(category)

        top_category = "unknown"
        top_score = 0.0
        for category, score in score_by_category.items():
            if score > top_score:
                top_category = category
                top_score = score

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
        has_contextual_signal = has_keyword_signal or any(strong_scene_signals.values())
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
                classifier_scores=normalized_classifier_scores,
            )

        if not has_contextual_signal and (non_civic_score >= 0.42 or non_civic_hits >= 2):
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
                classifier_scores=normalized_classifier_scores,
            )

        if indoor_hits >= 1 and civic_context_hits == 0 and not has_contextual_signal:
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
                classifier_scores=normalized_classifier_scores,
            )

        if (
            all(not hits for hits in matched_keywords.values())
            and top_clip_confidence < float(self.settings.hf_clip_min_confidence)
            and top_classifier_confidence < float(self.settings.civic_classifier_min_confidence)
        ):
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
                classifier_scores=normalized_classifier_scores,
            )

        if all(not hits for hits in matched_keywords.values()):
            required_clip_conf = CATEGORY_MIN_CLIP_CONFIDENCE.get(
                top_category,
                float(self.settings.hf_clip_min_confidence),
            )
            has_classifier_support = top_classifier_category == top_category and (
                top_classifier_confidence >= float(self.settings.civic_classifier_min_confidence)
            )
            if top_clip_confidence < required_clip_conf and not has_classifier_support:
                return IssueExtractionResult(
                    detected_issue="unknown",
                    confidence=0.0,
                    matched_keywords=matched_keywords,
                    score_by_category=score_by_category,
                    clip_scores=normalized_clip_scores,
                    classifier_scores=normalized_classifier_scores,
                )

        ranked_scores = sorted((float(score) for score in score_by_category.values() if score > 0.0), reverse=True)
        second_score = ranked_scores[1] if len(ranked_scores) > 1 else 0.0
        score_margin = max(0.0, top_score - second_score)
        supporting_signal_count = 0
        if matched_keywords.get(top_category):
            supporting_signal_count += 1
        if strong_scene_signals.get(top_category):
            supporting_signal_count += 1
        if top_clip_category == top_category and top_clip_confidence >= CATEGORY_MIN_CLIP_CONFIDENCE.get(
            top_category,
            float(self.settings.hf_clip_min_confidence),
        ):
            supporting_signal_count += 1
        if top_classifier_category == top_category and top_classifier_confidence >= float(
            self.settings.civic_classifier_min_confidence
        ):
            supporting_signal_count += 1

        strong_cross_source_conflict = (
            not matched_keywords.get(top_category)
            and top_clip_category not in {"", "unknown"}
            and top_classifier_category not in {"", "unknown"}
            and top_clip_category != top_classifier_category
            and top_clip_confidence >= float(self.settings.hf_clip_min_confidence)
            and top_classifier_confidence >= float(self.settings.civic_classifier_min_confidence)
        )
        if strong_cross_source_conflict and score_margin < 0.9:
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
                classifier_scores=normalized_classifier_scores,
            )

        if (
            supporting_signal_count <= 1
            and not matched_keywords.get(top_category)
            and not strong_scene_signals.get(top_category)
            and score_margin < 0.45
        ):
            return IssueExtractionResult(
                detected_issue="unknown",
                confidence=0.0,
                matched_keywords=matched_keywords,
                score_by_category=score_by_category,
                clip_scores=normalized_clip_scores,
                classifier_scores=normalized_classifier_scores,
            )

        confidence = self._compute_confidence(
            top_category=top_category,
            score_by_category=score_by_category,
            clip_top_confidence=top_clip_confidence,
            classifier_top_confidence=top_classifier_confidence,
            top_keyword_hits=(
                len(matched_keywords.get(top_category, []))
                + self._scene_signal_keyword_bonus(top_category, strong_scene_signals.get(top_category, False))
            ),
            supporting_signal_count=supporting_signal_count,
            score_margin=score_margin,
            has_source_conflict=strong_cross_source_conflict,
        )
        return IssueExtractionResult(
            detected_issue=top_category,
            confidence=round(confidence, 4),
            matched_keywords=matched_keywords,
            score_by_category=score_by_category,
            clip_scores=normalized_clip_scores,
            classifier_scores=normalized_classifier_scores,
        )

    def validate_category(self, detected_issue: str, reported_category: str) -> bool:
        match_type = self._determine_match_type(detected_issue, reported_category)
        return match_type in {"exact", "related"}

    def generate_reason(
        self,
        detected_issue: str,
        reported_category: str,
        caption: str,
        *,
        clip_scores: dict[str, float] | None = None,
        classifier_scores: dict[str, float] | None = None,
        clip_non_civic_score: float = 0.0,
        match_type: str | None = None,
    ) -> str:
        detected = self._normalize_category(detected_issue)
        reported = self._normalize_category(reported_category)
        resolved_match_type = (match_type or self._determine_match_type(detected, reported)).strip().lower()
        caption_text = caption.strip() if isinstance(caption, str) else ""
        caption_snippet = caption_text if len(caption_text) <= 180 else f"{caption_text[:177]}..."
        clip_top_issue, clip_top_confidence = self._top_clip_category(self._normalize_category_scores(clip_scores))
        classifier_top_issue, classifier_top_confidence = self._top_clip_category(
            self._normalize_category_scores(classifier_scores)
        )
        clip_evidence = f" CLIP top signal: {clip_top_issue} ({clip_top_confidence:.2f})."
        classifier_evidence = ""
        if classifier_top_confidence > 0.0:
            classifier_evidence = (
                f" Fine-tuned civic classifier: {classifier_top_issue} ({classifier_top_confidence:.2f})."
            )
        non_civic_evidence = f" Non-civic scene score: {max(0.0, min(1.0, float(clip_non_civic_score or 0.0))):.2f}."

        if not caption_snippet:
            caption_snippet = "No caption could be generated from the image."

        if detected == "unknown":
            return (
                "The model could not map the image to a supported civic issue category. "
                f"Generated caption: '{caption_snippet}'.{clip_evidence}{classifier_evidence}{non_civic_evidence}"
            )

        if not reported:
            return (
                f"The detected issue is '{detected.replace('_', ' ')}', but the complaint category was empty or invalid."
            )

        if resolved_match_type == "exact":
            return (
                f"The detected issue matches the reported category ('{reported.replace('_', ' ')}'). "
                f"Generated caption: '{caption_snippet}'.{clip_evidence}{classifier_evidence}"
            )

        if resolved_match_type == "related":
            return (
                f"The detected issue '{detected.replace('_', ' ')}' is closely related to the reported "
                f"category '{reported.replace('_', ' ')}', so this is treated as a valid related match. "
                f"Generated caption: '{caption_snippet}'.{clip_evidence}{classifier_evidence}{non_civic_evidence}"
            )

        return (
            f"The image suggests '{detected.replace('_', ' ')}' while the complaint was reported as "
            f"'{reported.replace('_', ' ')}'. Generated caption: '{caption_snippet}'."
            f"{clip_evidence}{classifier_evidence}{non_civic_evidence}"
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
        clip_scores = self._normalize_category_scores(analysis.get("clip_scores"))
        classifier_scores = self._normalize_category_scores(analysis.get("classifier_scores"))
        clip_non_civic_score = float(analysis.get("clip_non_civic_score") or 0.0)
        extraction = self.extract_issue(
            caption,
            clip_scores=clip_scores,
            clip_non_civic_score=clip_non_civic_score,
            classifier_scores=classifier_scores,
        )

        normalized_reported = self._normalize_category(reported_category)
        if normalized_reported and normalized_reported not in SUPPORTED_CATEGORIES:
            return self._build_unsupported_category_result(
                reported_category=normalized_reported,
                caption=caption,
                clip_scores=extraction.clip_scores,
                classifier_scores=extraction.classifier_scores,
                clip_non_civic_score=clip_non_civic_score,
            )

        match_type = self._determine_match_type(extraction.detected_issue, normalized_reported)
        is_valid = match_type in {"exact", "related"}
        reason = self.generate_reason(
            extraction.detected_issue,
            normalized_reported,
            caption,
            clip_scores=extraction.clip_scores,
            classifier_scores=extraction.classifier_scores,
            clip_non_civic_score=clip_non_civic_score,
            match_type=match_type,
        )
        keyword_hits = extraction.matched_keywords.get(extraction.detected_issue, [])
        clip_top_issue, clip_top_confidence = self._top_clip_category(extraction.clip_scores)
        classifier_top_issue, classifier_top_confidence = self._top_clip_category(extraction.classifier_scores)

        logger.info(
            (
                "Validation complete source=%s detected=%s reported=%s valid=%s "
                "confidence=%.4f match_type=%s clip_top=%s(%.4f) classifier_top=%s(%.4f) non_civic=%.4f"
            ),
            image_path,
            extraction.detected_issue,
            normalized_reported,
            is_valid,
            extraction.confidence,
            match_type,
            clip_top_issue,
            clip_top_confidence,
            classifier_top_issue,
            classifier_top_confidence,
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
            "classifier_scores": extraction.classifier_scores,
            "classifier_top_issue": classifier_top_issue,
            "classifier_top_confidence": round(classifier_top_confidence, 4),
            "clip_non_civic_score": round(clip_non_civic_score, 4),
            "custom_classifier_active": self._civic_classifier is not None,
            "custom_classifier_model_path": self._civic_classifier_model_path,
            "model_variant": self._model_variant(),
            "model_note": self._model_note(),
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
        clip_scores = self._normalize_category_scores(analysis.get("clip_scores"))
        classifier_scores = self._normalize_category_scores(analysis.get("classifier_scores"))
        clip_non_civic_score = float(analysis.get("clip_non_civic_score") or 0.0)
        extraction = self.extract_issue(
            caption,
            clip_scores=clip_scores,
            clip_non_civic_score=clip_non_civic_score,
            classifier_scores=classifier_scores,
        )

        normalized_reported = self._normalize_category(reported_category)
        if normalized_reported and normalized_reported not in SUPPORTED_CATEGORIES:
            return self._build_unsupported_category_result(
                reported_category=normalized_reported,
                caption=caption,
                clip_scores=extraction.clip_scores,
                classifier_scores=extraction.classifier_scores,
                clip_non_civic_score=clip_non_civic_score,
            )

        match_type = self._determine_match_type(extraction.detected_issue, normalized_reported)
        is_valid = match_type in {"exact", "related"}
        reason = self.generate_reason(
            extraction.detected_issue,
            normalized_reported,
            caption,
            clip_scores=extraction.clip_scores,
            classifier_scores=extraction.classifier_scores,
            clip_non_civic_score=clip_non_civic_score,
            match_type=match_type,
        )
        keyword_hits = extraction.matched_keywords.get(extraction.detected_issue, [])
        clip_top_issue, clip_top_confidence = self._top_clip_category(extraction.clip_scores)
        classifier_top_issue, classifier_top_confidence = self._top_clip_category(extraction.classifier_scores)

        logger.info(
            (
                "Validation complete source=%s detected=%s reported=%s valid=%s "
                "confidence=%.4f match_type=%s clip_top=%s(%.4f) classifier_top=%s(%.4f) non_civic=%.4f"
            ),
            source,
            extraction.detected_issue,
            normalized_reported,
            is_valid,
            extraction.confidence,
            match_type,
            clip_top_issue,
            clip_top_confidence,
            classifier_top_issue,
            classifier_top_confidence,
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
            "classifier_scores": extraction.classifier_scores,
            "classifier_top_issue": classifier_top_issue,
            "classifier_top_confidence": round(classifier_top_confidence, 4),
            "clip_non_civic_score": round(clip_non_civic_score, 4),
            "custom_classifier_active": self._civic_classifier is not None,
            "custom_classifier_model_path": self._civic_classifier_model_path,
            "model_variant": self._model_variant(),
            "model_note": self._model_note(),
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

    def _classify_with_civic_classifier(self, image: Image.Image) -> dict[str, float]:
        if self._civic_classifier is None:
            return {}

        prepared = image.convert("RGB")
        try:
            results = self._civic_classifier.predict(
                source=prepared,
                imgsz=self.settings.civic_classifier_image_size,
                device="cpu",
                verbose=False,
            )
        except Exception as exc:
            logger.warning("Fine-tuned civic classifier inference failed: %s", exc)
            return {}

        if not results:
            return {}

        result = results[0]
        probs = getattr(result, "probs", None)
        if probs is None or getattr(probs, "data", None) is None:
            return {}

        names = getattr(result, "names", None) or getattr(self._civic_classifier, "names", {}) or {}
        raw_scores = probs.data.detach().cpu().tolist()
        aggregated: dict[str, float] = {}
        for idx, score in enumerate(raw_scores):
            if isinstance(names, dict):
                label = names.get(idx, str(idx))
            elif isinstance(names, (list, tuple)) and 0 <= idx < len(names):
                label = names[idx]
            else:
                label = str(idx)
            category = self._normalize_category(label)
            if category not in SUPPORTED_CATEGORIES:
                continue
            aggregated[category] = max(aggregated.get(category, 0.0), float(score))

        total = sum(aggregated.values())
        if total <= 0.0:
            return {}

        return {
            category: max(0.0, min(1.0, float(score / total)))
            for category, score in aggregated.items()
        }

    def _calibrate_non_civic_score(
        self,
        *,
        caption: str,
        clip_scores: dict[str, float],
        classifier_scores: dict[str, float],
        raw_non_civic_score: float,
    ) -> float:
        normalized_caption = self._normalize_text(caption)
        calibrated = max(0.0, min(1.0, float(raw_non_civic_score or 0.0)))
        strong_scene_signals = self._collect_strong_scene_signals(
            normalized_caption=normalized_caption,
            clip_scores=clip_scores,
            classifier_scores=classifier_scores,
            matched_keywords={},
        )
        for category, has_signal in strong_scene_signals.items():
            if not has_signal:
                continue
            profile = CATEGORY_SIGNAL_PROFILES.get(category, {})
            multiplier = float(profile.get("non_civic_multiplier", 1.0))
            floor = float(profile.get("non_civic_floor", 0.0))
            calibrated = min(calibrated, max(floor, calibrated * multiplier))
        return round(calibrated, 4)

    def _collect_strong_scene_signals(
        self,
        *,
        normalized_caption: str,
        clip_scores: dict[str, float],
        classifier_scores: dict[str, float],
        matched_keywords: dict[str, list[str]] | None,
    ) -> dict[str, bool]:
        return {
            category: self._has_strong_category_scene_signal(
                category=category,
                normalized_caption=normalized_caption,
                clip_scores=clip_scores,
                classifier_scores=classifier_scores,
                matched_hits=(matched_keywords or {}).get(category, []),
            )
            for category in SUPPORTED_CATEGORIES
        }

    def _has_strong_category_scene_signal(
        self,
        *,
        category: str,
        normalized_caption: str,
        clip_scores: dict[str, float],
        classifier_scores: dict[str, float],
        matched_hits: list[str] | tuple[str, ...],
    ) -> bool:
        profile = CATEGORY_SIGNAL_PROFILES.get(category)
        if not profile:
            return False

        clip_value = float(clip_scores.get(category) or 0.0)
        classifier_value = float(classifier_scores.get(category) or 0.0)
        clip_top_issue, clip_top_confidence = self._top_clip_category(clip_scores)
        classifier_top_issue, classifier_top_confidence = self._top_clip_category(classifier_scores)
        context_terms = profile.get("context_terms") or set()
        support_terms = profile.get("support_terms") or set()
        context_hits = self._count_term_hits(normalized_caption, context_terms)
        support_hits = self._count_term_hits(normalized_caption, support_terms)

        explicit_hint = bool(matched_hits) or context_hits >= int(profile.get("context_hit_min", 1))
        clip_support = clip_top_issue == category and max(clip_value, clip_top_confidence) >= float(
            profile.get("clip_threshold", 0.5)
        )
        classifier_support = (
            classifier_top_issue == category
            and max(classifier_value, classifier_top_confidence) >= float(profile.get("classifier_threshold", 0.4))
        )
        hybrid_support = (
            clip_value >= float(profile.get("hybrid_threshold", 0.45))
            and support_hits >= int(profile.get("support_min_hits", 1))
            and context_hits >= int(profile.get("hybrid_context_min", 1))
        )

        if not (clip_support or classifier_support or hybrid_support):
            return False

        return explicit_hint or support_hits >= int(profile.get("support_min_hits", 1))

    @staticmethod
    def _scene_signal_boost(category: str) -> float:
        profile = CATEGORY_SIGNAL_PROFILES.get(category, {})
        return float(profile.get("boost", 0.0))

    @staticmethod
    def _scene_signal_keyword_bonus(category: str, has_signal: bool) -> int:
        if not has_signal:
            return 0
        profile = CATEGORY_SIGNAL_PROFILES.get(category, {})
        return int(profile.get("keyword_bonus", 0))

    def _compute_confidence(
        self,
        top_category: str,
        score_by_category: dict[str, float],
        clip_top_confidence: float = 0.0,
        classifier_top_confidence: float = 0.0,
        top_keyword_hits: int = 0,
        supporting_signal_count: int = 0,
        score_margin: float = 0.0,
        has_source_conflict: bool = False,
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
        classifier_support = max(0.0, min(1.0, float(classifier_top_confidence)))
        agreement_support = min(1.0, max(0.0, float(supporting_signal_count)) / 3.0)
        margin_support = min(1.0, max(0.0, float(score_margin)) / 2.0)
        combined = (
            (softmax_top * 0.28)
            + (strength * 0.16)
            + (max(0.0, min(1.0, clip_top_confidence)) * 0.16)
            + (classifier_support * 0.18)
            + (keyword_support * 0.12)
            + (agreement_support * 0.06)
            + (margin_support * 0.04)
        )

        # Penalize clip-only decisions with no caption keyword support.
        if top_keyword_hits <= 0 and classifier_top_confidence <= 0.0:
            combined *= 0.78
        elif top_keyword_hits <= 0:
            combined *= 0.9
        if has_source_conflict:
            combined *= 0.72
        return max(0.0, min(1.0, combined))

    @staticmethod
    def _normalize_category_scores(raw_scores: Any) -> dict[str, float]:
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
    def _normalize_clip_scores(raw_scores: Any) -> dict[str, float]:
        return ComplaintImageValidationService._normalize_category_scores(raw_scores)

    @staticmethod
    def _top_clip_category(clip_scores: dict[str, float]) -> tuple[str, float]:
        if not clip_scores:
            return "unknown", 0.0
        category, score = max(clip_scores.items(), key=lambda pair: float(pair[1]))
        return category, float(score)

    def _determine_match_type(self, detected_issue: str, reported_category: str) -> str:
        detected = self._normalize_category(detected_issue)
        reported = self._normalize_category(reported_category)

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
            "classifier_scores": {},
            "classifier_top_issue": "unknown",
            "classifier_top_confidence": 0.0,
            "clip_non_civic_score": 0.0,
            "custom_classifier_active": self._civic_classifier is not None,
            "custom_classifier_model_path": self._civic_classifier_model_path,
            "model_variant": self._model_variant(),
            "model_note": self._model_note(),
            "status": "failed",
        }

    def _build_unsupported_category_result(
        self,
        *,
        reported_category: str,
        caption: str,
        clip_scores: dict[str, float],
        classifier_scores: dict[str, float],
        clip_non_civic_score: float,
    ) -> dict[str, Any]:
        clip_top_issue, clip_top_confidence = self._top_clip_category(clip_scores)
        classifier_top_issue, classifier_top_confidence = self._top_clip_category(classifier_scores)
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
            "classifier_scores": classifier_scores,
            "classifier_top_issue": classifier_top_issue,
            "classifier_top_confidence": round(classifier_top_confidence, 4),
            "clip_non_civic_score": round(max(0.0, min(1.0, float(clip_non_civic_score or 0.0))), 4),
            "custom_classifier_active": self._civic_classifier is not None,
            "custom_classifier_model_path": self._civic_classifier_model_path,
            "model_variant": self._model_variant(),
            "model_note": self._model_note(),
            "status": "unsupported_category",
        }
