from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.models.user import User
from app.models.restaurant import Restaurant, RestaurantStatus
from app.models.order import Order, OrderStatus
from app.models.audit_log import AuditLog


def create_audit_log(
    db: Session,
    user_id: UUID,
    action: str,
    target_type: str,
    target_id: str | None = None,
    details: dict | None = None,
):
    log = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    db.add(log)
    db.commit()
    return log


def get_all_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()


def update_user_active_status(db: Session, user_id: UUID, is_active: bool, admin_id: UUID):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_active = is_active
        db.commit()
        action = "activate_user" if is_active else "suspend_user"
        create_audit_log(db, admin_id, action, "user", str(user_id))
    return user


def update_restaurant_status(
    db: Session, restaurant_id: UUID, status: RestaurantStatus, admin_id: UUID
):
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if restaurant:
        restaurant.status = status
        db.commit()
        db.refresh(restaurant)
        create_audit_log(
            db, admin_id, f"update_status_{status.value}", "restaurant", str(restaurant_id)
        )
        db.refresh(restaurant)
    return restaurant


def get_platform_stats(db: Session):
    total_users = db.query(func.count(User.id)).scalar()
    total_restaurants = db.query(func.count(Restaurant.id)).filter(Restaurant.status == RestaurantStatus.approved).scalar()
    total_orders = db.query(func.count(Order.id)).scalar()
    total_revenue = db.query(func.sum(Order.total_amount_mmk)).filter(Order.order_status == OrderStatus.completed).scalar() or 0
    
    return {
        "total_users": total_users,
        "total_restaurants": total_restaurants,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
    }
