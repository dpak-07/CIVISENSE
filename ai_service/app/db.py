import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

from app.config import Settings

logger = logging.getLogger(__name__)


class MongoDB:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client: AsyncIOMotorClient | None = None
        self.database: AsyncIOMotorDatabase | None = None
        self.complaints: AsyncIOMotorCollection | None = None
        self.sensitive_locations: AsyncIOMotorCollection | None = None
        self.ai_blacklist: AsyncIOMotorCollection | None = None
        self.replica_set_enabled: bool = False
        self.active_mongo_uri: str = settings.mongo_uri

    async def connect(self) -> None:
        self.client = self._build_client(self.settings.mongo_uri)
        self.active_mongo_uri = self.settings.mongo_uri

        try:
            await self.client.admin.command("ping")
        except ServerSelectionTimeoutError as exc:
            if not self.settings.mongo_allow_standalone_fallback or not self._has_replica_set_param(
                self.settings.mongo_uri
            ):
                raise

            fallback_uri = self._to_standalone_uri(self.settings.mongo_uri)
            logger.warning(
                "Mongo replica set URI failed (%s). Falling back to standalone URI for startup: %s",
                exc,
                fallback_uri,
            )

            await self.close()
            self.client = self._build_client(fallback_uri)
            self.active_mongo_uri = fallback_uri
            await self.client.admin.command("ping")

        hello = await self.client.admin.command("hello")
        self.replica_set_enabled = bool(hello.get("setName"))

        if not self.replica_set_enabled:
            logger.warning(
                "MongoDB replica set not detected. Change streams require a replica set; retry worker will continue."
            )

        self.database = self.client[self.settings.mongo_db_name]
        self.complaints = self.database[self.settings.mongo_complaints_collection]
        self.sensitive_locations = self.database[self.settings.mongo_sensitive_locations_collection]
        self.ai_blacklist = self.database[self.settings.mongo_ai_blacklist_collection]
        await self._create_index_safe(
            self.complaints,
            [("priority.aiProcessed", 1), ("priority.aiProcessingStatus", 1), ("createdAt", 1)],
            name="ai_processing_queue_idx",
        )
        await self._create_index_safe(
            self.complaints,
            [("createdAt", -1)],
            name="complaints_created_at_idx",
        )
        await self._create_index_safe(self.ai_blacklist, "userId", unique=True, name="userId_unique")

        logger.info(
            "Connected to MongoDB database=%s replica_set=%s uri=%s",
            self.settings.mongo_db_name,
            self.replica_set_enabled,
            self.active_mongo_uri,
        )

    async def close(self) -> None:
        if self.client is not None:
            self.client.close()
            self.client = None
            logger.info("MongoDB connection closed")

    async def count_pending_complaints(self) -> int:
        if self.complaints is None:
            return 0
        return await self.complaints.count_documents(
            {
                "priority.aiProcessed": False,
                "priority.aiProcessingStatus": "pending",
            }
        )

    async def _create_index_safe(self, collection: AsyncIOMotorCollection, keys, **kwargs) -> None:
        try:
            await collection.create_index(keys, **kwargs)
        except OperationFailure as exc:
            # Existing deployments may already have equivalent index specs with auto-generated names.
            # In that case, skip instead of failing service startup.
            if exc.code == 85 or "already exists with a different name" in str(exc):
                logger.warning(
                    "Index already exists with a different name on %s. Reusing existing index.",
                    collection.name,
                )
                return
            raise

    def _build_client(self, uri: str) -> AsyncIOMotorClient:
        return AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=self.settings.mongo_server_selection_timeout_ms,
            connectTimeoutMS=self.settings.mongo_connect_timeout_ms,
            retryWrites=True,
            appname="civisence-ai-service",
            tz_aware=True,
        )

    @staticmethod
    def _has_replica_set_param(uri: str) -> bool:
        parsed = urlsplit(uri)
        query_items = parse_qsl(parsed.query, keep_blank_values=True)
        return any(key.lower() == "replicaset" for key, _ in query_items)

    @staticmethod
    def _to_standalone_uri(uri: str) -> str:
        parsed = urlsplit(uri)
        query_items = parse_qsl(parsed.query, keep_blank_values=True)
        filtered = [(key, value) for key, value in query_items if key.lower() != "replicaset"]

        if not any(key.lower() == "directconnection" for key, _ in filtered):
            filtered.append(("directConnection", "true"))

        return urlunsplit(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                urlencode(filtered, doseq=True),
                parsed.fragment,
            )
        )
