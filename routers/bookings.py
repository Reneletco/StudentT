from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from auth import get_current_active_user
from datetime import datetime, timedelta, timezone
from websocket_manager import manager
import json
import secrets
from urllib.parse import quote

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


CHECK_IN_WINDOW_MINUTES = 30
MAX_ROOM_BOOKING_HOURS = 12


def _normalize_booking_status(booking: models.Booking):
    # Legacy: старые брони могли храниться со статусом "active".
    if booking.status == "active":
        booking.status = "not_arrived"

    if booking.status not in ("not_arrived", "arrived") or not booking.expires_at:
        return

    expires_at = booking.expires_at
    # В старой БД может быть offset-naive. Приведем к UTC-aware.
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= datetime.now(timezone.utc):
        booking.status = "cancelled"


def _normalize_all_bookings(db: Session):
    changed = False
    bookings = db.query(models.Booking).filter(models.Booking.status.in_(["not_arrived", "active", "arrived"])).all()
    for booking in bookings:
        before = booking.status
        _normalize_booking_status(booking)
        if booking.status != before:
            changed = True
    if changed:
        db.commit()


def _get_booking_room(booking: models.Booking, db: Session):
    if booking.room_id:
        return db.query(models.Room).filter(models.Room.id == booking.room_id).first()
    if booking.event_id:
        event = db.query(models.Event).filter(models.Event.id == booking.event_id).first()
        if event:
            return db.query(models.Room).filter(models.Room.id == event.room_id).first()
    return None


def _build_qr_url(token: str):
    checkin_url = f"/api/bookings/check-in/{token}"
    return f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={quote(checkin_url, safe='')}"


def _resolve_booking_context(booking: schemas.BookingCreate, db: Session):
    if booking.event_id and booking.room_id:
        raise HTTPException(status_code=400, detail="Specify either event_id or room_id, not both")
    if not booking.event_id and not booking.room_id:
        raise HTTPException(status_code=400, detail="event_id or room_id is required")

    event = None
    room = None

    if booking.event_id:
        event = db.query(models.Event).filter(models.Event.id == booking.event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        if not getattr(event, "is_active", True):
            raise HTTPException(status_code=400, detail="Event is not active")
        room = db.query(models.Room).filter(models.Room.id == event.room_id).first()
    else:
        room = db.query(models.Room).filter(models.Room.id == booking.room_id).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not getattr(room, "is_active", True):
        raise HTTPException(status_code=400, detail="Room is not active")

    return event, room


def _to_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _booking_interval(booking: models.Booking):
    start = _to_utc(booking.booked_at) if booking.booked_at else None
    if booking.event_id:
        return start, None
    end = _to_utc(booking.expires_at) if booking.expires_at else None
    return start, end


def _intervals_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    return start_a < end_b and start_b < end_a


def _parse_working_hours(schema: dict):
    working = schema.get("working_hours") or {}
    try:
        start_h = int(str(working.get("start", "08:00")).split(":")[0])
        end_h = int(str(working.get("end", "22:00")).split(":")[0])
    except Exception:
        return 8, 22
    return max(0, min(23, start_h)), max(0, min(23, end_h))


def _booking_interval_bounds(booking: models.Booking, db: Session):
    if booking.event_id:
        ev = db.query(models.Event).filter(models.Event.id == booking.event_id).first()
        if not ev:
            return None, None
        start = _to_utc(ev.start_time)
        end = _to_utc(ev.end_time)
        return start, end
    if not booking.booked_at or not booking.expires_at:
        return None, None
    return _to_utc(booking.booked_at), _to_utc(booking.expires_at)


def _enforce_user_seat_limit(
        user_id: int,
        requested_seats_count: int,
        interval_start: datetime,
        interval_end: datetime,
        db: Session
):
    # В любой момент времени пользователь не может занимать более 2 мест.
    active = db.query(models.Booking).filter(
        models.Booking.user_id == user_id,
        models.Booking.status.in_(["not_arrived", "arrived", "active"])
    ).all()
    overlapping_reserved = 0
    for b in active:
        b_start, b_end = _booking_interval_bounds(b, db)
        if not b_start or not b_end:
            continue
        if _intervals_overlap(interval_start, interval_end, b_start, b_end):
            overlapping_reserved += len(b.seats or [])
    if overlapping_reserved + requested_seats_count > 2:
        raise HTTPException(status_code=400, detail="At the same time one user can reserve at most 2 seats")


def _validate_booking_seats(
        booking: schemas.BookingCreate,
        room: models.Room,
        db: Session,
        interval_start: datetime = None,
        interval_end: datetime = None
):
    schema = room.seating_schema or {}
    rows = schema.get("rows", ["A", "B", "C", "D", "E"])
    cols = schema.get("columns", 8)
    disabled_set = set(schema.get("disabled", []))

    present = schema.get("present")
    if present is None:
        present_set = {f"{r}{i}" for r in rows for i in range(1, cols + 1)}
    else:
        present_set = set(present)

    if not booking.seats:
        raise HTTPException(status_code=400, detail="Seats are required")

    unique_seats = list(dict.fromkeys(booking.seats))
    disabled_requested = [s for s in unique_seats if s in disabled_set]
    not_present_requested = [s for s in unique_seats if s not in present_set]

    if not_present_requested:
        raise HTTPException(status_code=400, detail=f"Seats not present in room: {not_present_requested}")
    if disabled_requested:
        raise HTTPException(status_code=400, detail=f"Seats are disabled: {disabled_requested}")

    _normalize_all_bookings(db)
    now = datetime.now(timezone.utc)

    conflict_query = db.query(models.Booking).filter(models.Booking.status.in_(["not_arrived", "arrived", "active"]))
    if booking.event_id:
        conflict_query = conflict_query.filter(models.Booking.event_id == booking.event_id).filter(
            (models.Booking.expires_at.is_(None)) | (models.Booking.expires_at > now)
        )
    else:
        conflict_query = conflict_query.filter(models.Booking.room_id == booking.room_id, models.Booking.event_id.is_(None))

    existing_bookings = conflict_query.all()
    booked_seats = []
    for eb in existing_bookings:
        if booking.event_id:
            booked_seats.extend(eb.seats or [])
            continue
        eb_start, eb_end = _booking_interval(eb)
        if not eb_start or not eb_end:
            continue
        if interval_start and interval_end and _intervals_overlap(interval_start, interval_end, eb_start, eb_end):
            booked_seats.extend(eb.seats or [])

    conflict = set(unique_seats) & set(booked_seats)
    if conflict:
        raise HTTPException(status_code=400, detail=f"Seats {sorted(conflict)} already booked")

    return unique_seats


@router.post("")
@router.post("/", include_in_schema=False)
async def create_booking(
        booking: schemas.BookingCreate,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    event, room = _resolve_booking_context(booking, db)
    now = datetime.now(timezone.utc)
    interval_start = None
    interval_end = None

    if booking.event_id:
        interval_start = _to_utc(event.start_time)
        interval_end = _to_utc(event.end_time)
        unique_seats = _validate_booking_seats(booking, room, db)
    else:
        if not booking.start_time:
            raise HTTPException(status_code=400, detail="start_time is required for room booking")
        if not booking.duration_hours or booking.duration_hours < 1 or booking.duration_hours > MAX_ROOM_BOOKING_HOURS:
            raise HTTPException(status_code=400, detail=f"duration_hours must be between 1 and {MAX_ROOM_BOOKING_HOURS}")
        interval_start = _to_utc(booking.start_time)
        interval_end = interval_start + timedelta(hours=booking.duration_hours)
        if interval_start < now:
            raise HTTPException(status_code=400, detail="start_time must be in the future")
        work_start_h, work_end_h = _parse_working_hours(room.seating_schema or {})
        start_hour_local = interval_start.astimezone().hour
        if not (work_start_h <= start_hour_local < work_end_h):
            raise HTTPException(status_code=400, detail="Room is closed at selected start time")
        unique_seats = _validate_booking_seats(booking, room, db, interval_start, interval_end)

    _enforce_user_seat_limit(current_user.id, len(unique_seats), interval_start, interval_end, db)

    qr_token = secrets.token_urlsafe(24)

    new_booking = models.Booking(
        user_id=current_user.id,
        event_id=booking.event_id,
        room_id=room.id,
        seats=unique_seats,
        status="not_arrived",
        qr_token=qr_token,
        booked_at=interval_start or now,
        expires_at=interval_end if interval_end else now + timedelta(minutes=CHECK_IN_WINDOW_MINUTES)
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)

    # Уведомление через WebSocket
    await manager.broadcast(json.dumps({
        "type": "new_booking",
        "event_id": booking.event_id,
        "room_id": room.id,
        "seats": booking.seats,
        "user": current_user.username
    }))

    return {
        "message": "Booking created",
        "id": new_booking.id,
        "status": new_booking.status,
        "qr_token": new_booking.qr_token,
        "qr_url": _build_qr_url(new_booking.qr_token)
    }


@router.delete("/{booking_id}")
def cancel_booking(booking_id: int, current_user: models.User = Depends(get_current_active_user),
                   db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    current_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if booking.user_id != current_user.id and current_role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    booking.status = "cancelled"
    db.commit()
    return {"message": "Booking cancelled"}


@router.get("/my")
def get_my_bookings(current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    _normalize_all_bookings(db)
    bookings = db.query(models.Booking).filter(models.Booking.user_id == current_user.id).all()
    result = []
    for b in bookings:
        _normalize_booking_status(b)
        event = db.query(models.Event).filter(models.Event.id == b.event_id).first() if b.event_id else None
        room = _get_booking_room(b, db)
        event_title = event.title if event else "Бронь рабочего места"
        date_label = event.start_time.strftime("%d %b, %H:%M") if event else b.booked_at.strftime("%d %b, %H:%M")
        result.append(schemas.BookingOut(
            id=b.id,
            event_id=event.id if event else None,
            room_id=room.id if room else b.room_id,
            event_title=event_title,
            room_name=room.name if room else "Неизвестная комната",
            seats=b.seats,
            status=b.status,
            booked_at=b.booked_at,
            booking_start=b.booked_at,
            booking_end=b.expires_at,
            event_date=date_label,
            qr_token=b.qr_token,
            qr_url=_build_qr_url(b.qr_token) if b.qr_token else None,
            checked_in_at=b.checked_in_at
        ))
    return result


@router.get("/check-in/{qr_token}")
def check_in_booking(qr_token: str, db: Session = Depends(get_db)):
    _normalize_all_bookings(db)
    booking = db.query(models.Booking).filter(models.Booking.qr_token == qr_token).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _normalize_booking_status(booking)
    if booking.status == "cancelled":
        db.commit()
        raise HTTPException(status_code=400, detail="Booking is cancelled or expired")
    booking.status = "arrived"
    booking.checked_in_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Check-in successful", "status": booking.status}