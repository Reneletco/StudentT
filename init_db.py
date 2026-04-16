from database import SessionLocal, engine
import models
from auth import get_password_hash
from sqlalchemy import inspect
from sqlalchemy import text


def init_db():
    models.Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS work_experience VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_pitch TEXT"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_email VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_other VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_office VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS accepting_mentor_requests BOOLEAN DEFAULT TRUE"))
        conn.execute(text("ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS work_experience VARCHAR"))
        conn.execute(text("ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS mentor_pitch TEXT"))
        conn.execute(text("ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS phone VARCHAR"))
        conn.execute(text("ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS telegram_id VARCHAR"))
        conn.execute(text("ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS contact_email VARCHAR"))
        conn.execute(text("ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS contact_other VARCHAR"))
        conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_id INTEGER"))
        conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS qr_token VARCHAR"))
        conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS user_chat_messages (id SERIAL PRIMARY KEY, chat_type VARCHAR NOT NULL, chat_ref_id INTEGER NOT NULL, sender_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, image_url TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())"))
        conn.execute(text("ALTER TABLE bookings ALTER COLUMN event_id DROP NOT NULL"))
    db = SessionLocal()
    # Создаем админа, если нет
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        admin_user = models.User(
            username="admin",
            email="admin@unihub.local",
            full_name="Administrator",
            hashed_password=get_password_hash("admin"),
            role=models.UserRole.ADMIN,
            is_active=True,
            mentor_approved=True
        )
        db.add(admin_user)
        db.commit()
        print("Admin user created: admin / admin")

    # Создаем тестовые помещения, если их нет
    if db.query(models.Room).count() == 0:
        rooms = [
            models.Room(name="Митап-зона А", capacity=60,
                        seating_schema={"rows": ["A", "B", "C", "D", "E", "F"], "columns": 10,
                                        "vip": ["C4", "C5", "D4", "D5"], "disabled": []}),
            models.Room(name="Коворкинг", capacity=30,
                        seating_schema={"rows": ["A", "B", "C", "D", "E"], "columns": 6, "vip": [], "disabled": []}),
            models.Room(name="Переговорная 1", capacity=16,
                        seating_schema={"rows": ["A", "B"], "columns": 8, "vip": [], "disabled": []}),
        ]
        db.add_all(rooms)
        db.commit()

    db.close()


if __name__ == "__main__":
    init_db()