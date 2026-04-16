from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Tuple
from database import get_db
import models, schemas
from auth import get_current_active_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _role_value(role) -> str:
    return role.value if hasattr(role, "value") else str(role)


def _parse_thread_id(thread_id: str) -> Tuple[str, int]:
    # format: "<chat_type>:<chat_ref_id>"
    if ":" not in thread_id:
        raise HTTPException(status_code=400, detail="Invalid thread_id format")
    t, ref = thread_id.split(":", 1)
    if t not in {"support", "event", "mentor"}:
        raise HTTPException(status_code=400, detail="Unsupported thread type")
    try:
        ref_id = int(ref)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread ref id")
    return t, ref_id


def _can_access_thread(user: models.User, chat_type: str, ref_id: int, db: Session) -> bool:
    role = _role_value(user.role)
    if chat_type == "support":
        # ref_id = requester_id
        return role == "admin" or user.id == ref_id
    if chat_type == "event":
        # ref_id = event_id, доступ участникам события и админу
        if role == "admin":
            return True
        booking = db.query(models.Booking).filter(
            models.Booking.user_id == user.id,
            models.Booking.event_id == ref_id
        ).first()
        return booking is not None
    if chat_type == "mentor":
        # ref_id = mentor_request_id, доступ ментору/студенту/админу
        if role == "admin":
            return True
        mr = db.query(models.MentorRequest).filter(models.MentorRequest.id == ref_id).first()
        if not mr:
            return False
        return mr.student_id == user.id or mr.mentor_id == user.id
    return False


@router.get("/threads", response_model=List[schemas.ChatThreadOut])
def list_threads(
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    role = _role_value(current_user.role)
    threads: List[schemas.ChatThreadOut] = []

    # 1) Support thread(s)
    if role == "admin":
        requester_ids = db.query(models.AdminSupportMessage.requester_id).distinct().all()
        for (rid,) in requester_ids:
            requester = db.query(models.User).filter(models.User.id == rid).first()
            title = requester.full_name if requester and requester.full_name else (requester.username if requester else f"User {rid}")
            threads.append(schemas.ChatThreadOut(
                thread_id=f"support:{rid}",
                chat_type="support",
                chat_ref_id=rid,
                title=title,
                avatar_url=requester.avatar_url if requester else None,
            ))
    else:
        threads.append(schemas.ChatThreadOut(
            thread_id=f"support:{current_user.id}",
            chat_type="support",
            chat_ref_id=current_user.id,
            title="Администрация",
            avatar_url=None,
        ))

    # 2) Event chats (for user's booked events)
    if role != "admin":
        event_ids = db.query(models.Booking.event_id).filter(
            models.Booking.user_id == current_user.id,
            models.Booking.event_id.isnot(None)
        ).distinct().all()
        for (eid,) in event_ids:
            ev = db.query(models.Event).filter(models.Event.id == eid).first()
            if not ev:
                continue
            threads.append(schemas.ChatThreadOut(
                thread_id=f"event:{eid}",
                chat_type="event",
                chat_ref_id=eid,
                title=ev.title,
                avatar_url=None,
            ))
    else:
        # admin sees all event chats with messages
        refs = db.query(models.UserChatMessage.chat_ref_id).filter(models.UserChatMessage.chat_type == "event").distinct().all()
        for (eid,) in refs:
            ev = db.query(models.Event).filter(models.Event.id == eid).first()
            title = f"Ивент: {ev.title if ev else eid}"
            threads.append(schemas.ChatThreadOut(
                thread_id=f"event:{eid}",
                chat_type="event",
                chat_ref_id=eid,
                title=ev.title if ev else f"Event {eid}",
                avatar_url=None,
            ))

    # 3) Mentor chats (created when request exists)
    if role == "mentor":
        reqs = db.query(models.MentorRequest).filter(models.MentorRequest.mentor_id == current_user.id).all()
    elif role == "admin":
        reqs = db.query(models.MentorRequest).all()
    else:
        reqs = db.query(models.MentorRequest).filter(models.MentorRequest.student_id == current_user.id).all()

    for r in reqs:
        mentor = db.query(models.User).filter(models.User.id == r.mentor_id).first()
        student = db.query(models.User).filter(models.User.id == r.student_id).first()
        mentor_name = mentor.full_name if mentor and mentor.full_name else (mentor.username if mentor else f"User {r.mentor_id}")
        student_name = student.full_name if student and student.full_name else (student.username if student else f"User {r.student_id}")
        if role == "mentor":
            title = student_name
            avatar_url = student.avatar_url if student else None
        elif role == "admin":
            title = f"{student_name} / {mentor_name}"
            avatar_url = student.avatar_url if student else None
        else:
            title = mentor_name
            avatar_url = mentor.avatar_url if mentor else None
        threads.append(schemas.ChatThreadOut(
            thread_id=f"mentor:{r.id}",
            chat_type="mentor",
            chat_ref_id=r.id,
            title=title,
            avatar_url=avatar_url,
        ))

    # Deduplicate by thread_id
    seen = set()
    unique_threads = []
    for t in threads:
        if t.thread_id in seen:
            continue
        seen.add(t.thread_id)
        unique_threads.append(t)
    return unique_threads


@router.get("/messages/{thread_id}", response_model=List[schemas.ChatMessageOut])
def get_messages(
        thread_id: str,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    chat_type, ref_id = _parse_thread_id(thread_id)
    if not _can_access_thread(current_user, chat_type, ref_id, db):
        raise HTTPException(status_code=403, detail="No access to this thread")

    messages = db.query(models.UserChatMessage).filter(
        models.UserChatMessage.chat_type == chat_type,
        models.UserChatMessage.chat_ref_id == ref_id
    ).order_by(models.UserChatMessage.created_at.asc()).all()

    out = []
    for m in messages:
        sender = db.query(models.User).filter(models.User.id == m.sender_id).first()
        out.append(schemas.ChatMessageOut(
            id=m.id,
            thread_id=thread_id,
            sender_id=m.sender_id,
            sender_name=sender.full_name if sender and sender.full_name else (sender.username if sender else "Unknown"),
            sender_avatar=sender.avatar_url if sender else None,
            sender_role=_role_value(sender.role) if sender else "user",
            body=m.body,
            image_url=m.image_url,
            created_at=m.created_at,
        ))
    return out


@router.post("/messages", response_model=schemas.ChatMessageOut)
def send_message(
        payload: schemas.ChatMessageCreate,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    chat_type, ref_id = _parse_thread_id(payload.thread_id)
    if not _can_access_thread(current_user, chat_type, ref_id, db):
        raise HTTPException(status_code=403, detail="No access to this thread")

    msg = models.UserChatMessage(
        chat_type=chat_type,
        chat_ref_id=ref_id,
        sender_id=current_user.id,
        body=payload.body,
        image_url=payload.image_url,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return schemas.ChatMessageOut(
        id=msg.id,
        thread_id=payload.thread_id,
        sender_id=current_user.id,
        sender_name=current_user.full_name if current_user.full_name else current_user.username,
        sender_avatar=current_user.avatar_url,
        sender_role=_role_value(current_user.role),
        body=msg.body,
        image_url=msg.image_url,
        created_at=msg.created_at,
    )
