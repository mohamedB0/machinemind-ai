import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import resolve_current_user
from app.models.machine import Machine, Manual

settings = get_settings()
router = APIRouter(prefix="/api/manuals", tags=["manuals"])


@router.get("/{manual_id}/pages/{page_number}")
async def get_manual_page(
    manual_id: uuid.UUID,
    page_number: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Serve a rendered PNG of a manual page (for citations / figure thumbnails).
    Accepts either an Authorization header or ?token= (needed for <img> tags).
    """
    current_user = await resolve_current_user(request, db)

    result = await db.execute(
        select(Manual).where(Manual.id == manual_id)
    )
    manual = result.scalar_one_or_none()
    if not manual:
        raise HTTPException(404, "Manual not found")

    owner_result = await db.execute(
        select(Machine).where(
            Machine.id == manual.machine_id,
            Machine.owner_id == current_user.id,
        )
    )
    if not owner_result.scalar_one_or_none():
        raise HTTPException(404, "Manual not found")

    png = Path(settings.UPLOAD_DIR) / "pages" / str(manual_id) / f"page_{page_number:03d}.png"
    if not png.exists():
        raise HTTPException(404, "Page image not rendered")

    return FileResponse(
        str(png),
        media_type="image/png",
        filename=f"page_{page_number}.png",
    )
