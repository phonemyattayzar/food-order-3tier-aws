from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.crud.crud_category import (
    create_category,
    get_categories_by_restaurant,
    get_category,
    update_category,
    delete_category,
)
from app.crud.crud_restaurant import get_restaurant

router = APIRouter(prefix="/categories", tags=["categories"])


@router.post(
    "/",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_new_category(
    category_in: CategoryCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Verify restaurant exists
    restaurant = get_restaurant(db=db, restaurant_id=category_in.restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )

    # Verify ownership
    if restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify this restaurant's menu",
        )

    return create_category(db=db, category_in=category_in)



@router.get(
    "/restaurant/{restaurant_id}",
    response_model=list[CategoryOut],
)
def list_categories_by_restaurant(
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
    return get_categories_by_restaurant(db=db, restaurant_id=restaurant_id)


@router.put("/{category_id}", response_model=CategoryOut)
def update_existing_category(
    category_id: UUID,
    category_in: CategoryUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_category = get_category(db, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")

    restaurant = get_restaurant(db, db_category.restaurant_id)
    if restaurant.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return update_category(
        db, db_category=db_category, category_in=category_in.model_dump(exclude_unset=True)
    )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_category(
    category_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_category = get_category(db, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")

    restaurant = get_restaurant(db, db_category.restaurant_id)
    if restaurant.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    delete_category(db, category_id=category_id)
    return None
