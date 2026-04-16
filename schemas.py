from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: str  # убрали EmailStr, чтобы не валидировал
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(UserBase):
    id: int
    role: str
    is_active: bool
    mentor_approved: Optional[bool] = False
    skills: Optional[List[str]] = []
    bio: Optional[str] = None
    company: Optional[str] = None
    github: Optional[str] = None
    avatar_url: Optional[str] = None
    work_experience: Optional[str] = None
    mentor_pitch: Optional[str] = None
    phone: Optional[str] = None
    telegram_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_other: Optional[str] = None
    preferred_language: Optional[str] = None
    city: Optional[str] = None
    preferred_office: Optional[str] = None
    accepting_mentor_requests: Optional[bool] = True

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class MentorApplicationCreate(BaseModel):
    skills: List[str]
    bio: str
    company: Optional[str] = None
    github: Optional[str] = None
    work_experience: Optional[str] = None
    mentor_pitch: Optional[str] = None
    phone: Optional[str] = None
    telegram_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_other: Optional[str] = None


class MentorProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    work_experience: Optional[str] = None
    skills: Optional[List[str]] = None
    mentor_pitch: Optional[str] = None
    company: Optional[str] = None
    github: Optional[str] = None
    accepting_mentor_requests: Optional[bool] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    telegram_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_other: Optional[str] = None
    preferred_language: Optional[str] = None
    city: Optional[str] = None
    preferred_office: Optional[str] = None


class MentorProfileOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    work_experience: Optional[str] = None
    skills: List[str] = []
    mentor_pitch: Optional[str] = None
    company: Optional[str] = None
    github: Optional[str] = None
    accepting_mentor_requests: Optional[bool] = True

    class Config:
        from_attributes = True


class MentorRequestOut(BaseModel):
    id: int
    mentor_id: Optional[int] = None
    mentor_name: Optional[str] = None
    student_name: str
    student_username: str
    message: str
    requested_slot: datetime
    status: str
    created_at: datetime


class EventCreate(BaseModel):
    title: str
    description: str
    room_id: int
    start_time: datetime
    end_time: datetime
    price: str = "Бесплатно"
    icon: str = "🎉"
    event_type: str


class EventOut(BaseModel):
    id: int
    title: str
    description: str
    room_id: int
    room_name: str
    start_time: datetime
    end_time: datetime
    price: str
    icon: str
    event_type: str
    free_seats: int
    total_seats: int

    class Config:
        from_attributes = True


class BookingCreate(BaseModel):
    event_id: Optional[int] = None
    room_id: Optional[int] = None
    seats: List[str]
    start_time: Optional[datetime] = None
    duration_hours: Optional[int] = None


class BookingOut(BaseModel):
    id: int
    event_id: Optional[int] = None
    room_id: Optional[int] = None
    event_title: str
    room_name: str
    seats: List[str]
    status: str
    booked_at: datetime
    booking_start: Optional[datetime] = None
    booking_end: Optional[datetime] = None
    event_date: str
    qr_token: Optional[str] = None
    qr_url: Optional[str] = None
    checked_in_at: Optional[datetime] = None


class RoomSchema(BaseModel):
    id: int
    name: str
    capacity: int
    seating_schema: dict
    is_active: bool


class RoomCreate(BaseModel):
    name: str
    capacity: int
    seating_schema: dict
    is_active: bool = True


class RoomUpdate(RoomCreate):
    pass


class MentorRequestCreate(BaseModel):
    mentor_id: int
    message: str
    requested_slot: datetime


class MentorEventProposalCreate(BaseModel):
    title: str
    description: str
    room_id: int
    start_time: datetime
    end_time: datetime
    price: str = "Бесплатно"
    icon: str = "🎉"
    event_type: str


class MentorEventProposalOut(BaseModel):
    id: int
    mentor_id: int
    mentor_name: str
    title: str
    description: str
    room_id: int
    room_name: str
    start_time: datetime
    end_time: datetime
    price: str
    icon: str
    event_type: str
    status: str
    admin_comment: Optional[str] = None
    created_at: datetime


class ForumTopicCreate(BaseModel):
    title: str
    body: str
    tags: List[str] = []
    image_url: Optional[str] = None


class ForumMessageCreate(BaseModel):
    body: str
    image_url: Optional[str] = None


class ForumTopicOut(BaseModel):
    id: int
    title: str
    body: str
    tags: List[str] = []
    image_url: Optional[str] = None
    created_at: datetime
    is_closed: bool
    author_id: int
    author_name: str
    author_avatar: Optional[str] = None
    author_role: str
    author_bio: Optional[str] = None


class ForumMessageOut(BaseModel):
    id: int
    topic_id: int
    body: str
    image_url: Optional[str] = None
    created_at: datetime
    author_id: int
    author_name: str
    author_avatar: Optional[str] = None
    author_role: str
    author_bio: Optional[str] = None


class AdminSupportMessageCreate(BaseModel):
    body: str
    image_url: Optional[str] = None
    requester_id: Optional[int] = None


class AdminSupportMessageOut(BaseModel):
    id: int
    requester_id: int
    requester_name: str
    sender_id: int
    sender_name: str
    body: str
    image_url: Optional[str] = None
    created_at: datetime


class ChatThreadOut(BaseModel):
    thread_id: str
    chat_type: str
    chat_ref_id: int
    title: str
    avatar_url: Optional[str] = None


class ChatMessageCreate(BaseModel):
    thread_id: str
    body: str
    image_url: Optional[str] = None


class ChatMessageOut(BaseModel):
    id: int
    thread_id: str
    sender_id: int
    sender_name: str
    sender_avatar: Optional[str] = None
    sender_role: str
    body: str
    image_url: Optional[str] = None
    created_at: datetime