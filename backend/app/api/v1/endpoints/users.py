from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.user import UserCreate, UserOut
from app.crud.crud_user import create_user
from app.db.session import get_session


router = APIRouter(prefix="/users", tags=["users"])


# -----------------------------------
# User Registration Endpoint
# -----------------------------------
@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(
    user_in: UserCreate,
    db: Session = Depends(get_session),
):
    try:
        user = create_user(db, user_in)
        return user

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_session)):
    from app.models.user import User
    return db.query(User).all()