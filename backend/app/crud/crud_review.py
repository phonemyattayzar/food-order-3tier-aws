from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.review import Review
from app.models.restaurant import Restaurant


def create_review(
    db: Session,
    user_id: UUID,
    restaurant_id: UUID,
    rating: int,
    comment: str | None = None,
    order_id: UUID | None = None,
):
    review = Review(
        user_id=user_id,
        restaurant_id=restaurant_id,
        rating=rating,
        comment=comment,
        order_id=order_id,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def get_reviews_by_restaurant(db: Session, restaurant_id: UUID, skip: int = 0, limit: int = 100):
    return (
        db.query(Review)
        .filter(Review.restaurant_id == restaurant_id)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_restaurant_rating(db: Session, restaurant_id: UUID):
    result = (
        db.query(func.avg(Review.rating).label("average"), func.count(Review.id).label("count"))
        .filter(Review.restaurant_id == restaurant_id)
        .first()
    )
    return {
        "average_rating": round(float(result.average or 0), 1),
        "review_count": result.count,
    }
