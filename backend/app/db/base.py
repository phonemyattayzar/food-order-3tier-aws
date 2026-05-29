from app.db.base_class import Base

# Import all models here so Alembic can detect them
# Example:
# from app.models.user import User
# from app.models.restaurant import Restaurant
# from app.models.menu_item import MenuItem
# 👇 This is REQUIRED so Alembic can detect the table
from app.models.user import User
from app.models.restaurant import Restaurant
from app.models.category import Category
from app.models.menu_item import MenuItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.audit_log import AuditLog
from app.models.review import Review
from app.models.coupon import Coupon
from app.models.notification import Notification