import uuid
from sqlalchemy import Column, String, Integer, Text, ForeignKey, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.db.base_class import Base



class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    preparing = "preparing"
    out_for_delivery = "out_for_delivery"
    completed = "completed"
    cancelled = "cancelled"
    rejected = "rejected"

class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)

    order_number = Column(String, unique=True, index=True, nullable=False)

    order_status = Column(Enum(OrderStatus), default=OrderStatus.pending)

    total_amount_mmk = Column(Integer, nullable=False)

    delivery_address = Column(Text, nullable=False)

    rejection_reason = Column(Text, nullable=True)

    # Status change timestamps
    accepted_at = Column(DateTime, nullable=True)
    prepared_at = Column(DateTime, nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="orders")
    restaurant = relationship("Restaurant", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="order", cascade="all, delete-orphan")