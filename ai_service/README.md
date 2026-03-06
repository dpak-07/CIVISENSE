# CiviSense AI Decision Engine Service

Independent FastAPI microservice for complaint AI prioritization.

## Image Category Validation (BLIP)

The service now includes an explainable image-category validation layer:

- Uses `Salesforce/blip-image-captioning-base` (HuggingFace, CPU inference).
- Generates a caption from complaint images (S3 URL or local path).
- Maps caption keywords to civic categories:
  - `pothole`
  - `garbage`
  - `drainage`
  - `water_leak`
  - `streetlight`
  - `road_damage`
- Compares detected issue vs reported category.
- Stores structured output in `complaints.aiMeta.categoryValidation`.

Validation JSON shape:

```json
{
  "detected_issue": "pothole",
  "reported_category": "garbage",
  "is_valid": false,
  "confidence": 0.87,
  "reason": "The image suggests pothole while the complaint was reported as garbage.",
  "caption": "large pothole in the middle of the road",
  "keyword_hits": ["pothole", "road hole"],
  "status": "ok"
}
```

Environment variables:

- `HF_CAPTION_MODEL_NAME` (default: `Salesforce/blip-image-captioning-base`)
- `HF_CAPTION_MAX_NEW_TOKENS` (default: `32`)
- `HF_CAPTION_NUM_BEAMS` (default: `3`)
- `CATEGORY_VALIDATION_REVIEW_CONFIDENCE` (default: `0.6`)

## Setup

1. Open terminal in `ai_service`.
2. Use Python 3.11 or 3.12 (Python 3.14 is not supported by current ML wheels).
3. Recommended one-command setup:
```powershell
.\setup.ps1
```
If an older `.venv` is locked/in use, the script will create a fallback environment like `.venv312`.

To leave an activated virtual environment in PowerShell, use:
```powershell
deactivate
```
4. Or manual setup: create and activate virtual environment:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
5. Install dependencies:
```powershell
python -m pip install --upgrade pip
pip install --only-binary=:all: -r requirements.txt
```
6. Configure environment:
```powershell
Copy-Item .env.example .env
```
For local standalone MongoDB, keep `MONGO_ALLOW_STANDALONE_FALLBACK=true` so a replica-set URI can automatically fall back to direct connection.

7. Run service:
```powershell
uvicorn app.main:app --reload
```

## Strict MongoDB Update Contract

This service updates only:

- `severityScore`
- `priority.score`
- `priority.level`
- `priority.reason`
- `priority.aiProcessed`
- `priority.aiProcessingStatus`

No routing, status, workload, duplicate, or assignment fields are modified.

## Auto Training From S3 Images

You can continuously build a category dataset from complaint image URLs and auto-train a YOLO classification model when enough images are available.

Run once:
```powershell
python scripts/auto_train_from_s3.py --min-images-per-class 50 --min-total-images 300
```

Run continuously every 30 minutes:
```powershell
python scripts/auto_train_from_s3.py --loop-seconds 1800 --min-images-per-class 50 --min-total-images 300
```

Run every Sunday at 12:00 AM (local system time):
```powershell
python scripts/auto_train_from_s3.py --weekly-sunday-midnight --min-images-per-class 50 --min-total-images 300
```

Important notes:
- This script trains a **classification** model (`yolov8n-cls.pt`) using complaint category labels.
- Complaint labels can be noisy; review/clean samples before using trained weights in production.
- Training runs and state are stored under:
  - `training_runs/`
  - `training_data/train_state.json`
