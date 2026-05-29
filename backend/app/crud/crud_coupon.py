from uuid import UUID
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.coupon import Coupon


def create_coupon(db: Session, coupon_in: dict) -> Coupon:
    db_coupon = Coupon(**coupon_in)
    db.add(db_coupon)
    db.commit()
    db.refresh(db_coupon)
    return db_coupon


def get_coupon_by_code(db: Session, code: str, restaurant_id: UUID | None = None) -> Coupon | None:
    query = db.query(Coupon).filter(
        Coupon.code == code.upper(),
        Coupon.is_active.is_(True),
        Coupon.valid_from <= datetime.utcnow(),
        Coupon.valid_until >= datetime.utcnow(),
    )
    
    if restaurant_id:
        # Platform-wide coupons (restaurant_id is null) or restaurant-specific coupons
        query = query.filter((Coupon.restaurant_id == restaurant_id) | (Coupon.restaurant_id.is_(None)))
    else:
        query = query.filter(Coupon.restaurant_id.is_(None))
        
    return query.first()


def validate_and_calculate_discount(db: Session, code: str, restaurant_id: UUID, order_amount: int):
    coupon = get_coupon_by_code(db, code, restaurant_id)
    if not coupon:
        return None, "Invalid or expired coupon code"
    
    if coupon.usage_limit and coupon.used_count >= coupon.usage_limit:
        return None, "Coupon usage limit reached"
        
    if order_amount < coupon.min_order_amount_mmk:
        return None, f"Minimum order amount of {coupon.min_order_amount_mmk:,} MMK required"
        
    discount = 0
    if coupon.discount_amount_mmk:
        discount = coupon.discount_amount_mmk
    elif coupon.discount_percent:
        discount = int(order_amount * (coupon.discount_percent / 100))
        if coupon.max_discount_mmk:
            discount = min(discount, coupon.max_discount_mmk)
            
    return discount, None


def increment_coupon_usage(db: Session, coupon_id: UUID):
    db.query(Coupon).filter(Coupon.id == coupon_id).update(
        {"used_count": Coupon.used_count + 1}
    )
    db.commit()
