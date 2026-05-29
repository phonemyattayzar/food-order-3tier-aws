from sqlalchemy.orm import Session
from uuid import UUID

from app.models.category import Category
from app.schemas.category import CategoryCreate


def create_category(db: Session, category_in: CategoryCreate) -> Category:
    db_category = Category(
        name=category_in.name,
        description=category_in.description,
        restaurant_id=category_in.restaurant_id,
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_categories_by_restaurant(db: Session, restaurant_id: UUID) -> list[Category]:
    return (
        db.query(Category)
        .filter(Category.restaurant_id == restaurant_id)
        .all()
    )
