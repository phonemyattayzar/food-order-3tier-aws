from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.crud.crud_favorite_customization import delete_favorite, list_favorites, upsert_favorite
from app.db.session import get_session
from app.models.user import User
from app.schemas.favorite_customization import FavoriteCustomizationCreate, FavoriteCustomizationOut

router = APIRouter(prefix="/favorite-customizations", tags=["favorite-customizations"])


@router.get("/restaurant/{restaurant_id}", response_model=list[FavoriteCustomizationOut])
def get_my_favorites(
    restaurant_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return list_favorites(db, user_id=current_user.id, restaurant_id=restaurant_id)


@router.post("/", response_model=FavoriteCustomizationOut, status_code=status.HTTP_201_CREATED)
def save_favorite(
    payload: FavoriteCustomizationCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    try:
        return upsert_favorite(db, payload, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    favorite_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    deleted = delete_favorite(db, favorite_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite customization not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
