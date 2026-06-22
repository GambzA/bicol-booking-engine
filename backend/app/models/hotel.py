import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, Integer, Numeric, ForeignKey, Enum as SQLEnum, DateTime, func
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


class PropertyType(str, enum.Enum):
    HOTEL = "hotel"
    RESORT = "resort"
    APARTMENT = "apartment"
    HOSTEL = "hostel"
    VILLA = "villa"
    BED_AND_BREAKFAST = "bed_and_breakfast"
    GUEST_HOUSE = "guest_house"


class Hotel(TimestampMixin, Base):
    __tablename__ = "hotels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    property_type: Mapped[PropertyType] = mapped_column(
        SQLEnum(PropertyType, name="propertytype", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False, server_default="hotel",
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Contact
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mobile_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    telephone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # legacy

    # Location
    country: Mapped[str] = mapped_column(String(100), nullable=False, server_default="Philippines")
    province: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address_line_1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line_2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # legacy
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)

    # Settings
    default_currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="PHP")
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, server_default="Asia/Manila")
    language: Mapped[str] = mapped_column(String(10), nullable=False, server_default="en")

    # Media
    banner_image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[HotelStatus] = mapped_column(
        SQLEnum(HotelStatus, name="hotelstatus", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=HotelStatus.ACTIVE, nullable=False,
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="hotel")
    subscription: Mapped[Optional["PropertySubscription"]] = relationship(
        "PropertySubscription", back_populates="hotel", uselist=False
    )
    photos: Mapped[list["PropertyPhoto"]] = relationship(
        "PropertyPhoto", back_populates="hotel", order_by="PropertyPhoto.sort_order"
    )


class PropertyPhoto(Base):
    __tablename__ = "property_photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    caption: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hotel: Mapped["Hotel"] = relationship("Hotel", back_populates="photos")
