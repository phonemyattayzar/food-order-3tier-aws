from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.favorite_customization import FavoriteCustomization, FavoriteCustomizationItem
from app.models.menu_item import MenuItem
from app.models.restaurant import Restaurant
from app.schemas.favorite_customization import (
    FavoriteCustomizationCreate,
    FavoriteCustomizationOut,
    FavoriteItemOut,
)

MAX_FAVORITES_PER_RESTAURANT = 20


def _to_out(favorite: FavoriteCustomization) -> FavoriteCustomizationOut:
    items = []
    for item in favorite.items:
        menu = item.menu_item
        available = bool(menu and menu.is_available and menu.deleted_at is None)
        items.append(
            FavoriteItemOut(
                id=item.id,
                menu_item_id=item.menu_item_id,
                menu_item_name=menu.name if menu else "Removed dish",
                quantity=item.quantity,
                price_mmk=menu.price_mmk if menu else None,
                is_available=available,
            )
        )
    return FavoriteCustomizationOut(
        id=favorite.id,
        user_id=favorite.user_id,
        restaurant_id=favorite.restaurant_id,
        name=favorite.name,
        customization_note=favorite.customization_note,
        created_at=favorite.created_at,
        updated_at=favorite.updated_at,
        items=items,
    )


def _favorite_query(db: Session):
    return db.query(FavoriteCustomization).options(
        joinedload(FavoriteCustomization.items).joinedload(FavoriteCustomizationItem.menu_item)
    )


def list_favorites(db: Session, user_id: UUID, restaurant_id: UUID) -> list[FavoriteCustomizationOut]:
    rows = (
        _favorite_query(db)
        .filter(
            FavoriteCustomization.user_id == user_id,
            FavoriteCustomization.restaurant_id == restaurant_id,
        )
        .order_by(FavoriteCustomization.updated_at.desc())
        .all()
    )
    unique_rows = []
    seen = set()
    for row in rows:
        if row.id in seen:
            continue
        seen.add(row.id)
        unique_rows.append(row)
    return [_to_out(row) for row in unique_rows]


def get_favorite(db: Session, favorite_id: UUID, user_id: UUID) -> FavoriteCustomization | None:
    return (
        _favorite_query(db)
        .filter(
            FavoriteCustomization.id == favorite_id,
            FavoriteCustomization.user_id == user_id,
        )
        .first()
    )


def upsert_favorite(
    db: Session, payload: FavoriteCustomizationCreate, user_id: UUID
) -> FavoriteCustomizationOut:
    restaurant = db.query(Restaurant).filter(Restaurant.id == payload.restaurant_id).first()
    if not restaurant:
        raise ValueError("Restaurant not found")

    name = payload.name.strip()
    note = payload.customization_note.strip()
    if not name:
        raise ValueError("Give this customization a name, such as My Usual")
    if not note:
        raise ValueError("Add how you want the food prepared")

    menu_ids = [item.menu_item_id for item in payload.items]
    if len(menu_ids) != len(set(menu_ids)):
        raise ValueError("Each dish can only appear once in a saved customization")

    menu_items = db.query(MenuItem).filter(MenuItem.id.in_(menu_ids)).all()
    menu_map = {item.id: item for item in menu_items}
    for item in payload.items:
        menu = menu_map.get(item.menu_item_id)
        if not menu or menu.deleted_at is not None:
            raise ValueError("One of the dishes in this customization no longer exists")
        if menu.restaurant_id != payload.restaurant_id:
            raise ValueError("Every dish must belong to this restaurant")

    existing = (
        db.query(FavoriteCustomization)
        .filter(
            FavoriteCustomization.user_id == user_id,
            FavoriteCustomization.restaurant_id == payload.restaurant_id,
            FavoriteCustomization.name == name,
        )
        .first()
    )

    if existing is None:
        count = (
            db.query(FavoriteCustomization)
            .filter(
                FavoriteCustomization.user_id == user_id,
                FavoriteCustomization.restaurant_id == payload.restaurant_id,
            )
            .count()
        )
        if count >= MAX_FAVORITES_PER_RESTAURANT:
            raise ValueError("You can save up to 20 favorite customizations per restaurant")
        favorite = FavoriteCustomization(
            user_id=user_id,
            restaurant_id=payload.restaurant_id,
            name=name,
            customization_note=note,
        )
        db.add(favorite)
        db.flush()
    else:
        existing.name = name
        existing.customization_note = note
        existing.updated_at = datetime.utcnow()
        db.query(FavoriteCustomizationItem).filter(
            FavoriteCustomizationItem.favorite_id == existing.id
        ).delete(synchronize_session=False)
        favorite = existing

    for item in payload.items:
        db.add(
            FavoriteCustomizationItem(
                favorite_id=favorite.id,
                menu_item_id=item.menu_item_id,
                quantity=item.quantity,
            )
        )

    db.commit()
    saved = get_favorite(db, favorite.id, user_id)
    return _to_out(saved)


def delete_favorite(db: Session, favorite_id: UUID, user_id: UUID) -> bool:
    favorite = (
        db.query(FavoriteCustomization)
        .filter(
            FavoriteCustomization.id == favorite_id,
            FavoriteCustomization.user_id == user_id,
        )
        .first()
    )
    if not favorite:
        return False
    db.delete(favorite)
    db.commit()
    return True
