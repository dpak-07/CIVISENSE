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
            base_score=base_score,
            image_score=image_score,
            final_score=final_score,
            final_level=final_level,
        )

        if not self.enabled or self._pipeline is None:
            return fallback

        prompt = (
            "Write exactly one clear, non-technical sentence for a municipal dashboard.\n"
            "Explain priority for a civic complaint using these facts:\n"
            f"- reported category: {category}\n"
            f"- detected issue from image: {detected_issue}\n"
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
        base_score: float,
        image_score: float,
        final_score: float,
        final_level: str,
    ) -> str:
        normalized_match = (match_type or "mismatch").strip().lower()
        normalized_status = (validation_status or "").strip().lower()
        level = (final_level or "low").strip().lower()
        level_text = level.capitalize()
        if normalized_status == "unsupported_category":
            message = (
                f"Priority is set to {level_text} based on your report details. "
                "This category will be reviewed manually."
            )
            return message
        elif detected_issue == "unknown" and float(non_civic_score or 0.0) >= 0.8:
            message = (
                f"Priority is set to {level_text}. The uploaded image does not clearly show a civic issue, "
                "so the report text was used."
            )
            if manual_review_required:
                message = f"{message} It has been flagged for manual review."
            return message
        elif normalized_match == "exact":
            return f"Priority is set to {level_text} because the image and reported issue are consistent."
        elif normalized_match == "related":
            message = (
                f"Priority is set to {level_text} because the image shows a related issue category."
            )
            if manual_review_required:
                message = f"{message} It has been flagged for manual review."
            return message
        elif normalized_match == "other":
            return (
                f"Priority is set to {level_text} based on report details. "
                "A general category was selected, so image matching was used only as supporting evidence."
            )
        else:
            message = (
                f"Priority is set to {level_text}. The image appears different from the selected category, "
                "so this report may need manual review."
            )
            if manual_review_required:
                message = f"{message} It has been flagged for manual review."
            return message
