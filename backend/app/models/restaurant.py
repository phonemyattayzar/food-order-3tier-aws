import uuid
import enum
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class RestaurantStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    suspended = "suspended"


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String, index=True, nullable=False)

    description = Column(Text, nullable=True)

    phone_number = Column(String, nullable=False)

    address = Column(Text, nullable=False)

    township = Column(String, nullable=False)

    logo_url = Column(String, nullable=True)

    cover_image_url = Column(String, nullable=True)

    is_open = Column(Boolean, default=True)

    status = Column(
        Enum(RestaurantStatus, name="restaurant_status"),
        nullable=False,
        default=RestaurantStatus.pending,
    )

    deleted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    owner = relationship(
        "User",
        back_populates="restaurants",
    )

    categories = relationship(
    "Category",
    back_populates="restaurant",
    cascade="all, delete-orphan"
    )

    menu_items = relationship(
        "MenuItem",
        back_populates="restaurant",
        cascade="all, delete-orphan"
    )

    orders = relationship("Order", back_populates="restaurant")

    reviews = relationship("Review", back_populates="restaurant", cascade="all, delete-orphan")