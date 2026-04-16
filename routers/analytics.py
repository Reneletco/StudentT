from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models
from auth import require_role

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/dashboard", dependencies=[Depends(require_role("admin"))])
def get_dashboard(db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    total_mentors = db.query(models.User).filter(models.User.role == "mentor").count()
    total_bookings = db.query(models.Booking).filter(models.Booking.status == "active").count()
    total_events = db.query(models.Event).count()
    return {
        "total_users": total_users,
        "total_mentors": total_mentors,
        "total_bookings": total_bookings,
        "total_events": total_events,
    }