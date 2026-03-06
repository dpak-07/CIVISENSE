import asyncio
import logging
import re
from typing import Any

from transformers import pipeline

from app.config import Settings

logger = logging.getLogger(__name__)


class PriorityReasoningService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.enabled = bool(settings.reason_nlp_enabled)
        self._pipeline = None

    async def load_model(self) -> None:
        if not self.enabled:
            logger.info("Priority NLP reason generator disabled by configuration")
            return
        await asyncio.to_thread(self._load_model_sync)

    def _load_model_sync(self) -> None:
        if self._pipeline is not None:
            return
        logger.info(
            "Loading NLP reason model '%s' on CPU",
            self.settings.hf_reason_model_name,
        )
        self._pipeline = pipeline(
            "text2text-generation",
            model=self.settings.hf_reason_model_name,
            tokenizer=self.settings.hf_reason_model_name,
            device=-1,
        )
        logger.info("NLP reason model loaded")

    def generate_reason(
        self,
        *,
        category: str,
        detected_issue: str,
        match_type: str,
        confidence: float,
        validation_status: str,
        non_civic_score: float,
        manual_review_required: bool,
        scene_summary: str | None,
        base_score: float,
        image_score: float,
        final_score: float,
        final_level: str,
    ) -> str:
        fallback = self._build_fallback_reason(
            category=category,
            detected_issue=detected_issue,
            match_type=match_type,
            confidence=confidence,
            validation_status=validation_status,
            non_civic_score=non_civic_score,
            manual_review_required=manual_review_required,
            scene_summary=scene_summary,
            base_score=base_score,
            image_score=image_score,
            final_score=final_score,
            final_level=final_level,
        )

        # Keep mismatch/manual-review wording deterministic so the user sees
        # exactly what the AI appeared to find in the image.
        if scene_summary and (
            manual_review_required
            or detected_issue == "unknown"
            or (match_type or "").strip().lower() == "mismatch"
        ):
            return fallback

        if not self.enabled or self._pipeline is None:
            return fallback

        prompt = (
            "Write exactly one clear, non-technical sentence for a municipal dashboard.\n"
            "Explain priority for a civic complaint using these facts:\n"
            f"- reported category: {category}\n"
            f"- detected issue from image: {detected_issue}\n"
            f"- plain description of what the image shows: {scene_summary or 'not available'}\n"
            f"- category match type: {match_type}\n"
            f"- validation status: {validation_status}\n"
            f"- manual review required: {bool(manual_review_required)}\n"
            f"- image confidence: {confidence:.2f}\n"
            f"- non-civic scene score: {non_civic_score:.2f}\n"
            f"- base score: {base_score:.2f}\n"
            f"- image score contribution: {image_score:+.2f}\n"
            f"- final score: {final_score:.2f}\n"
            f"- final level: {final_level.upper()}\n"
            "Do not include bullet points, labels, or the word 'rules'."
        )

        try:
            result = self._pipeline(
                prompt,
                max_new_tokens=max(24, int(self.settings.hf_reason_max_new_tokens)),
                do_sample=False,
            )
            text = ""
            if isinstance(result, list) and result:
                text = str(result[0].get("generated_text") or "").strip()
            text = self._clean_generated_text(text)
            text = self._extract_first_sentence(text)
            text = self._sanitize_user_reason(text)
            if text and not self._is_low_quality(text):
                return text
        except Exception as exc:
            logger.warning("NLP reason generation failed, using fallback: %s", exc)

        return fallback

    @staticmethod
    def _clean_generated_text(text: str) -> str:
        cleaned = re.sub(r"\s+", " ", str(text or "").strip())
        return cleaned[:360].rstrip()

    @staticmethod
    def _extract_first_sentence(text: str) -> str:
        candidate = str(text or "").strip()
        if not candidate:
            return ""
        # Prefer a single sentence for predictable dashboard display.
        sentence = re.split(r"(?<=[.!?])\s+", candidate, maxsplit=1)[0].strip()
        return sentence[:320].rstrip()

    @staticmethod
    def _is_low_quality(text: str) -> bool:
        candidate = str(text or "").strip().lower()
        if not candidate:
            return True

        words = [token for token in re.findall(r"[a-z0-9']+", candidate) if token]
        if len(words) < 10:
            return True

        unique_ratio = len(set(words)) / max(1, len(words))
        if unique_ratio < 0.35:
            return True

        prompt_leak_markers = [
            "rules:",
            "keep it factual",
            "municipal dashboard",
            "reported category:",
            "detected issue from image:",
            "final level:",
            "write exactly one",
        ]
        if any(marker in candidate for marker in prompt_leak_markers):
            return True

        if re.match(r"^(low|medium|high)\s+rules\b", candidate):
            return True

        technical_markers = [
            "confidence",
            "score",
            "clip",
            "non-civic",
            "detected",
            "reported",
            "match type",
        ]
        if any(marker in candidate for marker in technical_markers):
            return True

        repeated_markers = [
            "municipal dashboard",
            "- a municipal dashboard",
        ]
        if any(marker in candidate for marker in repeated_markers):
            return True

        return False

    @staticmethod
    def _sanitize_user_reason(text: str) -> str:
        sentence = str(text or "").strip()
        if not sentence:
            return ""
        sentence = re.sub(r"\s+", " ", sentence).strip()
        sentence = re.sub(r"\([^)]*\)", "", sentence).strip()
        sentence = re.sub(r"\b(score|confidence|clip|non-civic)\b[^.]*", "", sentence, flags=re.IGNORECASE).strip()
        sentence = re.sub(r"\s{2,}", " ", sentence).strip(" ;,")
        if sentence and sentence[-1] not in ".!?":
            sentence = f"{sentence}."
        return sentence[:220].strip()

    @staticmethod
    def _build_fallback_reason(
        *,
        category: str,
        detected_issue: str,
        match_type: str,
        confidence: float,
        validation_status: str,
        non_civic_score: float,
        manual_review_required: bool,
        scene_summary: str | None,
        base_score: float,
        image_score: float,
        final_score: float,
        final_level: str,
    ) -> str:
        normalized_match = (match_type or "mismatch").strip().lower()
        normalized_status = (validation_status or "").strip().lower()
        level = (final_level or "low").strip().lower()
        level_text = level.capitalize()
        category_label = PriorityReasoningService._format_category_label(category)
        detected_label = PriorityReasoningService._format_category_label(detected_issue)
        detected_phrase = PriorityReasoningService._format_issue_phrase(detected_label)
        scene_label = PriorityReasoningService._format_scene_summary(scene_summary)
        if normalized_status == "unsupported_category":
            message = (
                f"Priority is set to {level_text} based on your report details. "
                "This category will be reviewed manually."
            )
            return message
        elif detected_issue == "unknown" and scene_label:
            message = (
                f"Priority is set to {level_text}. AI predicted the image shows {scene_label}, "
                f"not the reported {category_label} issue."
            )
            if manual_review_required:
                message = f"{message} Please wait for manual review."
            return message
        elif detected_issue == "unknown" and float(non_civic_score or 0.0) >= 0.8:
            message = (
                f"Priority is set to {level_text}. The uploaded image does not clearly show a civic issue, "
                "so the report text was used."
            )
            if manual_review_required:
                message = f"{message} Please wait for manual review."
            return message
        elif normalized_match == "exact":
            if scene_label:
                return (
                    f"Priority is set to {level_text}. AI predicted the image shows {scene_label}, "
                    f"which matches the reported {category_label} issue."
                )
            return f"Priority is set to {level_text} because the image and reported issue are consistent."
        elif normalized_match == "related":
            if scene_label:
                message = (
                    f"Priority is set to {level_text}. AI predicted the image shows {scene_label}, "
                    f"which is related to the reported {category_label} issue."
                )
            else:
                message = (
                    f"Priority is set to {level_text} because the image shows a related issue category."
                )
            if manual_review_required:
                message = f"{message} Please wait for manual review."
            return message
        else:
            if scene_label:
                if detected_label and detected_label != "unknown":
                    message = (
                        f"Priority is set to {level_text}. AI predicted the image shows {scene_label}, "
                        f"which looks closer to {detected_phrase} than the reported {category_label} issue."
                    )
                else:
                    message = (
                        f"Priority is set to {level_text}. AI predicted the image shows {scene_label}, "
                        f"not the reported {category_label} issue."
                    )
            elif detected_label and detected_label != "unknown":
                message = (
                    f"Priority is set to {level_text}. AI predicted {detected_phrase}, "
                    f"not the reported {category_label} issue."
                )
            else:
                message = (
                    f"Priority is set to {level_text}. The image appears different from the selected category."
                )
            if manual_review_required:
                message = f"{message} Please wait for manual review."
            return message

    @staticmethod
    def _format_category_label(value: str) -> str:
        label = re.sub(r"[_\s]+", " ", str(value or "").strip().lower()).strip()
        return label or "unknown"

    @staticmethod
    def _format_scene_summary(scene_summary: str | None) -> str | None:
        summary = re.sub(r"\s+", " ", str(scene_summary or "").strip().lower()).strip(" .,;:")
        if not summary:
            return None

        starters = {"a", "an", "the", "two", "three", "four", "several", "multiple", "many"}
        first_word = summary.split()[0]
        if first_word not in starters and not first_word.isdigit() and not first_word.endswith("s"):
            summary = f"a {summary}"
        return summary

    @staticmethod
    def _format_issue_phrase(issue_label: str) -> str:
        label = str(issue_label or "").strip().lower()
        if not label or label == "unknown":
            return "unknown issue"
        starters = {"a", "an", "the"}
        first_word = label.split()[0]
        if first_word in starters or first_word.endswith("s"):
            return label
        return f"a {label}"
