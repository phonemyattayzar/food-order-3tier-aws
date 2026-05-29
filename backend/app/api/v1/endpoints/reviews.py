from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewOut
from app.crud.crud_review import (
    create_review,
    get_reviews_by_restaurant,
    get_restaurant_rating,
)
from app.crud.crud_restaurant import get_restaurant
from app.models.order import Order, OrderStatus

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def post_review(
    review_in: ReviewCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # 1. Verify restaurant exists
    restaurant = get_restaurant(db, review_in.restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # 2. If order_id is provided, verify it belongs to user and is completed
    if review_in.order_id:
        order = db.query(Order).filter(Order.id == review_in.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your order")
        if order.order_status != OrderStatus.completed:
            raise HTTPException(status_code=400, detail="Order must be completed to review")
        if order.restaurant_id != review_in.restaurant_id:
            raise HTTPException(status_code=400, detail="Order does not match restaurant")

    review = create_review(
        db,
        user_id=current_user.id,
        restaurant_id=review_in.restaurant_id,
        rating=review_in.rating,
        comment=review_in.comment,
        order_id=review_in.order_id,
    )
    
    out = ReviewOut.model_validate(review)
    return out.model_copy(update={"user_name": current_user.full_name})


@router.get("/restaurant/{restaurant_id}", response_model=list[ReviewOut])
def list_restaurant_reviews(
    restaurant_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_session),
):
    reviews = get_reviews_by_restaurant(db, restaurant_id, skip=skip, limit=limit)
    out_list = []
    for r in reviews:
        item = ReviewOut.model_validate(r)
        if r.user:
            item = item.model_copy(update={"user_name": r.user.full_name})
        out_list.append(item)
    return out_list


@router.get("/restaurant/{restaurant_id}/rating")
def restaurant_rating(
    restaurant_id: UUID,
    db: Session = Depends(get_session),
):
    return get_restaurant_rating(db, restaurant_id)
