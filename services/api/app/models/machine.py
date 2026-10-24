import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


class IngestionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    error = "error"


class Machine(Base):
    __tablename__ = "machines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    manufacturer: Mapped[str] = mapped_column(String(255), nullable=True)
    model_number: Mapped[str] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner: Mapped["User"] = relationship("User", back_populates="machines")
    manuals: Mapped[list["Manual"]] = relationship("Manual", back_populates="machine", cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship("Conversation", back_populates="machine")


class Manual(Base):
    __tablename__ = "manuals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=True)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    page_count: Mapped[int] = mapped_column(Integer, nullable=True)
    language: Mapped[str] = mapped_column(String(10), nullable=True)
    version: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[IngestionStatus] = mapped_column(
        SAEnum(IngestionStatus), default=IngestionStatus.pending, nullable=False
    )
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    machine: Mapped["Machine"] = relationship("Machine", back_populates="manuals")
    pages: Mapped[list["DocumentPage"]] = relationship("DocumentPage", back_populates="manual", cascade="all, delete-orphan")
    chunks: Mapped[list["DocumentChunk"]] = relationship("DocumentChunk", back_populates="manual", cascade="all, delete-orphan")


class DocumentPage(Base):
    __tablename__ = "document_pages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    manual_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("manuals.id"), nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    text_content: Mapped[str] = mapped_column(Text, nullable=True)
    needs_ocr: Mapped[bool] = mapped_column(default=False)
    has_figure: Mapped[bool] = mapped_column(default=False)

    manual: Mapped["Manual"] = relationship("Manual", back_populates="pages")
