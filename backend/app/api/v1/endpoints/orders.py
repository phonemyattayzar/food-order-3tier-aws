from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.models.order import OrderStatus

from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate

from app.crud.crud_order import (
    create_order,
    get_order,
    get_orders_by_user,
    get_orders_by_restaurant,
    get_orders_for_owner,
    get_all_orders,
    get_pending_orders_for_owner,
    get_pending_orders_all,
    approve_order,
    reject_order,
    cancel_order_by_customer,
    advance_order_status,
    get_owner_sales_summary,
    OWNER_ADVANCE_STATUS,
)
from app.crud.crud_restaurant import get_restaurant

router = APIRouter(
    prefix="/orders",
    tags=["orders"],
)


def _order_to_out(order) -> OrderOut:
    data = OrderOut.model_validate(order)
    if order.restaurant:
        return data.model_copy(update={"restaurant_name": order.restaurant.name})
    return data


def _orders_to_out(orders) -> list[OrderOut]:
    return [_order_to_out(o) for o in orders]


def _parse_status(status_str: str | None) -> OrderStatus | None:
    if not status_str or status_str == "all":
        return None
    try:
        return OrderStatus(status_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {status_str}",
        )


def _can_manage_order(db: Session, order, user: User) -> bool:
    if user.role == UserRole.admin:
        return True
    restaurant = get_restaurant(db, order.restaurant_id)
    return restaurant is not None and restaurant.owner_id == user.id


def _can_manage_restaurant(db: Session, restaurant_id: UUID, user: User) -> bool:
    if user.role == UserRole.admin:
        return True
    restaurant = get_restaurant(db, restaurant_id)
    return restaurant is not None and restaurant.owner_id == user.id


@router.post("/", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def checkout(
    order_in: OrderCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    try:
        order = create_order(db=db, order_in=order_in, user_id=current_user.id)
        return _order_to_out(order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/manage", response_model=list[OrderOut])
def list_managed_orders(
    order_status: str | None = Query(None, alias="status"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.owner, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only restaurant owners and admins can view order history",
        )

    status_filter = _parse_status(order_status)

    if current_user.role == UserRole.admin:
        orders = get_all_orders(db=db, status=status_filter)
    else:
        orders = get_orders_for_owner(
            db=db,
            owner_id=current_user.id,
            status=status_filter,
        )
    return _orders_to_out(orders)


@router.get("/user/{user_id}", response_model=list[OrderOut])
def get_user_orders(
    user_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.id != user_id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own orders",
        )
    orders = get_orders_by_user(db=db, user_id=user_id)
    return _orders_to_out(orders)


@router.get("/restaurant/{restaurant_id}", response_model=list[OrderOut])
def list_restaurant_orders(
    restaurant_id: UUID,
    order_status: str | None = Query(None, alias="status"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage_restaurant(db, restaurant_id, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this restaurant's orders",
        )

    status_filter = _parse_status(order_status)
    orders = get_orders_by_restaurant(
        db=db,
        restaurant_id=restaurant_id,
        status=status_filter,
    )
    return _orders_to_out(orders)


@router.get("/pending", response_model=list[OrderOut])
def list_pending_orders(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.admin:
        orders = get_pending_orders_all(db=db)
    elif current_user.role == UserRole.owner:
        orders = get_pending_orders_for_owner(db=db, owner_id=current_user.id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only restaurant owners and admins can view pending orders",
        )
    return _orders_to_out(orders)


@router.get("/sales-summary")
def get_owner_sales(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only restaurant owners can view sales summaries",
        )
    return get_owner_sales_summary(db=db, owner_id=current_user.id)


@router.get("/{order_id}", response_model=OrderOut)
def get_order_detail(
    order_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    order = get_order(db=db, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if (
        current_user.id != order.user_id
        and not _can_manage_order(db, order, current_user)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this order",
        )
    return _order_to_out(order)


@router.patch("/{order_id}/approve", response_model=OrderOut)
def approve_customer_order(
    order_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    order = get_order(db=db, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not _can_manage_order(db, order, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to approve this order",
        )

    try:
        updated = approve_order(db=db, order_id=order_id)
        return _order_to_out(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{order_id}/reject", response_model=OrderOut)
def reject_customer_order(
    order_id: UUID,
    status_in: OrderStatusUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    order = get_order(db=db, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not _can_manage_order(db, order, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to reject this order",
        )

    try:
        updated = reject_order(
            db=db,
            order_id=order_id,
            reason=status_in.rejection_reason
        )
        return _order_to_out(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    try:
        updated = cancel_order_by_customer(
            db=db,
            order_id=order_id,
            user_id=current_user.id,
        )
        return _order_to_out(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: UUID,
    status_in: OrderStatusUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    order = get_order(db=db, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not _can_manage_order(db, order, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this order",
        )

    try:
        new_status = OrderStatus(status_in.status)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {status_in.status}",
        )

    if new_status not in OWNER_ADVANCE_STATUS.values():
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of: {', '.join([s.value for s in OWNER_ADVANCE_STATUS.values()])}",
        )

    try:
        updated = advance_order_status(db=db, order_id=order_id, new_status=new_status)
        return _order_to_out(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
