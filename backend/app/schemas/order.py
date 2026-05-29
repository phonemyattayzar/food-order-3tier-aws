from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import List


class OrderItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int


class OrderCreate(BaseModel):
    restaurant_id: UUID
    delivery_address: str
    items: List[OrderItemCreate]
    coupon_code: str | None = None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    menu_item_id: UUID
    quantity: int
    price_at_purchase: int


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    restaurant_id: UUID
    order_number: str
    order_status: str
    total_amount_mmk: int
    delivery_address: str
    
    rejection_reason: str | None = None
    accepted_at: datetime | None = None
    prepared_at: datetime | None = None
    dispatched_at: datetime | None = None
    delivered_at: datetime | None = None
    cancelled_at: datetime | None = None

    created_at: datetime
    updated_at: datetime | None = None
    restaurant_name: str | None = None

    order_items: List[OrderItemOut] = []


class OrderStatusUpdate(BaseModel):
    status: str
    rejection_reason: str | None = None
