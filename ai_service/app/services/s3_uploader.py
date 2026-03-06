import asyncio
import logging
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import Settings

logger = logging.getLogger(__name__)


class S3Uploader:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.bucket_name = (settings.aws_bucket_name or "").strip()
        self.region = (settings.aws_region or "").strip()
        self.endpoint_url = (settings.aws_s3_endpoint_url or "").strip() or None
        self.enabled = bool(self.bucket_name and self.region)
        self._client = None

        if not self.enabled:
            logger.warning("S3 uploader disabled: AWS_BUCKET_NAME or AWS_REGION missing.")
            return

        session = boto3.session.Session(
            aws_access_key_id=(settings.aws_access_key_id or "").strip() or None,
            aws_secret_access_key=(settings.aws_secret_access_key or "").strip() or None,
            region_name=self.region,
        )
        self._client = session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
        )

    async def upload_bytes(self, *, data: bytes, key: str, content_type: str = "image/jpeg") -> str | None:
        if not self.enabled or self._client is None:
            return None

        try:
            await asyncio.to_thread(self._upload_sync, data, key, content_type)
            return self._build_public_url(key)
        except (BotoCoreError, ClientError, OSError, ValueError) as exc:
            logger.warning("S3 upload failed for key=%s: %s", key, exc)
            return None

    def _upload_sync(self, data: bytes, key: str, content_type: str) -> None:
        assert self._client is not None
        self._client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=data,
            ContentType=content_type,
            CacheControl="max-age=31536000",
        )

    def _build_public_url(self, key: str) -> str:
        encoded_key = quote(key)
        if self.endpoint_url:
            base = self.endpoint_url.rstrip("/")
            return f"{base}/{self.bucket_name}/{encoded_key}"

        if self.region == "us-east-1":
            return f"https://{self.bucket_name}.s3.amazonaws.com/{encoded_key}"
        return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{encoded_key}"
