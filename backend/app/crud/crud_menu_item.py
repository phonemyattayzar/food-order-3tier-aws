from datetime import datetime
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.menu_item import MenuItem
from app.schemas.menu_item import MenuItemCreate


def get_menu_item(db: Session, menu_item_id: UUID) -> MenuItem | None:
    return (
        db.query(MenuItem)
        .filter(MenuItem.id == menu_item_id, MenuItem.deleted_at.is_(None))
        .first()
    )


def create_menu_item(db: Session, menu_item_in: MenuItemCreate) -> MenuItem:
    db_menu_item = MenuItem(
        name=menu_item_in.name,
        description=menu_item_in.description,
        price_mmk=menu_item_in.price_mmk,
        is_available=menu_item_in.is_available,
        preparation_time_minutes=menu_item_in.preparation_time_minutes,
        image_url=menu_item_in.image_url,
        restaurant_id=menu_item_in.restaurant_id,
        category_id=menu_item_in.category_id,
    )

    db.add(db_menu_item)
    db.commit()
    db.refresh(db_menu_item)
    return db_menu_item


def get_menu_items_by_restaurant(db: Session, restaurant_id: UUID) -> list[MenuItem]:
    return (
        db.query(MenuItem)
        .filter(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.deleted_at.is_(None)
        )
        .all()
    )


def get_menu_items_by_category(db: Session, category_id: UUID) -> list[MenuItem]:
    return (
        db.query(MenuItem)
        .filter(
            MenuItem.category_id == category_id,
            MenuItem.deleted_at.is_(None)
        )
        .all()
    )


def update_menu_item(db: Session, db_menu_item: MenuItem, menu_item_in: dict) -> MenuItem:
    for field, value in menu_item_in.items():
        setattr(db_menu_item, field, value)
    db.commit()
    db.refresh(db_menu_item)
    return db_menu_item


def delete_menu_item(db: Session, menu_item_id: UUID) -> bool:
    db_menu_item = get_menu_item(db, menu_item_id)
    if db_menu_item:
        db_menu_item.deleted_at = datetime.utcnow()
        db.commit()
        return True
    return False
