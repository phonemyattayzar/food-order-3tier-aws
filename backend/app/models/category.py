import uuid
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, and_
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)

    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)

    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    restaurant = relationship("Restaurant", back_populates="categories")
    menu_items = relationship(
        "MenuItem",
        primaryjoin="and_(MenuItem.category_id==Category.id, MenuItem.deleted_at==None)",
        back_populates="category",
        cascade="all, delete-orphan"
    )