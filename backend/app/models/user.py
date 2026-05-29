import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base_class import Base
import enum
from sqlalchemy.orm import relationship



# -------------------------
# Role Enum (BEST PRACTICE)
# -------------------------
class UserRole(str, enum.Enum):
    customer = "customer"
    admin = "admin"
    owner = "owner"


# -------------------------
# User Model
# -------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        nullable=False
    )

    full_name = Column(String, nullable=False)

    email = Column(String, unique=True, index=True, nullable=False)

    password_hash = Column(String, nullable=False)

    role = Column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.customer
    )

    is_active = Column(Boolean, default=True)

    # -------------------------
    # Audit Columns
    # -------------------------
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    restaurants = relationship(
    "Restaurant",
    back_populates="owner",
    cascade="all, delete-orphan",
    )

    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )