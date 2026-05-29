from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    name: str
    description: str | None = None


class CategoryCreate(CategoryBase):
    restaurant_id: UUID


class CategoryOut(CategoryBase):
    id: UUID
    restaurant_id: UUID

    model_config = ConfigDict(from_attributes=True)
