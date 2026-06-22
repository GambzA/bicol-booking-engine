from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.core.deps import get_current_admin
from app.core.storage import upload_file
from app.models.platform_admin import PlatformAdmin

router = APIRouter(prefix="/upload", tags=["admin-upload"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("")
async def upload_media(
    file: UploadFile = File(...),
    folder: str = "properties",
    admin: PlatformAdmin = Depends(get_current_admin),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, WebP, and GIF images are accepted.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 10 MB limit.")
    url = await upload_file(data, file.content_type, folder)
    return {"url": url}
