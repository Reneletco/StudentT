from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import enum


class UserRole(str, enum.Enum):
    USER = "user"
    MENTOR = "mentor"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    avatar_url = Column(String, nullable=True)

    # Для ментора
    mentor_approved = Column(Boolean, default=False)
    skills = Column(JSON, default=list)  # список строк
    bio = Column(Text, nullable=True)
    company = Column(String, nullable=True)
    github = Column(String, nullable=True)
    work_experience = Column(String, nullable=True)
    mentor_pitch = Column(Text, nullable=True)
    phone = Column(String, nullable=True)
    telegram_id = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_other = Column(String, nullable=True)
    preferred_language = Column(String, nullable=True)
    city = Column(String, nullable=True)
    preferred_office = Column(String, nullable=True)
    accepting_mentor_requests = Column(Boolean, default=True)

    bookings = relationship("Booking", back_populates="user")
    mentor_requests = relationship("MentorRequest", foreign_keys="MentorRequest.student_id")
    mentor_requests_received = relationship("MentorRequest", foreign_keys="MentorRequest.mentor_id")


class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    capacity = Column(Integer)
    seating_schema = Column(JSON)  # {rows: ["A","B","C"], columns: 8, vip: ["B4"], disabled: ["A1"]}
    is_active = Column(Boolean, default=True)


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    price = Column(String, default="Бесплатно")
    icon = Column(String, default="🎉")
    event_type = Column(String)  # hackathon, lecture, workshop, meetup
    is_active = Column(Boolean, default=True)

    room = relationship("Room")
    bookings = relationship("Booking", back_populates="event")


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    seats = Column(JSON)  # список выбранных мест ["A1","B2"]
    status = Column(String, default="not_arrived")  # not_arrived, arrived, cancelled
    booked_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    qr_token = Column(String, unique=True, nullable=True)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="bookings")
    event = relationship("Event", back_populates="bookings")
    room = relationship("Room")


class MentorRequest(Base):
    __tablename__ = "mentor_requests"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    mentor_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    requested_slot = Column(DateTime(timezone=True))
    status = Column(String, default="pending")  # pending, accepted, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MentorApplication(Base):
    __tablename__ = "mentor_applications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    skills = Column(JSON, default=list)
    bio = Column(Text)
    company = Column(String)
    github = Column(String)
    work_experience = Column(String)
    mentor_pitch = Column(Text)
    phone = Column(String, nullable=True)
    telegram_id = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_other = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, approved, rejected
    applied_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class MentorEventProposal(Base):
    __tablename__ = "mentor_event_proposals"
    id = Column(Integer, primary_key=True, index=True)
    mentor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    price = Column(String, default="Бесплатно")
    icon = Column(String, default="🎉")
    event_type = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, approved, rejected
    admin_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    mentor = relationship("User")
    room = relationship("Room")


class ForumTopic(Base):
    __tablename__ = "forum_topics"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    tags = Column(JSON, default=list)
    image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_closed = Column(Boolean, default=False)

    author = relationship("User")


class ForumMessage(Base):
    __tablename__ = "forum_messages"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("forum_topics.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    topic = relationship("ForumTopic")
    author = relationship("User")


class AdminSupportMessage(Base):
    __tablename__ = "admin_support_messages"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    requester = relationship("User", foreign_keys=[requester_id])
    sender = relationship("User", foreign_keys=[sender_id])


class UserChatMessage(Base):
    __tablename__ = "user_chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_type = Column(String, nullable=False)  # support, event, mentor
    chat_ref_id = Column(Integer, nullable=False)  # requester_id / event_id / mentor_request_id
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sender = relationship("User")


class AuthLog(Base):
    __tablename__ = "auth_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    login_time = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String)
    user_agent = Column(String)