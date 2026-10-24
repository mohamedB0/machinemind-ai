import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.machine import Machine, Manual, IngestionStatus
from app.models.rag import Conversation, Message
from app.models.user import User
from app.schemas.schemas import ConversationCreate, ConversationRead, ChatRequest, ChatResponse, MessageRead
from app.services.rag import generate_answer

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.post("", response_model=ConversationRead, status_code=201)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify user owns the machine
    res = await db.execute(
        select(Machine).where(Machine.id == data.machine_id, Machine.owner_id == current_user.id)
    )
    if not res.scalar_one_or_none():
        raise HTTPException(404, "Machine not found")

    conv = Conversation(
        user_id=current_user.id,
        machine_id=data.machine_id,
        title=data.title or "New Conversation",
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("", response_model=list[ConversationRead])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/{conversation_id}/messages", response_model=list[MessageRead])
async def get_messages(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()


@router.post("/{conversation_id}/messages", response_model=ChatResponse)
async def send_message(
    conversation_id: uuid.UUID,
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Load conversation
    res = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    if not conv.machine_id:
        raise HTTPException(400, "Conversation has no associated machine")

    # Check manual is ready (if specified)
    if data.manual_id:
        man_res = await db.execute(
            select(Manual).where(
                Manual.id == data.manual_id,
                Manual.machine_id == conv.machine_id,
            )
        )
        manual = man_res.scalar_one_or_none()
        if not manual:
            raise HTTPException(404, "Manual not found for this machine")
        if manual.status != IngestionStatus.completed:
            raise HTTPException(400, f"Manual is not ready (status: {manual.status.value})")

    # Load recent history
    hist_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(12)
    )
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(hist_result.scalars().all())
    ]

    # Save user message
    user_msg = Message(
        conversation_id=conversation_id,
        role="user",
        content=data.question,
    )
    db.add(user_msg)
    await db.flush()

    # Run RAG pipeline
    rag_result = await generate_answer(
        question=data.question,
        machine_id=str(conv.machine_id),
        conversation_history=history,
        db=db,
        manual_id=str(data.manual_id) if data.manual_id else None,
    )

    # Save assistant message
    assistant_msg = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=rag_result["answer"],
        sources=rag_result["sources"],
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatResponse(
        message_id=assistant_msg.id,
        answer=rag_result["answer"],
        sources=rag_result["sources"],
        confidence=rag_result["confidence"],
        chunks_used=rag_result["chunks_used"],
    )
