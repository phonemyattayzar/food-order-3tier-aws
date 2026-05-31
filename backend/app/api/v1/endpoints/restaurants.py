from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.api.deps import get_current_user, get_optional_current_user
from app.models.user import User, UserRole
from app.schemas.restaurant import RestaurantCreate, RestaurantOut
from app.crud.crud_restaurant import (
    create_restaurant,
    get_restaurant,
    get_restaurants_for_listing,
    restaurant_visible_to_user,
)

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.post(
    "/",
    response_model=RestaurantOut,
    status_code=status.HTTP_201_CREATED,
)
def create_new_restaurant(
    restaurant_in: RestaurantCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.owner and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Only owners can create restaurants")
        
    return create_restaurant(db=db, restaurant_in=restaurant_in, owner_id=current_user.id)



@router.get(
    "/",
    response_model=list[RestaurantOut],
)
def list_restaurants(
    skip: int = 0,
    limit: int = 100,
    township: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_optional_current_user),
):
    return get_restaurants_for_listing(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        township=township,
        search=search,
    )


@router.get(
    "/{restaurant_id}",
    response_model=RestaurantOut,
)
def get_restaurant_detail(
    restaurant_id: UUID,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_optional_current_user),
):
    restaurant = get_restaurant(db=db, restaurant_id=restaurant_id)

    if not restaurant or not restaurant_visible_to_user(restaurant, current_user):
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found",
        )

    return restaurant
