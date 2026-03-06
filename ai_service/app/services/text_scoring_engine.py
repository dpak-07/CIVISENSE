import re
from dataclasses import dataclass


HIGH_RISK = [
    "accident",
    "injury",
    "electric shock",
    "exposed wire",
    "live wire",
    "fire",
    "spark",
    "severe flooding",
    "waterlogging near school",
    "collapsed road",
    "road cave in",
    "open manhole",
    "sewage overflow",
    "child at risk",
    "ambulance blocked",
]

MEDIUM_RISK = [
    "dangerous",
    "deep pothole",
    "overflow",
    "drain blockage",
    "blocked traffic",
    "streetlight not working",
    "no street light",
    "heavy leakage",
    "garbage pile",
    "stagnant water",
    "broken cover",
    "road damaged",
]

NORMAL_RISK = [
    "pothole",
    "garbage",
    "drainage",
    "leak",
    "broken",
    "damaged",
    "streetlight",
    "water leak",
    "waste",
    "drain",
    "manhole",
]

URGENCY_MARKERS = [
    "urgent",
    "immediately",
    "asap",
    "danger",
    "high risk",
    "very bad",
    "critical",
]

CATEGORY_HINTS: dict[str, list[str]] = {
    "streetlight": ["streetlight", "lamp post", "lamp", "dark road", "no light"],
    "pothole": ["pothole", "road crack", "road damage", "cave in", "asphalt break"],
    "garbage": ["garbage", "waste", "trash", "litter", "dump"],
    "drainage": ["drain", "sewer", "stagnant water", "waterlogging", "overflow"],
    "water_leak": ["leak", "pipe burst", "water leak", "water flow", "broken pipe"],
    "road_damage": ["road damage", "broken road", "crack", "asphalt", "surface damage"],
}

DEFAULT_STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "he",
    "her",
    "his",
    "i",
    "in",
    "is",
    "it",
    "its",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "she",
    "that",
    "the",
    "their",
    "them",
    "there",
    "they",
    "this",
    "to",
    "was",
    "we",
    "were",
    "with",
    "you",
    "your",
}


@dataclass(frozen=True)
class TextScoreResult:
    filtered_text: str
    high_count: int
    medium_count: int
    normal_count: int
    urgency_count: int
    base_score: float
    matched_high: list[str]
    matched_medium: list[str]
    matched_normal: list[str]
    matched_urgency: list[str]
    category_signal: str | None


class TextScoringEngine:
    def __init__(self, stop_words: set[str] | None = None) -> None:
        self.stop_words = stop_words or DEFAULT_STOP_WORDS
        self._high_patterns = self._compile_patterns(HIGH_RISK)
        self._medium_patterns = self._compile_patterns(MEDIUM_RISK)
        self._normal_patterns = self._compile_patterns(NORMAL_RISK)
        self._urgency_patterns = self._compile_patterns(URGENCY_MARKERS)

    def score(
        self,
        title: str | None,
        description: str | None,
        category: str | None = None,
    ) -> TextScoreResult:
        combined = f"{title or ''} {description or ''}".strip().lower()
        filtered_text = self._normalize(combined, remove_stop_words=True)

        high_count, matched_high = self._count_group_matches(filtered_text, self._high_patterns)
        medium_count, matched_medium = self._count_group_matches(filtered_text, self._medium_patterns)
        normal_count, matched_normal = self._count_group_matches(filtered_text, self._normal_patterns)
        urgency_count, matched_urgency = self._count_group_matches(filtered_text, self._urgency_patterns)

        category_bonus, category_signal = self._compute_category_bonus(filtered_text, category)

        raw_score = (
            (high_count * 2.7)
            + (medium_count * 1.6)
            + (normal_count * 0.9)
            + (urgency_count * 0.5)
            + category_bonus
        )
        if high_count >= 2 and medium_count >= 1:
            raw_score += 0.5
        if high_count == 0 and medium_count == 0 and normal_count == 0 and category_bonus <= 0.0:
            raw_score = 0.5

        base_score = float(min(6.0, round(raw_score, 2)))
        return TextScoreResult(
            filtered_text=filtered_text,
            high_count=high_count,
            medium_count=medium_count,
            normal_count=normal_count,
            urgency_count=urgency_count,
            base_score=base_score,
            matched_high=matched_high,
            matched_medium=matched_medium,
            matched_normal=matched_normal,
            matched_urgency=matched_urgency,
            category_signal=category_signal,
        )

    def _compute_category_bonus(self, filtered_text: str, category: str | None) -> tuple[float, str | None]:
        normalized_category = self._normalize_category(category)
        if not normalized_category:
            return 0.0, None

        hints = CATEGORY_HINTS.get(normalized_category, [])
        if not hints:
            phrase = normalized_category.replace("_", " ")
            if phrase and phrase in filtered_text:
                return 0.4, f"category_match:{normalized_category}"
            return 0.0, None

        hint_patterns = self._compile_patterns(hints)
        hit_count, hit_keywords = self._count_group_matches(filtered_text, hint_patterns)
        if hit_count > 0:
            bonus = min(1.2, 0.35 * hit_count)
            return bonus, f"category_match:{normalized_category};hits={','.join(hit_keywords)}"

        phrase = normalized_category.replace("_", " ")
        if phrase and phrase in filtered_text:
            return 0.45, f"category_label_present:{normalized_category}"
        return 0.0, None

    def _compile_patterns(self, keywords: list[str]) -> list[tuple[str, re.Pattern[str]]]:
        patterns: list[tuple[str, re.Pattern[str]]] = []
        for keyword in keywords:
            normalized = self._normalize(keyword, remove_stop_words=True)
            if not normalized:
                continue
            escaped = re.escape(normalized).replace(r"\ ", r"\s+")
            patterns.append((keyword, re.compile(rf"(?<!\w){escaped}(?!\w)")))
        return patterns

    def _normalize(self, text: str, remove_stop_words: bool) -> str:
        tokens = re.findall(r"[a-z0-9]+", text.lower())
        if remove_stop_words:
            tokens = [token for token in tokens if token not in self.stop_words]
        return " ".join(tokens)

    @staticmethod
    def _normalize_category(category: str | None) -> str:
        if not isinstance(category, str):
            return ""
        value = category.strip().lower()
        if not value:
            return ""
        return value.replace("-", "_").replace(" ", "_")

    @staticmethod
    def _count_group_matches(
        text: str,
        patterns: list[tuple[str, re.Pattern[str]]],
    ) -> tuple[int, list[str]]:
        matched_keywords: list[str] = []
        for keyword, pattern in patterns:
            if pattern.search(text):
                matched_keywords.append(keyword)
        return len(matched_keywords), matched_keywords
