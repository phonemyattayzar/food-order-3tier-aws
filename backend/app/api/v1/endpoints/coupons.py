from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.api.deps import get_current_user, get_current_active_admin
from app.models.user import User, UserRole
from app.schemas.coupon import CouponCreate, CouponOut
from app.crud.crud_coupon import create_coupon, get_coupon_by_code
from app.crud.crud_restaurant import get_restaurant

router = APIRouter(prefix="/coupons", tags=["coupons"])


@router.post("/", response_model=CouponOut, status_code=status.HTTP_201_CREATED)
def create_new_coupon(
    coupon_in: CouponCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Only admins can create platform-wide coupons
    # Only restaurant owners can create their own coupons
    if coupon_in.restaurant_id is None:
        if current_user.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Only admins can create platform coupons")
    else:
        restaurant = get_restaurant(db, coupon_in.restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        if restaurant.owner_id != current_user.id and current_user.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Not authorized")

    coupon_data = coupon_in.model_dump()
    coupon_data["code"] = coupon_data["code"].upper()
    
    return create_coupon(db, coupon_data)


@router.get("/validate/{code}")
def validate_coupon(
    code: str,
    restaurant_id: UUID,
    db: Session = Depends(get_session),
):
    coupon = get_coupon_by_code(db, code, restaurant_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid or expired coupon")
        
    if coupon.usage_limit and coupon.used_count >= coupon.usage_limit:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
        
    return {
        "valid": True,
        "code": coupon.code,
        "discount_percent": coupon.discount_percent,
        "discount_amount_mmk": coupon.discount_amount_mmk,
        "min_order_amount_mmk": coupon.min_order_amount_mmk,
        "max_discount_mmk": coupon.max_discount_mmk,
    }
