import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class FavoriteCustomization(Base):
    __tablename__ = "favorite_customizations"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "restaurant_id",
            "name",
            name="uq_favorite_user_restaurant_name",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    restaurant_id = Column(
        UUID(as_uuid=True), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(80), nullable=False)
    customization_note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    items = relationship(
        "FavoriteCustomizationItem",
        back_populates="favorite",
        cascade="all, delete-orphan",
    )


class FavoriteCustomizationItem(Base):
    __tablename__ = "favorite_customization_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    favorite_id = Column(
        UUID(as_uuid=True),
        ForeignKey("favorite_customizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    menu_item_id = Column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False
    )
    quantity = Column(Integer, nullable=False)

    favorite = relationship("FavoriteCustomization", back_populates="items")
    menu_item = relationship("MenuItem")
