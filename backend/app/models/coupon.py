import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, index=True, nullable=False)
    discount_percent = Column(Integer, nullable=True)  # e.g., 10 for 10%
    discount_amount_mmk = Column(Integer, nullable=True)
    min_order_amount_mmk = Column(Integer, default=0)
    max_discount_mmk = Column(Integer, nullable=True)
    
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=False)
    
    is_active = Column(Boolean, default=True)
    usage_limit = Column(Integer, nullable=True)
    used_count = Column(Integer, default=0)
    
    restaurant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=True,  # Null means platform-wide coupon
    )

    restaurant = relationship("Restaurant")
