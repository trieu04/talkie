from __future__ import annotations

from io import BytesIO
from typing import Final

from minio import Minio
from minio.error import S3Error

from src.core.config import settings


class StorageError(Exception):
    pass


class MinIOStorage:
    def __init__(self) -> None:
        self.bucket_name: str = settings.minio_bucket_name
        self._client: Final[Minio] = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )

    async def ensure_bucket(self) -> None:
        import asyncio

        exists = await asyncio.to_thread(self._client.bucket_exists, self.bucket_name)
        if not exists:
            await asyncio.to_thread(self._client.make_bucket, self.bucket_name)

    async def upload_bytes(self, object_name: str, data: bytes, content_type: str) -> None:
        import asyncio

        buffer = BytesIO(data)
        try:
            _ = await asyncio.to_thread(
                self._client.put_object,
                self.bucket_name,
                object_name,
                buffer,
                len(data),
                content_type=content_type,
            )
        except S3Error as exc:
            raise StorageError(str(exc)) from exc

    async def download_bytes(self, object_name: str) -> bytes:
        import asyncio

        try:
            response = await asyncio.to_thread(
                self._client.get_object, self.bucket_name, object_name
            )
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()
        except S3Error as exc:
            raise StorageError(str(exc)) from exc


storage = MinIOStorage()
