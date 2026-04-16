from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from auth import authenticate_user, create_access_token, get_password_hash, get_current_user, get_current_active_user, ACCESS_TOKEN_EXPIRE_MINUTES
from database import get_db
import models, schemas

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(
        (models.User.username == user.username) | (models.User.email == user.email)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    hashed = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed,
        role=models.UserRole.USER
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db), request: Request = None):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    if request:
        auth_log = models.AuthLog(
            user_id=user.id,
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        db.add(auth_log)
        db.commit()
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserOut)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=schemas.UserOut)
def update_profile(
        payload: schemas.ProfileUpdate,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.telegram_id is not None:
        user.telegram_id = payload.telegram_id
    if payload.contact_email is not None:
        user.contact_email = payload.contact_email
    if payload.contact_other is not None:
        user.contact_other = payload.contact_other
    if payload.preferred_language is not None:
        user.preferred_language = payload.preferred_language
    if payload.city is not None:
        user.city = payload.city
    if payload.preferred_office is not None:
        user.preferred_office = payload.preferred_office

    db.commit()
    db.refresh(user)
    return user