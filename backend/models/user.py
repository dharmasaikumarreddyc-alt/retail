from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str
    created_at: datetime
    agent_paused: bool = False
    notification_email: bool = True
    notification_push: bool = True
    notification_sms: bool = False

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    agent_paused: bool
    role: Literal["customer", "merchant"] = "customer"
    merchant_id: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None
