from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_active_user, require_role

router = APIRouter(prefix="/api/forum", tags=["forum"])


def _topic_out(topic: models.ForumTopic, author: models.User) -> schemas.ForumTopicOut:
    return schemas.ForumTopicOut(
        id=topic.id,
        title=topic.title,
        body=topic.body,
        tags=topic.tags or [],
        image_url=topic.image_url,
        created_at=topic.created_at,
        is_closed=topic.is_closed,
        author_id=author.id,
        author_name=author.full_name if author.full_name else author.username,
        author_avatar=author.avatar_url,
        author_role=author.role.value if hasattr(author.role, "value") else str(author.role),
        author_bio=author.bio,
    )


@router.get("/topics", response_model=List[schemas.ForumTopicOut])
def list_topics(
        tag: Optional[str] = Query(None),
        q: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        _=Depends(get_current_active_user)
):
    query = db.query(models.ForumTopic)
    topics = query.order_by(models.ForumTopic.created_at.desc()).all()
    out = []
    for t in topics:
        if tag and tag not in (t.tags or []):
            continue
        if q:
            hay = f"{t.title} {t.body}".lower()
            if q.lower() not in hay:
                continue
        author = db.query(models.User).filter(models.User.id == t.user_id).first()
        if not author:
            continue
        out.append(_topic_out(t, author))
    return out


@router.post("/topics", response_model=schemas.ForumTopicOut)
def create_topic(
        payload: schemas.ForumTopicCreate,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    topic = models.ForumTopic(
        user_id=current_user.id,
        title=payload.title,
        body=payload.body,
        tags=payload.tags,
        image_url=payload.image_url,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _topic_out(topic, current_user)


@router.get("/topics/{topic_id}")
def get_topic(
        topic_id: int,
        db: Session = Depends(get_db),
        _=Depends(get_current_active_user)
):
    topic = db.query(models.ForumTopic).filter(models.ForumTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    author = db.query(models.User).filter(models.User.id == topic.user_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    messages = db.query(models.ForumMessage).filter(
        models.ForumMessage.topic_id == topic_id
    ).order_by(models.ForumMessage.created_at.asc()).all()

    msg_out = []
    for m in messages:
        u = db.query(models.User).filter(models.User.id == m.user_id).first()
        if not u:
            continue
        msg_out.append(schemas.ForumMessageOut(
            id=m.id,
            topic_id=m.topic_id,
            body=m.body,
            image_url=m.image_url,
            created_at=m.created_at,
            author_id=u.id,
            author_name=u.full_name if u.full_name else u.username,
            author_avatar=u.avatar_url,
            author_role=u.role.value if hasattr(u.role, "value") else str(u.role),
            author_bio=u.bio,
        ))
    return {"topic": _topic_out(topic, author), "messages": msg_out}


@router.post("/topics/{topic_id}/messages", response_model=schemas.ForumMessageOut)
def create_message(
        topic_id: int,
        payload: schemas.ForumMessageCreate,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    topic = db.query(models.ForumTopic).filter(models.ForumTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    msg = models.ForumMessage(
        topic_id=topic_id,
        user_id=current_user.id,
        body=payload.body,
        image_url=payload.image_url,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return schemas.ForumMessageOut(
        id=msg.id,
        topic_id=msg.topic_id,
        body=msg.body,
        image_url=msg.image_url,
        created_at=msg.created_at,
        author_id=current_user.id,
        author_name=current_user.full_name if current_user.full_name else current_user.username,
        author_avatar=current_user.avatar_url,
        author_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        author_bio=current_user.bio,
    )
