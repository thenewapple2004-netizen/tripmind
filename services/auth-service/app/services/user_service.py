from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.schemas import UserRegister


class UserRepository:
    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email.lower().strip()).first()

    def get_by_id(self, db: Session, user_id: UUID) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    def create(self, db: Session, user_in: UserRegister) -> User:
        user = User(
            email=user_in.email.lower().strip(),
            hashed_password=hash_password(user_in.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def authenticate(self, db: Session, email: str, password: str) -> Optional[User]:
        user = self.get_by_email(db, email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user


user_repository = UserRepository()
