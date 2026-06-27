import enum
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Any, Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, Integer, Numeric, ForeignKey, Enum as SQLEnum, Date, DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.hotel import Hotel
    from app.models.reference import ReferenceCountry


class Promotion(TimestampMixin, Base):
    __tablename__ = "promotions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    discount_type: Mapped[str] = mapped_column(String(50), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    stay_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    stay_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    booking_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    booking_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    promo_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    hotel: Mapped["Hotel"] = relationship("Hotel")
    accommodation_links: Mapped[list["PromotionAccommodation"]] = relationship(
        "PromotionAccommodation", back_populates="promotion", cascade="all, delete-orphan"
    )
    rate_plan_links: Mapped[list["PromotionRatePlan"]] = relationship(
        "PromotionRatePlan", back_populates="promotion", cascade="all, delete-orphan"
    )


class PromotionAccommodation(Base):
    __tablename__ = "promotion_accommodations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promotion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("promotions.id", ondelete="CASCADE"), nullable=False
    )
    accommodation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    promotion: Mapped["Promotion"] = relationship("Promotion", back_populates="accommodation_links")
    accommodation: Mapped["Accommodation"] = relationship("Accommodation")

    __table_args__ = (
        UniqueConstraint("promotion_id", "accommodation_id", name="uq_promotion_accommodation"),
    )


class PromotionRatePlan(Base):
    __tablename__ = "promotion_rate_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promotion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("promotions.id", ondelete="CASCADE"), nullable=False
    )
    rate_plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rate_plans.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    promotion: Mapped["Promotion"] = relationship("Promotion", back_populates="rate_plan_links")
    rate_plan: Mapped["RatePlan"] = relationship("RatePlan")

    __table_args__ = (
        UniqueConstraint("promotion_id", "rate_plan_id", name="uq_promotion_rate_plan"),
    )


class AccommodationType(str, enum.Enum):
    ROOM = "room"
    SUITE = "suite"
    VILLA = "villa"
    DORMITORY = "dormitory"
    CABIN = "cabin"
    APARTMENT = "apartment"
    COTTAGE = "cottage"
    TENT = "tent"


class BookingStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    NO_SHOW = "no_show"


class GuestPaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class Accommodation(TimestampMixin, Base):
    __tablename__ = "accommodations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    accommodation_type: Mapped[AccommodationType] = mapped_column(
        SQLEnum(AccommodationType, name="accommodationtype", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False, server_default="room",
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    max_occupancy: Mapped[int] = mapped_column(Integer, nullable=False, server_default="2")
    base_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    weekend_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    num_units: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    max_adults: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_children: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    check_in_time: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    check_out_time: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    unit_prefix: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    amenities: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    images: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)

    hotel: Mapped["Hotel"] = relationship("Hotel")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="accommodation")


class AccommodationUnitAvailability(Base):
    __tablename__ = "accommodation_unit_availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    accommodation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    unit_number: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("accommodation_id", "unit_number", "date", name="uq_unit_availability"),
    )


class AccommodationRateOverride(Base):
    __tablename__ = "accommodation_rate_overrides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    accommodation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("accommodation_id", "date", name="uq_rate_override"),
    )


class RatePlan(TimestampMixin, Base):
    __tablename__ = "rate_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    pricing_method: Mapped[str] = mapped_column(String(50), nullable=False, server_default="fixed_price")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    hotel: Mapped["Hotel"] = relationship("Hotel")
    accommodations: Mapped[list["RatePlanAccommodation"]] = relationship(
        "RatePlanAccommodation", back_populates="rate_plan", cascade="all, delete-orphan"
    )
    inclusions: Mapped[list["RatePlanInclusion"]] = relationship(
        "RatePlanInclusion", back_populates="rate_plan", cascade="all, delete-orphan"
    )


class RatePlanAccommodation(Base):
    __tablename__ = "rate_plan_accommodations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rate_plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rate_plans.id", ondelete="CASCADE"), nullable=False
    )
    accommodation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    pricing_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    rate_plan: Mapped["RatePlan"] = relationship("RatePlan", back_populates="accommodations")
    accommodation: Mapped["Accommodation"] = relationship("Accommodation")

    __table_args__ = (
        UniqueConstraint("rate_plan_id", "accommodation_id", name="uq_rate_plan_accommodation"),
    )


class RatePlanInclusion(Base):
    __tablename__ = "rate_plan_inclusions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rate_plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rate_plans.id", ondelete="CASCADE"), nullable=False
    )
    inclusion_type: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    rate_plan: Mapped["RatePlan"] = relationship("RatePlan", back_populates="inclusions")

    __table_args__ = (
        UniqueConstraint("rate_plan_id", "inclusion_type", name="uq_rate_plan_inclusion"),
    )


class Guest(TimestampMixin, Base):
    __tablename__ = "guests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    first_name: Mapped[str] = mapped_column(String(150), nullable=False)
    last_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mobile_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address_line_1: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    address_line_2: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    state_province: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("references.countries.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    hotel: Mapped["Hotel"] = relationship("Hotel")
    country: Mapped[Optional["ReferenceCountry"]] = relationship("ReferenceCountry")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="guest")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Booking(TimestampMixin, Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    accommodation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accommodations.id"), nullable=False)
    guest_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guests.id"), nullable=False)
    booking_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_out_date: Mapped[date] = mapped_column(Date, nullable=False)
    num_guests: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    status: Mapped[BookingStatus] = mapped_column(
        SQLEnum(BookingStatus, name="bookingstatus", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False, server_default="pending_payment",
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    promotion_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("promotions.id", ondelete="SET NULL"), nullable=True
    )
    promotion_name_snapshot: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    discount_type_snapshot: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    discount_value_snapshot: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    hotel: Mapped["Hotel"] = relationship("Hotel")
    accommodation: Mapped["Accommodation"] = relationship("Accommodation", back_populates="bookings")
    guest: Mapped["Guest"] = relationship("Guest", back_populates="bookings")
    payments: Mapped[list["GuestPayment"]] = relationship("GuestPayment", back_populates="booking")


class GuestPayment(Base):
    __tablename__ = "guest_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    booking_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[GuestPaymentStatus] = mapped_column(
        SQLEnum(GuestPaymentStatus, name="guestpaymentstatus", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False, server_default="pending",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hotel: Mapped["Hotel"] = relationship("Hotel")
    booking: Mapped[Optional["Booking"]] = relationship("Booking", back_populates="payments")
