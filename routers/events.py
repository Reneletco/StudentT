from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas
from auth import get_current_active_user
from datetime import datetime, timezone
import math

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


def _compute_tables_total_seats(schema: dict) -> int:
    tables = schema.get("tables") or []
    if not isinstance(tables, list) or len(tables) == 0:
        return 0

    disabled = set(schema.get("disabled", []))

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

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[schemas.EventOut])
@router.get("/", response_model=List[schemas.EventOut], include_in_schema=False)
def get_events(
        event_type: Optional[str] = Query(None, description="hackathon, lecture, workshop, meetup"),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_active_user)
):
    now = datetime.now(timezone.utc)

    query = db.query(models.Event).filter(models.Event.is_active == True)
    if event_type:
        query = query.filter(models.Event.event_type == event_type)
    events = query.all()

    result = []
    for ev in events:
        room = db.query(models.Room).filter(models.Room.id == ev.room_id).first()
        if not room:
            continue
        schema = room.seating_schema or {}
        if schema.get("tables"):
            total_seats = _compute_tables_total_seats(schema)
        else:
            rows = schema.get("rows", ["A", "B", "C", "D", "E"])
            cols = schema.get("columns", 8)
            disabled = set(schema.get("disabled", []))

            present = schema.get("present")
            if present is None:
                present_set = {f"{r}{i}" for r in rows for i in range(1, cols + 1)}
            else:
                present_set = set(present)
            total_seats = len(present_set - disabled)
        bookings = db.query(models.Booking).filter(
            models.Booking.event_id == ev.id,
            models.Booking.status.in_(["not_arrived", "arrived", "active"]),
            (models.Booking.expires_at.is_(None)) | (models.Booking.expires_at > now)
        ).all()
        booked_seats_count = sum(len(b.seats or []) for b in bookings)
        result.append(schemas.EventOut(
            id=ev.id,
            title=ev.title,
            description=ev.description or "",
            room_id=ev.room_id,
            room_name=room.name,
            start_time=ev.start_time,
            end_time=ev.end_time,
            price=ev.price,
            icon=ev.icon,
            event_type=ev.event_type,
            free_seats=max(total_seats - booked_seats_count, 0),
            total_seats=total_seats
        ))
    return result