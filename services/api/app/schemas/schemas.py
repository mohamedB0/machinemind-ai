from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Machine ──────────────────────────────────────────────────────────────────

class MachineCreate(BaseModel):
    name: str
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    description: Optional[str] = None


class MachineRead(BaseModel):
    id: uuid.UUID
    name: str
    manufacturer: Optional[str]
    model_number: Optional[str]
    description: Optional[str]
    owner_id: uuid.UUID
    created_at: datetime
    manual_count: int = 0

    model_config = {"from_attributes": True}


# ── Manual ───────────────────────────────────────────────────────────────────

class ManualRead(BaseModel):
    id: uuid.UUID
    machine_id: uuid.UUID
    original_filename: str
    file_size: Optional[int]
    page_count: Optional[int]
    language: Optional[str]
    version: Optional[str]
    status: str
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Conversation ─────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    machine_id: uuid.UUID
    title: Optional[str] = None


class ConversationRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    machine_id: Optional[uuid.UUID]
    title: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Message / Chat ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    manual_id: Optional[uuid.UUID] = None


class SourceCitation(BaseModel):
    chunk_id: str
    manual_id: str
    page_start: Optional[int]
    page_end: Optional[int]
    section_title: Optional[str]
    content_type: Optional[str]
    score: float
    excerpt: str


class ChatResponse(BaseModel):
    message_id: uuid.UUID
    answer: str
    sources: list[SourceCitation]
    confidence: str  # high | partial | none
    chunks_used: int


class MessageRead(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    sources: Optional[list] = None
    created_at: datetime

    model_config = {"from_attributes": True}
