from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timezone
from database import get_db
import models, schemas
from auth import require_role, get_current_active_user
import math

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _row_label(i: int) -> str:
    # Excel-like row labels: 0->A, 25->Z, 26->AA, ...
    n = i
    label = ""
    while True:
        n, rem = divmod(n, 26)
        label = chr(ord("A") + rem) + label
        if n == 0:
            break
        n -= 1
    return label


def _compute_tables_room_capacity(schema: dict) -> int:
    tables = schema.get("tables") or []
    if not isinstance(tables, list) or len(tables) == 0:
        return 0

    disabled = set(schema.get("disabled", []))

    max_x = 0
    max_y = 0
    normalized = []
    for t in tables:
        if not isinstance(t, dict):
            continue
        x = int(t.get("x", 0))
        y = int(t.get("y", 0))
        seats = int(t.get("seats", 0) or 0)
        side = t.get("side") or t.get("size") or t.get("sideCells") or t.get("sizeCells")
        if side is None:
            side = int(math.ceil(math.sqrt(seats))) if seats > 0 else 1
        side = int(side)
        normalized.append({"x": x, "y": y, "seats": seats, "side": side})
        max_x = max(max_x, x + side)
        max_y = max(max_y, y + side)

    columns = int(schema.get("columns") or max_x or 1)
    rows_list = schema.get("rows")
    if isinstance(rows_list, list) and len(rows_list) > 0:
        rows_labels = [str(r) for r in rows_list]
    else:
        rows_count = int(schema.get("row_count") or max_y or 1)
        rows_labels = [_row_label(i) for i in range(rows_count)]

    needed_rows = max_y
    if len(rows_labels) < needed_rows:
        rows_labels.extend(_row_label(i) for i in range(len(rows_labels), needed_rows))

    present_set = set()
    disabled_set = set(disabled)
    for t in normalized:
        x = t["x"]
        y = t["y"]
        seats = t["seats"]
        side = t["side"]
        for local_r in range(side):
            for local_c in range(side):
                global_r = y + local_r
                global_c = x + local_c
                if global_r >= len(rows_labels) or global_c < 0 or global_c >= columns:
                    continue
                label = f"{rows_labels[global_r]}{global_c + 1}"
                present_set.add(label)
                seat_index = local_r * side + local_c
                if seat_index >= seats:
                    disabled_set.add(label)

    return len(present_set - disabled_set)


# ---------- DASHBOARD ----------
@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    now = datetime.now(timezone.utc)
    total_users = db.query(models.User).count()
    total_mentors = db.query(models.User).filter(models.User.role == models.UserRole.MENTOR).count()
    total_bookings = db.query(models.Booking).filter(
        models.Booking.status.in_(["not_arrived", "arrived", "active"]),
        (models.Booking.expires_at.is_(None)) | (models.Booking.expires_at > now)
    ).count()
    total_events = db.query(models.Event).count()
    total_capacity_now = 0
    total_occupied_now = 0

    rooms_fill = []
    room_booking_counts = []
    rooms = db.query(models.Room).all()
    for room in rooms:
        events = db.query(models.Event).filter(models.Event.room_id == room.id).all()
        total_seats_booked = 0
        total_capacity = 0

        schema = room.seating_schema or {}
        if schema.get("tables"):
            room_capacity = _compute_tables_room_capacity(schema)
        else:
            rows = schema.get("rows", ["A", "B", "C", "D", "E"])
            cols = schema.get("columns", 8)
            disabled = set(schema.get("disabled", []))
            present = schema.get("present")
            if present is None:
                present_set = {f"{r}{i}" for r in rows for i in range(1, cols + 1)}
            else:
                present_set = set(present)
            room_capacity = len(present_set - disabled)

        for ev in events:
            total_capacity += room_capacity
            bookings = db.query(models.Booking).filter(
                models.Booking.event_id == ev.id,
                models.Booking.status.in_(["not_arrived", "arrived", "active"]),
                (models.Booking.expires_at.is_(None)) | (models.Booking.expires_at > now)
            ).all()
            total_seats_booked += sum(len(b.seats or []) for b in bookings)
            room_booking_counts.append({"room": room.name, "count": len(bookings)})
        total_capacity_now += room_capacity
        current_room_bookings = db.query(models.Booking).filter(
            models.Booking.room_id == room.id,
            models.Booking.status.in_(["not_arrived", "arrived", "active"]),
            (models.Booking.expires_at.is_(None)) | (models.Booking.expires_at > now)
        ).all()
        total_occupied_now += sum(len(b.seats or []) for b in current_room_bookings)
        fill_percent = (total_seats_booked / total_capacity * 100) if total_capacity > 0 else 0
        rooms_fill.append({"room": room.name, "fill": fill_percent})

    daily_bookings = db.query(
        func.date(models.Booking.booked_at).label("date"),
        func.count(models.Booking.id).label("count")
    ).filter(
        models.Booking.status.in_(["not_arrived", "arrived", "active"]),
        (models.Booking.expires_at.is_(None)) | (models.Booking.expires_at > now)
    ).group_by(func.date(models.Booking.booked_at)).limit(7).all()

    most_booked_room = None
    if room_booking_counts:
        agg = {}
        for item in room_booking_counts:
            agg[item["room"]] = agg.get(item["room"], 0) + item["count"]
        room_name, count = sorted(agg.items(), key=lambda x: x[1], reverse=True)[0]
        most_booked_room = {"room": room_name, "bookings": count}

    return {
        "total_users": total_users,
        "total_mentors": total_mentors,
        "total_bookings": total_bookings,
        "total_events": total_events,
        "occupied_now": total_occupied_now,
        "capacity_now": total_capacity_now,
        "most_booked_room": most_booked_room,
        "rooms_fill": rooms_fill,
        "daily_bookings": [{"date": str(d[0]), "count": d[1]} for d in daily_bookings]
    }


# ---------- УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ----------
@router.get("/users")
def get_all_users(db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    users = db.query(models.User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "bookings_count": db.query(models.Booking).filter(models.Booking.user_id == u.id).count()
        } for u in users
    ]


@router.put("/users/{user_id}/toggle-block")
def toggle_block_user(user_id: int, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"message": f"User {'blocked' if not user.is_active else 'unblocked'}"}


# ---------- ЛОГИ ВХОДОВ ----------
@router.get("/auth-logs")
def get_auth_logs(db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    logs = db.query(models.AuthLog).order_by(models.AuthLog.login_time.desc()).limit(50).all()
    result = []
    for log in logs:
        user = db.query(models.User).filter(models.User.id == log.user_id).first()
        result.append({
            "username": user.username if user else "unknown",
            "login_time": log.login_time,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent
        })
    return result


# ---------- УПРАВЛЕНИЕ ПОМЕЩЕНИЯМИ ----------
@router.get("/rooms", response_model=List[schemas.RoomSchema])
def get_rooms(db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    return db.query(models.Room).all()


@router.post("/rooms", response_model=schemas.RoomSchema)
def create_room(room: schemas.RoomCreate, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    new_room = models.Room(
        name=room.name,
        capacity=room.capacity,
        seating_schema=room.seating_schema,
        is_active=room.is_active
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return new_room


@router.put("/rooms/{room_id}", response_model=schemas.RoomSchema)
def update_room(room_id: int, room: schemas.RoomCreate, db: Session = Depends(get_db),
                _=Depends(require_role("admin"))):
    db_room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not db_room:
        raise HTTPException(404, "Room not found")
    db_room.name = room.name
    db_room.capacity = room.capacity
    db_room.seating_schema = room.seating_schema
    db_room.is_active = room.is_active
    db.commit()
    db.refresh(db_room)
    return db_room


@router.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(404, "Room not found")
    db.delete(room)
    db.commit()
    return {"message": "Room deleted"}


# ---------- УПРАВЛЕНИЕ МЕРОПРИЯТИЯМИ ----------
@router.post("/events")
def create_event(event: schemas.EventCreate, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    new_event = models.Event(
        title=event.title,
        description=event.description,
        room_id=event.room_id,
        start_time=event.start_time,
        end_time=event.end_time,
        price=event.price,
        icon=event.icon,
        event_type=event.event_type
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return {"message": "Event created", "id": new_event.id}


@router.put("/events/{event_id}")
def update_event(event_id: int, event: schemas.EventCreate, db: Session = Depends(get_db),
                 _=Depends(require_role("admin"))):
    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(404, "Event not found")
    db_event.title = event.title
    db_event.description = event.description
    db_event.room_id = event.room_id
    db_event.start_time = event.start_time
    db_event.end_time = event.end_time
    db_event.price = event.price
    db_event.icon = event.icon
    db_event.event_type = event.event_type
    db.commit()
    return {"message": "Event updated"}


@router.delete("/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}


@router.get("/event-proposals", response_model=List[schemas.MentorEventProposalOut])
def get_event_proposals(db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    proposals = db.query(models.MentorEventProposal).order_by(models.MentorEventProposal.created_at.desc()).all()
    out = []
    for p in proposals:
        mentor = db.query(models.User).filter(models.User.id == p.mentor_id).first()
        room = db.query(models.Room).filter(models.Room.id == p.room_id).first()
        out.append(schemas.MentorEventProposalOut(
            id=p.id,
            mentor_id=p.mentor_id,
            mentor_name=(mentor.full_name if mentor and mentor.full_name else (mentor.username if mentor else "Unknown")),
            title=p.title,
            description=p.description or "",
            room_id=p.room_id,
            room_name=room.name if room else "Unknown",
            start_time=p.start_time,
            end_time=p.end_time,
            price=p.price,
            icon=p.icon,
            event_type=p.event_type,
            status=p.status,
            admin_comment=p.admin_comment,
            created_at=p.created_at,
        ))
    return out


@router.put("/event-proposals/{proposal_id}/approve")
def approve_event_proposal(proposal_id: int, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    p = db.query(models.MentorEventProposal).filter(models.MentorEventProposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.status != "pending":
        return {"message": "Proposal already processed"}

    ev = models.Event(
        title=p.title,
        description=p.description,
        room_id=p.room_id,
        start_time=p.start_time,
        end_time=p.end_time,
        price=p.price,
        icon=p.icon,
        event_type=p.event_type,
    )
    db.add(ev)
    p.status = "approved"
    db.commit()
    return {"message": "Proposal approved"}


@router.put("/event-proposals/{proposal_id}/reject")
def reject_event_proposal(
        proposal_id: int,
        admin_comment: str = "",
        db: Session = Depends(get_db),
        _=Depends(require_role("admin"))
):
    p = db.query(models.MentorEventProposal).filter(models.MentorEventProposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    p.status = "rejected"
    p.admin_comment = admin_comment or p.admin_comment
    db.commit()
    return {"message": "Proposal rejected"}


@router.delete("/forum/topics/{topic_id}")
def admin_delete_forum_topic(topic_id: int, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    topic = db.query(models.ForumTopic).filter(models.ForumTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.query(models.ForumMessage).filter(models.ForumMessage.topic_id == topic_id).delete()
    db.delete(topic)
    db.commit()
    return {"message": "Topic deleted"}


@router.delete("/forum/messages/{message_id}")
def admin_delete_forum_message(message_id: int, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    msg = db.query(models.ForumMessage).filter(models.ForumMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"message": "Message deleted"}