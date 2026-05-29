import secrets
from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.menu_item import MenuItem
from app.models.restaurant import Restaurant
from app.schemas.order import OrderCreate
from app.crud.crud_notification import notify_new_order, notify_customer_order_update

OWNER_ADVANCE_STATUS = {
    OrderStatus.confirmed: OrderStatus.preparing,
    OrderStatus.preparing: OrderStatus.out_for_delivery,
    OrderStatus.out_for_delivery: OrderStatus.completed,
}

CUSTOMER_STATUS_MESSAGES = {
    OrderStatus.confirmed: ("Order confirmed", "Your order has been confirmed by the restaurant."),
    OrderStatus.preparing: ("Order preparing", "The restaurant is preparing your food."),
    OrderStatus.out_for_delivery: ("Out for delivery", "Your order is on the way."),
    OrderStatus.completed: ("Order delivered", "Your order has been delivered. Enjoy!"),
    OrderStatus.cancelled: ("Order cancelled", "Your order was cancelled."),
    OrderStatus.rejected: ("Order rejected", "The restaurant was unable to fulfill your order."),
}


def generate_order_number() -> str:
    date_part = datetime.utcnow().strftime("%Y%m%d")
    random_part = secrets.token_hex(3).upper()
    return f"ORD-{date_part}-{random_part}"


def create_order(db: Session, order_in: OrderCreate, user_id: UUID):
    try:
        menu_item_ids = list({item.menu_item_id for item in order_in.items})

        if not menu_item_ids:
            raise ValueError("Order must contain at least one item")

        menu_items = (
            db.query(MenuItem)
            .filter(MenuItem.id.in_(menu_item_ids))
            .all()
        )

        menu_item_map = {item.id: item for item in menu_items}

        total_amount = 0
        order_items_to_create = []

        for item in order_in.items:
            menu_item = menu_item_map.get(item.menu_item_id)

            if not menu_item:
                raise ValueError(f"Menu item with ID {item.menu_item_id} not found")

            if menu_item.restaurant_id != order_in.restaurant_id:
                raise ValueError("Menu item does not belong to this restaurant")

            if not menu_item.is_available:
                raise ValueError(f"{menu_item.name} is currently unavailable")

            item_total = menu_item.price_mmk * item.quantity
            total_amount += item_total

            order_items_to_create.append(
                {
                    "menu_item_id": menu_item.id,
                    "quantity": item.quantity,
                    "price_at_purchase": menu_item.price_mmk,
                }
            )

        # Coupon application
        coupon_id_to_increment = None
        if hasattr(order_in, "coupon_code") and order_in.coupon_code:
            from app.crud.crud_coupon import validate_and_calculate_discount, get_coupon_by_code
            discount, err = validate_and_calculate_discount(
                db, order_in.coupon_code, order_in.restaurant_id, total_amount
            )
            if err:
                raise ValueError(err)
            coupon = get_coupon_by_code(db, order_in.coupon_code, order_in.restaurant_id)
            if coupon:
                coupon_id_to_increment = coupon.id
            total_amount = max(0, total_amount - discount)

        db_order = Order(
            user_id=user_id,
            restaurant_id=order_in.restaurant_id,
            delivery_address=order_in.delivery_address,
            order_number=generate_order_number(),
            total_amount_mmk=total_amount,
            order_status=OrderStatus.pending,
        )

        db.add(db_order)
        db.flush()

        if coupon_id_to_increment:
            from app.crud.crud_coupon import increment_coupon_usage
            increment_coupon_usage(db, coupon_id_to_increment)

        for item in order_items_to_create:
            db_order_item = OrderItem(
                order_id=db_order.id,
                menu_item_id=item["menu_item_id"],
                quantity=item["quantity"],
                price_at_purchase=item["price_at_purchase"],
            )
            db.add(db_order_item)

        notify_new_order(db, db_order)
        db.commit()
        return get_order(db, db_order.id)

    except Exception:
        db.rollback()
        raise


def _order_query(db: Session):
    return db.query(Order).options(
        joinedload(Order.restaurant),
        joinedload(Order.order_items),
    )


def get_order(db: Session, order_id: UUID):
    return _order_query(db).filter(Order.id == order_id).first()


def get_orders_by_user(db: Session, user_id: UUID):
    return (
        _order_query(db)
        .filter(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
        .all()
    )


def get_orders_by_restaurant(
    db: Session,
    restaurant_id: UUID,
    status: OrderStatus | None = None,
):
    query = _order_query(db).filter(Order.restaurant_id == restaurant_id)
    if status is not None:
        query = query.filter(Order.order_status == status)
    return query.order_by(Order.created_at.desc()).all()


def get_owner_sales_summary(db: Session, owner_id: UUID):
    # Total revenue and order count for all restaurants owned by the user
    summary = (
        db.query(
            func.sum(Order.total_amount_mmk).label("total_revenue"),
            func.count(Order.id).label("total_orders"),
        )
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .filter(
            Restaurant.owner_id == owner_id,
            Order.order_status == OrderStatus.completed,
        )
        .first()
    )
    
    # Daily sales for the last 30 days
    daily_sales = (
        db.query(
            func.date(Order.created_at).label("date"),
            func.sum(Order.total_amount_mmk).label("revenue"),
            func.count(Order.id).label("orders"),
        )
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .filter(
            Restaurant.owner_id == owner_id,
            Order.order_status == OrderStatus.completed,
        )
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at).desc())
        .limit(30)
        .all()
    )
    
    return {
        "total_revenue": summary.total_revenue or 0,
        "total_orders": summary.total_orders or 0,
        "daily_sales": [
            {"date": str(s.date), "revenue": s.revenue, "orders": s.orders}
            for s in daily_sales
        ],
    }


def get_orders_for_owner(db: Session, owner_id: UUID, status: OrderStatus | None = None):
    query = (
        _order_query(db)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .filter(Restaurant.owner_id == owner_id)
    )
    if status is not None:
        query = query.filter(Order.order_status == status)
    return query.order_by(Order.created_at.desc()).all()


def get_all_orders(db: Session, status: OrderStatus | None = None):
    query = _order_query(db)
    if status is not None:
        query = query.filter(Order.order_status == status)
    return query.order_by(Order.created_at.desc()).all()


def get_pending_orders_for_owner(db: Session, owner_id: UUID):
    return get_orders_for_owner(db, owner_id, OrderStatus.pending)


def get_pending_orders_all(db: Session):
    return get_all_orders(db, OrderStatus.pending)


def _notify_customer_status(db: Session, order: Order, new_status: OrderStatus):
    title, message = CUSTOMER_STATUS_MESSAGES.get(
        new_status,
        ("Order updated", f"Your order {order.order_number} status is now {new_status.value}."),
    )
    notify_customer_order_update(db, order, title, message)


def approve_order(db: Session, order_id: UUID) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.order_status != OrderStatus.pending:
        raise ValueError("Only pending orders can be approved")
    order.order_status = OrderStatus.confirmed
    order.accepted_at = datetime.utcnow()
    _notify_customer_status(db, order, OrderStatus.confirmed)
    db.commit()
    return get_order(db, order_id)


def reject_order(db: Session, order_id: UUID, reason: str | None = None) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.order_status != OrderStatus.pending:
        raise ValueError("Only pending orders can be rejected")
    order.order_status = OrderStatus.rejected
    order.rejection_reason = reason
    order.cancelled_at = datetime.utcnow()
    _notify_customer_status(db, order, OrderStatus.rejected)
    db.commit()
    return get_order(db, order_id)


def cancel_order_by_customer(db: Session, order_id: UUID, user_id: UUID) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.user_id != user_id:
        raise ValueError("You can only cancel your own orders")
    if order.order_status != OrderStatus.pending:
        raise ValueError("You can only cancel orders before the restaurant confirms them")
    order.order_status = OrderStatus.cancelled
    order.cancelled_at = datetime.utcnow()
    db.commit()
    return get_order(db, order_id)


def advance_order_status(db: Session, order_id: UUID, new_status: OrderStatus) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise ValueError("Order not found")

    expected_next = OWNER_ADVANCE_STATUS.get(order.order_status)
    if expected_next != new_status:
        raise ValueError(
            f"Cannot move order from '{order.order_status.value}' to '{new_status.value}'"
        )

    order.order_status = new_status
    if new_status == OrderStatus.preparing:
        order.prepared_at = datetime.utcnow()
    elif new_status == OrderStatus.out_for_delivery:
        order.dispatched_at = datetime.utcnow()
    elif new_status == OrderStatus.completed:
        order.delivered_at = datetime.utcnow()

    _notify_customer_status(db, order, new_status)
    db.commit()
    return get_order(db, order_id)
