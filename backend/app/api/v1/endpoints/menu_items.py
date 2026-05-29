import os
import shutil
import uuid
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Request
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.menu_item import MenuItemCreate, MenuItemOut, MenuItemUpdate
from app.schemas.category import CategoryWithMenuItems
from app.crud.crud_menu_item import (
    create_menu_item,
    get_menu_items_by_restaurant,
    get_menu_items_by_category,
    get_menu_item,
    update_menu_item,
    delete_menu_item,
)
from app.crud.crud_restaurant import get_restaurant
from app.crud.crud_category import get_categories_by_restaurant
from app.models.category import Category

router = APIRouter(prefix="/menu-items", tags=["menu-items"])

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_menu_item_image(request: Request, file: UploadFile = File(...)):
    # 1. Validate file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only image files (.jpg, .jpeg, .png, .webp, .gif) are allowed.",
        )
    
    # 2. Generate a unique filename
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # 3. Save file to disk
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 4. Return the accessible URL
    image_url = f"{request.base_url}static/uploads/{filename}"
    return {"image_url": image_url}



@router.post(
    "/",
    response_model=MenuItemOut,
    status_code=status.HTTP_201_CREATED,
)
def create_new_menu_item(
    menu_item_in: MenuItemCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # 1. Verify restaurant exists
    restaurant = get_restaurant(db=db, restaurant_id=menu_item_in.restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )

    # 2. Verify ownership
    if restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify this restaurant's menu",
        )

    # 3. If category_id is provided, verify it exists and belongs to the restaurant
    if menu_item_in.category_id:
        category = (
            db.query(Category)
            .filter(Category.id == menu_item_in.category_id)
            .first()
        )
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found",
            )
        if category.restaurant_id != menu_item_in.restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category does not belong to the specified restaurant",
            )

    return create_menu_item(db=db, menu_item_in=menu_item_in)


@router.get(
    "/restaurant/{restaurant_id}",
    response_model=list[MenuItemOut],
)
def list_menu_items_by_restaurant(
    restaurant_id: UUID,
    db: Session = Depends(get_session),
):
    # Verify restaurant exists
    restaurant = get_restaurant(db=db, restaurant_id=restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )
    return get_menu_items_by_restaurant(db=db, restaurant_id=restaurant_id)


@router.get(
    "/category/{category_id}",
    response_model=list[MenuItemOut],
)
def list_menu_items_by_category(
    category_id: UUID,
    db: Session = Depends(get_session),
):
    # Verify category exists
    category = (
        db.query(Category)
        .filter(Category.id == category_id)
        .first()
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return get_menu_items_by_category(db=db, category_id=category_id)


@router.get(
    "/restaurant/{restaurant_id}/menu",
    response_model=list[CategoryWithMenuItems],
)
def get_restaurant_menu(
    restaurant_id: UUID,
    db: Session = Depends(get_session),
):
    # Verify restaurant exists
    restaurant = get_restaurant(db=db, restaurant_id=restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )

    # Fetch all categories for this restaurant
    categories = get_categories_by_restaurant(db=db, restaurant_id=restaurant_id)
    return categories


@router.put("/{menu_item_id}", response_model=MenuItemOut)
def update_existing_menu_item(
    menu_item_id: UUID,
    menu_item_in: MenuItemUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_menu_item = get_menu_item(db, menu_item_id)
    if not db_menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    restaurant = get_restaurant(db, db_menu_item.restaurant_id)
    if restaurant.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return update_menu_item(
        db, db_menu_item=db_menu_item, menu_item_in=menu_item_in.model_dump(exclude_unset=True)
    )


@router.delete("/{menu_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_menu_item(
    menu_item_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_menu_item = get_menu_item(db, menu_item_id)
    if not db_menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    restaurant = get_restaurant(db, db_menu_item.restaurant_id)
    if restaurant.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    delete_menu_item(db, menu_item_id=menu_item_id)
    return None
