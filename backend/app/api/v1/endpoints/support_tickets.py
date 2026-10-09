from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.crud_support_ticket import (
    create_support_ticket,
    list_support_tickets_for_user,
)
from app.db.session import get_session
from app.models.user import User
from app.schemas.support_ticket import SupportTicketCreate, SupportTicketOut


router = APIRouter(prefix="/support-tickets", tags=["support-tickets"])


def require_support_tickets_enabled() -> None:
    if not settings.SUPPORT_TICKETS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Support tickets are not enabled",
        )


@router.post("/", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
def submit_support_ticket(
    ticket_in: SupportTicketCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    require_support_tickets_enabled()
    return create_support_ticket(
        db,
        user_id=current_user.id,
        subject=ticket_in.subject,
        message=ticket_in.message,
    )


@router.get("/", response_model=list[SupportTicketOut])
def get_my_support_tickets(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    require_support_tickets_enabled()
    return list_support_tickets_for_user(db, user_id=current_user.id)
