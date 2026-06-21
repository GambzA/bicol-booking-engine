import enum
import uuid
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.subscription import PropertySubscription


class HotelStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class Hotel(TimestampMixin, Base):
    __tablename__ = "hotels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100), default="Philippines")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[HotelStatus] = mapped_column(SQLEnum(HotelStatus), default=HotelStatus.ACTIVE, nullable=False)

    users: Mapped[list["User"]] = relationship("User", back_populates="hotel")
    subscription: Mapped[Optional["PropertySubscription"]] = relationship(
        "PropertySubscription", back_populates="hotel", uselist=False
    )
