from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_active_user, require_role

router = APIRouter(prefix="/api/mentors", tags=["mentors"])


@router.post("/apply")
def apply_mentor(
        application: schemas.MentorApplicationCreate,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    # Если есть pending-заявка, обновляем ее, а не падаем 400
    existing = db.query(models.MentorApplication).filter(
        models.MentorApplication.user_id == current_user.id,
        models.MentorApplication.status == "pending"
    ).first()
    if existing:
        existing.skills = application.skills
        existing.bio = application.bio
        existing.company = application.company
        existing.github = application.github
        existing.work_experience = application.work_experience
        existing.mentor_pitch = application.mentor_pitch
        existing.phone = application.phone or current_user.phone
        existing.telegram_id = application.telegram_id or current_user.telegram_id
        existing.contact_email = application.contact_email or current_user.contact_email or current_user.email
        existing.contact_other = application.contact_other or current_user.contact_other
        db.commit()
        return {"message": "Pending application updated"}

    new_app = models.MentorApplication(
        user_id=current_user.id,
        skills=application.skills,
        bio=application.bio,
        company=application.company,
        github=application.github,
        work_experience=application.work_experience,
        mentor_pitch=application.mentor_pitch,
        phone=application.phone or current_user.phone,
        telegram_id=application.telegram_id or current_user.telegram_id,
        contact_email=application.contact_email or current_user.contact_email or current_user.email,
        contact_other=application.contact_other or current_user.contact_other,
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return {"message": "Application submitted successfully"}


@router.get("/applications")
def get_pending_applications(
        _=Depends(require_role("admin")),
        db: Session = Depends(get_db)
):
    apps = db.query(models.MentorApplication).filter(models.MentorApplication.status == "pending").all()
    result = []
    for app in apps:
        user = db.query(models.User).filter(models.User.id == app.user_id).first()
        result.append({
            "id": app.id,
            "user_id": app.user_id,
            "username": user.username if user else "Unknown",
            "email": user.email if user else "",
            "skills": app.skills,
            "bio": app.bio,
            "company": app.company,
            "github": app.github,
            "status": app.status,
            "applied_at": app.applied_at
        })
    return result


@router.put("/applications/{app_id}/approve")
def approve_mentor(
        app_id: int,
        _=Depends(require_role("admin")),
        db: Session = Depends(get_db)
):
    app = db.query(models.MentorApplication).filter(models.MentorApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    app.status = "approved"
    user = db.query(models.User).filter(models.User.id == app.user_id).first()
    if user:
        user.role = models.UserRole.MENTOR
        user.mentor_approved = True
        user.skills = app.skills
        user.bio = app.bio
        user.company = app.company
        user.github = app.github
        user.work_experience = app.work_experience
        user.mentor_pitch = app.mentor_pitch
    db.commit()
    return {"message": "Mentor approved"}


@router.put("/applications/{app_id}/reject")
def reject_mentor(
        app_id: int,
        _=Depends(require_role("admin")),
        db: Session = Depends(get_db)
):
    app = db.query(models.MentorApplication).filter(models.MentorApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    app.status = "rejected"
    db.commit()
    return {"message": "Application rejected"}
@router.get("/list")
def get_mentors_list(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    mentors = db.query(models.User).filter(
        models.User.role == models.UserRole.MENTOR,
        models.User.is_active == True,
        models.User.accepting_mentor_requests == True
    ).all()
    return [
        {
            "id": m.id,
            "username": m.username,
            "full_name": m.full_name,
            "avatar_url": m.avatar_url,
            "skills": m.skills,
            "bio": m.bio,
            "work_experience": m.work_experience,
            "mentor_pitch": m.mentor_pitch,
            "company": m.company,
            "github": m.github,
            "phone": m.phone,
            "telegram_id": m.telegram_id,
            "contact_email": m.contact_email,
            "contact_other": m.contact_other,
        } for m in mentors
    ]


@router.get("/profile", response_model=schemas.MentorProfileOut)
def get_my_mentor_profile(
        current_user: models.User = Depends(require_role("mentor"))
):
    return current_user


@router.put("/profile", response_model=schemas.MentorProfileOut)
def update_my_mentor_profile(
        payload: schemas.MentorProfileUpdate,
        current_user: models.User = Depends(require_role("mentor")),
        db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Обновляем только те поля, которые явно переданы (чтобы PATCH-подобные запросы
    # не стирали существующие данные).
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    if payload.bio is not None:
        user.bio = payload.bio
    if payload.work_experience is not None:
        user.work_experience = payload.work_experience
    if payload.skills is not None:
        user.skills = payload.skills
    if payload.mentor_pitch is not None:
        user.mentor_pitch = payload.mentor_pitch
    if payload.company is not None:
        user.company = payload.company
    if payload.github is not None:
        user.github = payload.github
    if payload.accepting_mentor_requests is not None:
        user.accepting_mentor_requests = payload.accepting_mentor_requests

    db.commit()
    db.refresh(user)
    return user


@router.post("/event-proposals")
def create_event_proposal(
        payload: schemas.MentorEventProposalCreate,
        current_user: models.User = Depends(require_role("mentor")),
        db: Session = Depends(get_db)
):
    proposal = models.MentorEventProposal(
        mentor_id=current_user.id,
        title=payload.title,
        description=payload.description,
        room_id=payload.room_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        price=payload.price,
        icon=payload.icon,
        event_type=payload.event_type,
        status="pending",
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return {"message": "Event proposal sent", "id": proposal.id}


@router.get("/event-proposals/my", response_model=List[schemas.MentorEventProposalOut])
def list_my_event_proposals(
        current_user: models.User = Depends(require_role("mentor")),
        db: Session = Depends(get_db)
):
    proposals = db.query(models.MentorEventProposal).filter(
        models.MentorEventProposal.mentor_id == current_user.id
    ).order_by(models.MentorEventProposal.created_at.desc()).all()

    result = []
    for p in proposals:
        room = db.query(models.Room).filter(models.Room.id == p.room_id).first()
        result.append(schemas.MentorEventProposalOut(
            id=p.id,
            mentor_id=p.mentor_id,
            mentor_name=current_user.full_name if current_user.full_name else current_user.username,
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
    return result


@router.post("/requests")
def create_mentor_request(
        request_payload: schemas.MentorRequestCreate,
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    mentor = db.query(models.User).filter(
        models.User.id == request_payload.mentor_id,
        models.User.role == models.UserRole.MENTOR,
        models.User.is_active == True
    ).first()
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")

    new_request = models.MentorRequest(
        student_id=current_user.id,
        mentor_id=request_payload.mentor_id,
        message=request_payload.message,
        requested_slot=request_payload.requested_slot
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    return {"message": "Mentor request sent", "id": new_request.id}


@router.get("/requests/sent", response_model=List[schemas.MentorRequestOut])
def get_sent_mentor_requests(
        current_user: models.User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    requests = db.query(models.MentorRequest).filter(
        models.MentorRequest.student_id == current_user.id
    ).order_by(models.MentorRequest.created_at.desc()).all()

    result = []
    for req in requests:
        mentor = db.query(models.User).filter(models.User.id == req.mentor_id).first()
        result.append(schemas.MentorRequestOut(
            id=req.id,
            mentor_id=req.mentor_id,
            mentor_name=mentor.full_name if mentor and mentor.full_name else (mentor.username if mentor else "Unknown"),
            student_name=current_user.full_name if current_user.full_name else current_user.username,
            student_username=current_user.username,
            message=req.message,
            requested_slot=req.requested_slot,
            status=req.status,
            created_at=req.created_at
        ))
    return result


@router.get("/requests/my", response_model=List[schemas.MentorRequestOut])
def get_my_mentor_requests(
        current_user: models.User = Depends(require_role("mentor")),
        db: Session = Depends(get_db)
):
    requests = db.query(models.MentorRequest).filter(
        models.MentorRequest.mentor_id == current_user.id
    ).order_by(models.MentorRequest.created_at.desc()).all()

    result = []
    for req in requests:
        student = db.query(models.User).filter(models.User.id == req.student_id).first()
        result.append(schemas.MentorRequestOut(
            id=req.id,
            mentor_id=req.mentor_id,
            mentor_name=current_user.full_name if current_user.full_name else current_user.username,
            student_name=student.full_name if student and student.full_name else (student.username if student else "Unknown"),
            student_username=student.username if student else "unknown",
            message=req.message,
            requested_slot=req.requested_slot,
            status=req.status,
            created_at=req.created_at
        ))
    return result


@router.put("/requests/{request_id}/accept")
def accept_mentor_request(
        request_id: int,
        current_user: models.User = Depends(require_role("mentor")),
        db: Session = Depends(get_db)
):
    mentor_request = db.query(models.MentorRequest).filter(
        models.MentorRequest.id == request_id,
        models.MentorRequest.mentor_id == current_user.id
    ).first()
    if not mentor_request:
        raise HTTPException(status_code=404, detail="Request not found")
    mentor_request.status = "accepted"
    db.commit()
    return {"message": "Mentor request accepted"}


@router.put("/requests/{request_id}/reject")
def reject_mentor_request(
        request_id: int,
        current_user: models.User = Depends(require_role("mentor")),
        db: Session = Depends(get_db)
):
    mentor_request = db.query(models.MentorRequest).filter(
        models.MentorRequest.id == request_id,
        models.MentorRequest.mentor_id == current_user.id
    ).first()
    if not mentor_request:
        raise HTTPException(status_code=404, detail="Request not found")
    mentor_request.status = "rejected"
    db.commit()
    return {"message": "Mentor request rejected"}