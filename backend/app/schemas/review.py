from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


class ReviewCreate(ReviewBase):
    restaurant_id: UUID
    order_id: UUID | None = None


class ReviewOut(ReviewBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    restaurant_id: UUID
    order_id: UUID | None
    created_at: datetime
    user_name: str | None = None
