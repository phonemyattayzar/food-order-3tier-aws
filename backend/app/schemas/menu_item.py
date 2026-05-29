from uuid import UUID
from pydantic import BaseModel, ConfigDict


class MenuItemBase(BaseModel):
    name: str
    description: str | None = None
    price_mmk: int
    is_available: bool = True
    preparation_time_minutes: int | None = None
    image_url: str | None = None



class MenuItemCreate(MenuItemBase):
    restaurant_id: UUID
    category_id: UUID | None = None


class MenuItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price_mmk: int | None = None
    is_available: bool | None = None
    preparation_time_minutes: int | None = None
    image_url: str | None = None
    category_id: UUID | None = None


class MenuItemOut(MenuItemBase):
    id: UUID
    restaurant_id: UUID
    category_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)
