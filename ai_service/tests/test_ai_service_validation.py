import unittest

from app.config import Settings
from app.services.ai_service import ComplaintImageValidationService


class ComplaintImageValidationServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        settings = Settings(
            MONGO_URI="mongodb://localhost:27017",
            HF_CLIP_SCORE_WEIGHT=3.0,
            HF_CLIP_MIN_CONFIDENCE=0.28,
            CIVIC_CLASSIFIER_SCORE_WEIGHT=4.2,
            CIVIC_CLASSIFIER_MIN_CONFIDENCE=0.5,
        )
        self.service = ComplaintImageValidationService(settings)

    def test_classifier_can_rescue_weak_caption_signal(self) -> None:
        result = self.service.extract_issue(
            caption="public road near junction",
            clip_scores={"pothole": 0.24, "road_damage": 0.18},
            classifier_scores={"pothole": 0.84, "road_damage": 0.08},
            clip_non_civic_score=0.05,
        )

        self.assertEqual(result.detected_issue, "pothole")
        self.assertGreater(result.confidence, 0.5)

    def test_conflicting_clip_and_classifier_returns_unknown_when_ambiguous(self) -> None:
        result = self.service.extract_issue(
            caption="public street near intersection",
            clip_scores={"traffic_sign": 0.58, "road_damage": 0.30},
            classifier_scores={"garbage": 0.66, "traffic_sign": 0.10},
            clip_non_civic_score=0.04,
        )

        self.assertEqual(result.detected_issue, "unknown")
        self.assertEqual(result.confidence, 0.0)

    def test_non_civic_scene_is_rejected_even_with_classifier_signal(self) -> None:
        result = self.service.extract_issue(
            caption="laptop on office desk near keyboard",
            clip_scores={"garbage": 0.26},
            classifier_scores={"garbage": 0.81},
            clip_non_civic_score=0.9,
        )

        self.assertEqual(result.detected_issue, "unknown")
        self.assertEqual(result.confidence, 0.0)

    def test_reason_mentions_mismatch_and_classifier_evidence(self) -> None:
        result = self.service.extract_issue(
            caption="public road near junction",
            clip_scores={"pothole": 0.21},
            classifier_scores={"pothole": 0.79, "road_damage": 0.11},
            clip_non_civic_score=0.03,
        )

        self.assertEqual(result.detected_issue, "pothole")
        match_type = self.service._determine_match_type(result.detected_issue, "garbage")
        self.assertEqual(match_type, "mismatch")
        reason = self.service.generate_reason(
            detected_issue=result.detected_issue,
            reported_category="garbage",
            caption="public road near junction",
            clip_scores=result.clip_scores,
            classifier_scores=result.classifier_scores,
            clip_non_civic_score=0.03,
            match_type=match_type,
        )

        self.assertIn("reported as 'garbage'", reason)
        self.assertIn("fine-tuned civic classifier", reason.lower())


if __name__ == "__main__":
    unittest.main()
