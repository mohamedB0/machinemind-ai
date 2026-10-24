import asyncio
import hashlib
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.machine import Machine, Manual, IngestionStatus
from app.models.user import User
from app.schemas.schemas import MachineCreate, MachineRead, ManualRead
from app.services.ingestion import run_ingestion, compute_file_hash

settings = get_settings()
router = APIRouter(prefix="/api/machines", tags=["machines"])
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("", response_model=MachineRead, status_code=201)
async def create_machine(
    data: MachineCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    machine = Machine(owner_id=current_user.id, **data.model_dump())
    db.add(machine)
    await db.commit()
    await db.refresh(machine)
    return {**machine.__dict__, "manual_count": 0}


@router.get("", response_model=list[MachineRead])
async def list_machines(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Machine).where(Machine.owner_id == current_user.id))
    machines = result.scalars().all()
    out = []
    for m in machines:
        count_res = await db.execute(
            select(func.count()).where(Manual.machine_id == m.id)
        )
        count = count_res.scalar() or 0
        out.append({**m.__dict__, "manual_count": count})
    return out


@router.get("/{machine_id}", response_model=MachineRead)
async def get_machine(
    machine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Machine).where(Machine.id == machine_id, Machine.owner_id == current_user.id)
    )
    machine = result.scalar_one_or_none()
    if not machine:
        raise HTTPException(404, "Machine not found")
    count_res = await db.execute(select(func.count()).where(Manual.machine_id == machine_id))
    count = count_res.scalar() or 0
    return {**machine.__dict__, "manual_count": count}


@router.post("/{machine_id}/manuals", response_model=ManualRead, status_code=201)
async def upload_manual(
    machine_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify machine ownership
    result = await db.execute(
        select(Machine).where(Machine.id == machine_id, Machine.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Machine not found")

    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")

    # Read file
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit")

    # Check magic bytes (PDF signature)
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(400, "Invalid PDF file signature")

    # Hash for dedup check
    file_hash = compute_file_hash(file_bytes)
    existing = await db.execute(
        select(Manual).where(Manual.machine_id == machine_id, Manual.file_hash == file_hash)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "This document has already been uploaded for this machine")

    # Save to disk
    safe_name = f"{uuid.uuid4()}.pdf"
    dest = UPLOAD_DIR / safe_name
    dest.write_bytes(file_bytes)

    # Create manual record
    manual = Manual(
        machine_id=machine_id,
        filename=safe_name,
        original_filename=file.filename,
        file_size=len(file_bytes),
        file_hash=file_hash,
        status=IngestionStatus.pending,
    )
    db.add(manual)
    await db.commit()
    await db.refresh(manual)

    # Trigger ingestion in background
    manual_id = str(manual.id)
    background_tasks.add_task(_run_ingestion_task, manual_id, str(dest))

    return manual


async def _run_ingestion_task(manual_id: str, file_path: str):
    """Runs ingestion in a new DB session (background task)."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        await run_ingestion(manual_id, file_path, db)


@router.get("/{machine_id}/manuals", response_model=list[ManualRead])
async def list_manuals(
    machine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(Machine).where(Machine.id == machine_id, Machine.owner_id == current_user.id)
    )
    if not res.scalar_one_or_none():
        raise HTTPException(404, "Machine not found")

    result = await db.execute(select(Manual).where(Manual.machine_id == machine_id))
    return result.scalars().all()


@router.get("/{machine_id}/manuals/{manual_id}", response_model=ManualRead)
async def get_manual(
    machine_id: uuid.UUID,
    manual_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(Machine).where(Machine.id == machine_id, Machine.owner_id == current_user.id)
    )
    if not res.scalar_one_or_none():
        raise HTTPException(404, "Machine not found")

    result = await db.execute(
        select(Manual).where(Manual.id == manual_id, Manual.machine_id == machine_id)
    )
    manual = result.scalar_one_or_none()
    if not manual:
        raise HTTPException(404, "Manual not found")
    return manual
