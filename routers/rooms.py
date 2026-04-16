from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from auth import get_current_active_user
from datetime import datetime, timezone, timedelta
import math
from typing import Tuple


def _parse_working_hours(schema: dict) -> Tuple[int, int]:
    working = schema.get("working_hours") or {}
    start = str(working.get("start", "08:00"))
    end = str(working.get("end", "22:00"))
    try:
        start_h = max(0, min(23, int(start.split(":")[0])))
        end_h = max(0, min(23, int(end.split(":")[0])))
    except Exception:
        return 8, 22
    return start_h, end_h


def _format_hour_interval(start_h: int, end_h: int) -> str:
    return f"{start_h:02d}:00-{end_h:02d}:00"

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


def _compute_tables_seating(schema: dict):
    """
    If schema.tables exists, convert it to:
    - present_set: all grid cells covered by table squares
    - disabled_set: extra cells inside table squares beyond `seats`
    - table_by_label: mapping seat label -> table index
    """
    tables = schema.get("tables") or []
    if not isinstance(tables, list) or len(tables) == 0:
        return None

    # Determine grid size
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

    # If rows_labels is shorter than needed, extend it.
    needed_rows = max_y
    if len(rows_labels) < needed_rows:
        rows_labels.extend(_row_label(i) for i in range(len(rows_labels), needed_rows))

    present_set = set()
    disabled_set = set()
    table_by_label = {}

    for table_idx, t in enumerate(normalized):
        x = t["x"]
        y = t["y"]
        seats = t["seats"]
        side = t["side"]

        for local_r in range(side):
            for local_c in range(side):
                global_r = y + local_r
                global_c = x + local_c
                if global_r >= len(rows_labels):
                    continue
                if global_c < 0 or global_c >= columns:
                    continue

                label = f"{rows_labels[global_r]}{global_c + 1}"
                present_set.add(label)
                table_by_label[label] = table_idx

                seat_index = local_r * side + local_c
                if seat_index >= seats:
                    disabled_set.add(label)

    return {
        "rows_labels": rows_labels,
        "columns": columns,
        "present_set": present_set,
        "disabled_set": disabled_set,
        "table_by_label": table_by_label,
    }

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def _normalize_room_bookings(db: Session):
    changed = False
    bookings = db.query(models.Booking).filter(models.Booking.status == "not_arrived").all()
    for booking in bookings:
        if not booking.expires_at:
            continue
        expires_at = booking.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            booking.status = "cancelled"
            changed = True
    if changed:
        db.commit()


@router.get("")
@router.get("/", include_in_schema=False)
def list_rooms(db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    return db.query(models.Room).filter(models.Room.is_active == True).all()


@router.get("/{room_id}/seats")
def get_room_seats(
        room_id: int,
        event_id: int = None,
        start_time: datetime = None,
        duration_hours: int = 1,
        db: Session = Depends(get_db),
        _=Depends(get_current_active_user)
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not getattr(room, "is_active", True):
        raise HTTPException(status_code=400, detail="Room is not active")
    event = None
    if event_id is not None:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        if not getattr(event, "is_active", True):
            raise HTTPException(status_code=400, detail="Event is not active")

    now = datetime.now(timezone.utc)
    _normalize_room_bookings(db)

    # Получаем забронированные места: либо в рамках события, либо room-only бронь.
    query = db.query(models.Booking).filter(models.Booking.status.in_(["not_arrived", "arrived", "active"]))
    if event_id is not None:
        query = query.filter(models.Booking.event_id == event_id).filter(
            (models.Booking.expires_at.is_(None)) | (models.Booking.expires_at > now)
        )
    else:
        query = query.filter(models.Booking.room_id == room_id, models.Booking.event_id.is_(None))
    bookings = query.all()
    booked_seats = []
    interval_start = None
    interval_end = None
    if start_time:
        interval_start = start_time if start_time.tzinfo else start_time.replace(tzinfo=timezone.utc)
        interval_end = interval_start + timedelta(hours=max(1, duration_hours))
    for b in bookings:
        if event_id is not None:
            booked_seats.extend(b.seats or [])
            continue
        b_start = b.booked_at if b.booked_at and b.booked_at.tzinfo else (b.booked_at.replace(tzinfo=timezone.utc) if b.booked_at else None)
        b_end = b.expires_at if b.expires_at and b.expires_at.tzinfo else (b.expires_at.replace(tzinfo=timezone.utc) if b.expires_at else None)
        if not b_start or not b_end:
            continue
        if interval_start and interval_end:
            if interval_start < b_end and b_start < interval_end:
                booked_seats.extend(b.seats or [])
        elif b_end > now:
            booked_seats.extend(b.seats or [])
    booked_seats_set = set(booked_seats)

    # Генерируем схему мест из seating_schema
    schema = room.seating_schema or {}
    work_start_h, work_end_h = _parse_working_hours(schema)
    check_dt = None
    if event_id is not None and event and event.start_time:
        check_dt = event.start_time if event.start_time.tzinfo else event.start_time.replace(tzinfo=timezone.utc)
    elif interval_start:
        check_dt = interval_start
    else:
        check_dt = now
    local_hour = check_dt.astimezone().hour
    room_closed = not (work_start_h <= local_hour < work_end_h)
    vip = set(schema.get("vip", []))
    disabled = set(schema.get("disabled", []))

    tables_seating = _compute_tables_seating(schema)
    if tables_seating:
        rows = tables_seating["rows_labels"]
        cols = tables_seating["columns"]
        present_set = tables_seating["present_set"]
        disabled = disabled | tables_seating["disabled_set"]
        table_by_label = tables_seating["table_by_label"]
    else:
        rows = schema.get("rows", ["A", "B", "C", "D", "E"])
        cols = schema.get("columns", 8)
        present = schema.get("present")
        if present is None:
            # Legacy: если present не задан, считаем что все места существуют
            present_set = {f"{r}{i}" for r in rows for i in range(1, cols + 1)}
        else:
            present_set = set(present)
        table_by_label = {}

    total_capacity = len(present_set - disabled)

    seats_matrix = []
    for r in rows:
        row_seats = []
        for i in range(1, cols + 1):
            label = f"{r}{i}"
            # Если места “физически” нет (не нарисовано админом) — оно не бронируется.
            if label not in present_set:
                status = "absent"
            elif room_closed:
                status = "booked"
            elif label in booked_seats_set:
                status = "booked"
            elif label in disabled:
                status = "disabled"
            elif label in vip:
                status = "vip"
            else:
                status = "free"
            row_seats.append({"label": label, "status": status, "table_id": table_by_label.get(label)})
        seats_matrix.append({"row": r, "seats": row_seats})

    return {"seats": seats_matrix, "total_capacity": total_capacity, "room_closed": room_closed}


@router.get("/{room_id}/seat-schedule")
def get_seat_schedule(
        room_id: int,
        seats: str,
        date: str = None,
        db: Session = Depends(get_db),
        _=Depends(get_current_active_user)
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    schema = room.seating_schema or {}
    work_start_h, work_end_h = _parse_working_hours(schema)

    requested = [s.strip() for s in seats.split(",") if s.strip()]
    if not requested:
        return {"working_hours": {"start": f"{work_start_h:02d}:00", "end": f"{work_end_h:02d}:00"}, "seats": []}

    if date:
        try:
            day = datetime.fromisoformat(date).date()
        except Exception:
            day = datetime.now().date()
    else:
        day = datetime.now().date()
    day_start = datetime(day.year, day.month, day.day, 0, 0, 0).replace(tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    relevant = db.query(models.Booking).filter(
        models.Booking.room_id == room_id,
        models.Booking.event_id.is_(None),
        models.Booking.status.in_(["not_arrived", "arrived", "active"])
    ).all()

    out = []
    for seat in requested:
        booked = []
        for b in relevant:
            if seat not in (b.seats or []):
                continue
            b_start = b.booked_at if b.booked_at and b.booked_at.tzinfo else (b.booked_at.replace(tzinfo=timezone.utc) if b.booked_at else None)
            b_end = b.expires_at if b.expires_at and b.expires_at.tzinfo else (b.expires_at.replace(tzinfo=timezone.utc) if b.expires_at else None)
            if not b_start or not b_end:
                continue
            if b_end <= day_start or b_start >= day_end:
                continue
            start_h = b_start.astimezone().hour
            end_h = b_end.astimezone().hour
            booked.append(_format_hour_interval(start_h, max(start_h + 1, end_h)))
        booked = sorted(set(booked))
        out.append({
            "seat": seat,
            "booked_intervals": booked,
            "free_hint": f"Свободно в рамках {work_start_h:02d}:00-{work_end_h:02d}:00, кроме занятых интервалов"
        })

    return {
        "working_hours": {"start": f"{work_start_h:02d}:00", "end": f"{work_end_h:02d}:00"},
        "seats": out
    }