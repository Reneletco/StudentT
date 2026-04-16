from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_active_user, require_role

router = APIRouter(prefix="/api/support", tags=["support"])


@router.get("/messages", response_model=List[schemas.AdminSupportMessageOut])
def get_support_messages(
        requester_id: int = None,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role == "admin":
        query = db.query(models.AdminSupportMessage)
        if requester_id:
            query = query.filter(models.AdminSupportMessage.requester_id == requester_id)
        messages = query.order_by(models.AdminSupportMessage.created_at.asc()).all()
    else:
        messages = db.query(models.AdminSupportMessage).filter(
            models.AdminSupportMessage.requester_id == current_user.id
        ).order_by(models.AdminSupportMessage.created_at.asc()).all()

    out = []
    for m in messages:
        requester = db.query(models.User).filter(models.User.id == m.requester_id).first()
        sender = db.query(models.User).filter(models.User.id == m.sender_id).first()
        out.append(schemas.AdminSupportMessageOut(
            id=m.id,
            requester_id=m.requester_id,
            requester_name=requester.full_name if requester and requester.full_name else (requester.username if requester else "Unknown"),
            sender_id=m.sender_id,
            sender_name=sender.full_name if sender and sender.full_name else (sender.username if sender else "Unknown"),
            body=m.body,
            image_url=m.image_url,
            created_at=m.created_at,
        ))
    return out


@router.post("/messages", response_model=schemas.AdminSupportMessageOut)
def post_support_message(
        payload: schemas.AdminSupportMessageCreate,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role == "admin":
        if not payload.requester_id:
            raise HTTPException(status_code=400, detail="requester_id required for admin reply")
        requester_id = payload.requester_id
    else:
        requester_id = current_user.id

    msg = models.AdminSupportMessage(
        requester_id=requester_id,
        sender_id=current_user.id,
        body=payload.body,
        image_url=payload.image_url,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    requester = db.query(models.User).filter(models.User.id == msg.requester_id).first()
    return schemas.AdminSupportMessageOut(
        id=msg.id,
        requester_id=msg.requester_id,
        requester_name=requester.full_name if requester and requester.full_name else (requester.username if requester else "Unknown"),
        sender_id=current_user.id,
        sender_name=current_user.full_name if current_user.full_name else current_user.username,
        body=msg.body,
        image_url=msg.image_url,
        created_at=msg.created_at,
    )
