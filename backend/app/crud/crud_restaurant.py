from sqlalchemy.orm import Session
from uuid import UUID

from app.models.restaurant import Restaurant, RestaurantStatus
from app.schemas.restaurant import RestaurantCreate


def get_restaurant(db: Session, restaurant_id: UUID):
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()


def get_multi_restaurants(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: RestaurantStatus | None = None,
    township: str | None = None,
    search: str | None = None,
):
    query = db.query(Restaurant).filter(Restaurant.deleted_at.is_(None))
    
    if status:
        query = query.filter(Restaurant.status == status)
    if township:
        query = query.filter(Restaurant.township.ilike(f"%{township}%"))
    if search:
        query = query.filter(
            (Restaurant.name.ilike(f"%{search}%")) |
            (Restaurant.description.ilike(f"%{search}%"))
        )
        
    return query.offset(skip).limit(limit).all()


def create_restaurant(db: Session, restaurant_in: RestaurantCreate, owner_id: UUID):
    db_restaurant = Restaurant(
        owner_id=owner_id,
        name=restaurant_in.name,
        description=restaurant_in.description,
        phone_number=restaurant_in.phone_number,
        address=restaurant_in.address,
        township=restaurant_in.township,
        is_open=restaurant_in.is_open,
    )

    db.add(db_restaurant)
    db.commit()
    db.refresh(db_restaurant)
    return db_restaurant
