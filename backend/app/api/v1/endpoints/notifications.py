from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.crud.crud_notification import (
    get_notifications_for_user,
    get_unread_count,
    mark_notification_read,
    mark_all_notifications_read,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(False),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return get_notifications_for_user(
        db=db,
        user_id=current_user.id,
        unread_only=unread_only,
    )


@router.get("/unread-count")
def unread_notification_count(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return {"count": get_unread_count(db, current_user.id)}


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    mark_all_notifications_read(db, current_user.id)


@router.patch("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_one_read(
    notification_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    notification = mark_notification_read(db, notification_id, current_user.id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
