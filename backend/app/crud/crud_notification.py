from uuid import UUID

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User, UserRole
from app.crud.crud_restaurant import get_restaurant


def create_notification(
    db: Session,
    user_id: UUID,
    title: str,
    message: str,
    order_id: UUID | None = None,
):
    notification = Notification(
        user_id=user_id,
        order_id=order_id,
        title=title,
        message=message,
        is_read=False,
    )
    db.add(notification)
    return notification


def notify_new_order(db: Session, order):
    restaurant = get_restaurant(db, order.restaurant_id)
    if not restaurant:
        return

    title = "New customer order"
    message = (
        f"Order {order.order_number} for {order.total_amount_mmk:,} MMK "
        f"is awaiting your approval."
    )

    create_notification(
        db,
        user_id=restaurant.owner_id,
        title=title,
        message=message,
        order_id=order.id,
    )

    admins = db.query(User).filter(User.role == UserRole.admin).all()
    for admin in admins:
        create_notification(
            db,
            user_id=admin.id,
            title=title,
            message=message,
            order_id=order.id,
        )


def notify_customer_order_update(db: Session, order, title: str, message: str):
    create_notification(
        db,
        user_id=order.user_id,
        title=title,
        message=message,
        order_id=order.id,
    )


def get_notifications_for_user(db: Session, user_id: UUID, unread_only: bool = False):
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(Notification.created_at.desc()).all()


def get_unread_count(db: Session, user_id: UUID) -> int:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .count()
    )


def mark_notification_read(db: Session, notification_id: UUID, user_id: UUID):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if notification:
        notification.is_read = True
        db.commit()
    return notification


def mark_all_notifications_read(db: Session, user_id: UUID):
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    ).update({"is_read": True})
    db.commit()
