from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FavoriteItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(ge=1, le=50)


class FavoriteCustomizationCreate(BaseModel):
    restaurant_id: UUID
    name: str = Field(min_length=1, max_length=80)
    customization_note: str = Field(min_length=1, max_length=300)
    items: list[FavoriteItemCreate] = Field(min_length=1, max_length=30)


class FavoriteItemOut(BaseModel):
    id: UUID
    menu_item_id: UUID
    menu_item_name: str
    quantity: int
    price_mmk: int | None = None
    is_available: bool = False


class FavoriteCustomizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    restaurant_id: UUID
    name: str
    customization_note: str
    created_at: datetime
    updated_at: datetime | None = None
    items: list[FavoriteItemOut] = []
