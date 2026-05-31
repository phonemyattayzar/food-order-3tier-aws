from sqlalchemy import or_
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.restaurant import Restaurant, RestaurantStatus
from app.models.user import User, UserRole
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


def get_restaurants_for_listing(
    db: Session,
    current_user: User | None = None,
    skip: int = 0,
    limit: int = 100,
    township: str | None = None,
    search: str | None = None,
):
    """Public explore list: approved for everyone; owners also see their own shops."""
    query = db.query(Restaurant).filter(Restaurant.deleted_at.is_(None))

    if township:
        query = query.filter(Restaurant.township.ilike(f"%{township}%"))
    if search:
        query = query.filter(
            (Restaurant.name.ilike(f"%{search}%"))
            | (Restaurant.description.ilike(f"%{search}%"))
        )

    if current_user and current_user.role == UserRole.owner:
        query = query.filter(
            or_(
                Restaurant.status == RestaurantStatus.approved,
                Restaurant.owner_id == current_user.id,
            )
        )
    else:
        query = query.filter(Restaurant.status == RestaurantStatus.approved)

    return query.offset(skip).limit(limit).all()


def restaurant_visible_to_user(restaurant: Restaurant, current_user: User | None) -> bool:
    if restaurant.deleted_at:
        return False
    if restaurant.status == RestaurantStatus.approved:
        return True
    if current_user is None:
        return False
    if current_user.role == UserRole.admin:
        return True
    if (
        current_user.role == UserRole.owner
        and restaurant.owner_id == current_user.id
    ):
        return True
    return False


def create_restaurant(db: Session, restaurant_in: RestaurantCreate, owner_id: UUID):
    db_restaurant = Restaurant(
        owner_id=owner_id,
        name=restaurant_in.name,
        description=restaurant_in.description,
        phone_number=restaurant_in.phone_number,
        address=restaurant_in.address,
        township=restaurant_in.township,
        is_open=restaurant_in.is_open,
        status=RestaurantStatus.pending,
    )

    db.add(db_restaurant)
    db.commit()
    db.refresh(db_restaurant)
    return db_restaurant
