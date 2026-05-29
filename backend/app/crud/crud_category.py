from datetime import datetime
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.category import Category
from app.schemas.category import CategoryCreate


def get_category(db: Session, category_id: UUID) -> Category | None:
    return (
        db.query(Category)
        .filter(Category.id == category_id, Category.deleted_at.is_(None))
        .first()
    )


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
        .filter(
            Category.restaurant_id == restaurant_id,
            Category.deleted_at.is_(None)
        )
        .all()
    )


def update_category(db: Session, db_category: Category, category_in: dict) -> Category:
    for field, value in category_in.items():
        setattr(db_category, field, value)
    db.commit()
    db.refresh(db_category)
    return db_category


def delete_category(db: Session, category_id: UUID) -> bool:
    db_category = get_category(db, category_id)
    if db_category:
        db_category.deleted_at = datetime.utcnow()
        db.commit()
        return True
    return False
