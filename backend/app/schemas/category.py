from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    name: str
    description: str | None = None


class CategoryCreate(CategoryBase):
    restaurant_id: UUID


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class CategoryOut(CategoryBase):
    id: UUID
    restaurant_id: UUID

    model_config = ConfigDict(from_attributes=True)


from app.schemas.menu_item import MenuItemOut


class CategoryWithMenuItems(CategoryOut):
    menu_items: list[MenuItemOut] = []

