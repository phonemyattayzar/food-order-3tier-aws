from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CouponBase(BaseModel):
    code: str
    discount_percent: int | None = Field(None, ge=1, le=100)
    discount_amount_mmk: int | None = Field(None, ge=0)
    min_order_amount_mmk: int = Field(0, ge=0)
    max_discount_mmk: int | None = Field(None, ge=0)
    valid_from: datetime = Field(default_factory=datetime.utcnow)
    valid_until: datetime
    is_active: bool = True
    usage_limit: int | None = Field(None, ge=1)


class CouponCreate(CouponBase):
    restaurant_id: UUID | None = None


class CouponOut(CouponBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    used_count: int
    restaurant_id: UUID | None
