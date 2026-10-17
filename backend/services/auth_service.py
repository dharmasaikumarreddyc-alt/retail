"""Authentication service for user management and JWT tokens."""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from config import settings
from database.models import UserDB, SpendingRulesDB


class AuthService:
    """Service for authentication and user management."""

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Generate password hash."""
        return bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @staticmethod
    def decode_token(token: str) -> Optional[str]:
        """Decode JWT token and return user_id."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id: str = payload.get("sub")
            return user_id
        except JWTError:
            return None

    @staticmethod
    async def create_user(
        db: AsyncSession,
        email: str,
        name: str,
        password: str
    ) -> UserDB:
        """Create a new user."""
        # Check if user exists
        normalized_email = email.strip().lower()
        result = await db.execute(select(UserDB).where(UserDB.email == normalized_email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Create user
        hashed_password = AuthService.get_password_hash(password)
        user = UserDB(
            email=normalized_email,
            name=name,
            password_hash=hashed_password
        )
        db.add(user)
        await db.flush()

        # Create default spending rules
        default_rules = SpendingRulesDB(
            user_id=user.id,
            monthly_budget=25000.0,
            categories=[
                {"category": "Groceries", "enabled": True, "limit": 8000.0},
                {"category": "Health & Supplements", "enabled": True, "limit": 5000.0},
                {"category": "Electronics", "enabled": True, "limit": 10000.0},
                {"category": "Fashion", "enabled": False, "limit": 3000.0},
            ],
            guardrails={
                "require_approval_above": 2000.0,
                "block_international": False,
                "require_2fa_above": 5000.0,
                "auto_pause_on_suspicious": True
            },
            merchant_whitelist=[],
            merchant_blacklist=[]
        )
        db.add(default_rules)

        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def authenticate_user(
        db: AsyncSession,
        email: str,
        password: str
    ) -> Optional[UserDB]:
        """Authenticate user with email and password."""
        normalized_email = email.strip().lower()
        result = await db.execute(select(UserDB).where(UserDB.email == normalized_email))
        user = result.scalar_one_or_none()

        if not user:
            return None
        if not AuthService.verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[UserDB]:
        """Get user by ID."""
        result = await db.execute(select(UserDB).where(UserDB.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> Optional[UserDB]:
        """Get user by email."""
        result = await db.execute(select(UserDB).where(UserDB.email == email))
        return result.scalar_one_or_none()
