from fastapi import APIRouter
from app.api.v1.endpoints import (
    users,
    restaurants,
    categories,
    menu_items,
    auth,
    orders,
    notifications,
    admin,
    reviews,
    coupons,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(restaurants.router)
api_router.include_router(categories.router)
api_router.include_router(menu_items.router)
api_router.include_router(orders.router)
api_router.include_router(notifications.router)
api_router.include_router(reviews.router)
api_router.include_router(coupons.router)
