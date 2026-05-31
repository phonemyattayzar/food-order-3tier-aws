from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.api.deps import get_current_active_admin
from app.models.user import User
from app.models.restaurant import RestaurantStatus
from app.schemas.user import UserOut
from app.schemas.restaurant import RestaurantOut
from app.crud.crud_admin import (
    get_all_users,
    update_user_active_status,
    update_restaurant_status,
    get_platform_stats,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    return get_all_users(db, skip=skip, limit=limit)


@router.patch("/users/{user_id}/active")
def toggle_user_active(
    user_id: UUID,
    is_active: bool,
    db: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    user = update_user_active_status(db, user_id=user_id, is_active=is_active, admin_id=current_admin.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User status updated to {'active' if is_active else 'suspended'}"}


@router.patch("/restaurants/{restaurant_id}/status", response_model=RestaurantOut)
def update_restaurant_approval(
    restaurant_id: UUID,
    status: RestaurantStatus,
    db: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    restaurant = update_restaurant_status(
        db, restaurant_id=restaurant_id, status=status, admin_id=current_admin.id
    )
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


@router.get("/stats")
def platform_stats(
    db: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    return get_platform_stats(db)


@router.get("/restaurants", response_model=list[RestaurantOut])
def list_all_restaurants_for_admin(
    status: RestaurantStatus | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    from app.crud.crud_restaurant import get_multi_restaurants
    return get_multi_restaurants(db=db, skip=skip, limit=limit, status=status)
