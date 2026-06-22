import asyncio
import uuid
from io import BytesIO
from minio import Minio
from app.core.config import settings

_client: Minio | None = None


def _get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _client


async def _ensure_bucket() -> None:
    client = _get_client()
    bucket = settings.MINIO_BUCKET
    exists = await asyncio.to_thread(client.bucket_exists, bucket)
    if not exists:
        await asyncio.to_thread(client.make_bucket, bucket)
        # allow public read so browsers can load images directly
        policy = (
            '{"Version":"2012-10-17","Statement":[{"Effect":"Allow",'
            '"Principal":"*","Action":["s3:GetObject"],'
            f'"Resource":["arn:aws:s3:::{bucket}/*"]'
            "}]}"
        )
        await asyncio.to_thread(client.set_bucket_policy, bucket, policy)


async def upload_file(data: bytes, content_type: str, folder: str = "uploads") -> str:
    await _ensure_bucket()
    client = _get_client()
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    key = f"{folder}/{uuid.uuid4()}.{ext}"
    await asyncio.to_thread(
        client.put_object,
        settings.MINIO_BUCKET,
        key,
        BytesIO(data),
        len(data),
        content_type=content_type,
    )
    return f"{settings.MINIO_PUBLIC_URL}/{settings.MINIO_BUCKET}/{key}"
