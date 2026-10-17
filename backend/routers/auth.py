"""Authentication routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

from database import get_db
from services.auth_service import AuthService
from database.models import MerchantAccountDB
from models.user import UserCreate, UserLogin, UserResponse, Token
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Get current user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = AuthService.decode_token(token)
    if user_id is None:
        raise credentials_exception

    user = await AuthService.get_user_by_id(db, user_id)
    if user is None:
        raise credentials_exception

    return user


@router.post("/signup", response_model=Token)
async def signup(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    user = await AuthService.create_user(
        db=db,
        email=user_data.email,
        name=user_data.name,
        password=user_data.password
    )

    access_token = AuthService.create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return Token(access_token=access_token)


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Login with email and password."""
    user = await AuthService.authenticate_user(
        db=db,
        email=form_data.username,
        password=form_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = AuthService.create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return Token(access_token=access_token)


@router.post("/login/json", response_model=Token)
async def login_json(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with JSON body (alternative to form)."""
    user = await AuthService.authenticate_user(
        db=db,
        email=credentials.email,
        password=credentials.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    access_token = AuthService.create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile."""
    account_result = await db.execute(
        select(MerchantAccountDB).where(MerchantAccountDB.user_id == current_user.id)
    )
    merchant_account = account_result.scalar_one_or_none()
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        agent_paused=current_user.agent_paused,
        role="merchant" if merchant_account else "customer",
        merchant_id=merchant_account.merchant_id if merchant_account else None,
    )


@router.put("/me")
async def update_me(
    updates: dict,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user profile."""
    if "name" in updates:
        current_user.name = updates["name"]
    if "email" in updates:
        current_user.email = updates["email"]
    if "agent_paused" in updates:
        current_user.agent_paused = updates["agent_paused"]
    if "notification_email" in updates:
        current_user.notification_email = updates["notification_email"]
    if "notification_push" in updates:
        current_user.notification_push = updates["notification_push"]
    if "notification_sms" in updates:
        current_user.notification_sms = updates["notification_sms"]

    await db.commit()
    await db.refresh(current_user)

    return {"status": "success", "message": "Profile updated"}
