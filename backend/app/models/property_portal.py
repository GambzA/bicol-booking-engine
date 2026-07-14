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
    from app.models.user import User


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
    PENDING = "pending"
    PENDING_PAYMENT = "pending_payment"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    NO_SHOW = "no_show"


class BookingSource(str, enum.Enum):
    WALK_IN = "walk_in"
    PHONE = "phone"
    EMAIL = "email"
    WEBSITE = "website"
    FACEBOOK = "facebook"
    OTA = "ota"
    MANUAL = "manual"


class PaymentRecordStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


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
    base_occupancy: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    max_occupancy: Mapped[int] = mapped_column(Integer, nullable=False, server_default="2")
    base_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    weekend_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    num_units: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    max_adults: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_children: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    additional_adult_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    additional_adult_requires_extra_bed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    extra_bed_fee: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    check_in_time: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    check_out_time: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    amenities: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    images: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)

    hotel: Mapped["Hotel"] = relationship("Hotel")
    booking_rooms: Mapped[list["BookingRoom"]] = relationship("BookingRoom", back_populates="accommodation")
    child_policies: Mapped[list["AccommodationChildPolicy"]] = relationship(
        "AccommodationChildPolicy", back_populates="accommodation",
        cascade="all, delete-orphan", order_by="AccommodationChildPolicy.sort_order",
    )


class AccommodationChildPolicy(Base):
    __tablename__ = "accommodation_child_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    accommodation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    min_age: Mapped[int] = mapped_column(Integer, nullable=False)
    max_age: Mapped[int] = mapped_column(Integer, nullable=False)
    charge_type: Mapped[str] = mapped_column(String(50), nullable=False)
    charge_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    accommodation: Mapped["Accommodation"] = relationship("Accommodation", back_populates="child_policies")


class InventoryAdjustment(TimestampMixin, Base):
    """A signed, accommodation-level adjustment to sellable inventory over a
    date range (maintenance, renovation, event holds, overbooking buffers, ...).
    Availability is managed only at the accommodation level -- never per unit.
    Per-date sellable = num_units + sum(adjustment_value of rows covering that
    date). Hard-deletable operational config (not immutable financial history)."""
    __tablename__ = "inventory_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    accommodation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    adjustment_value: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(30), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    accommodation: Mapped["Accommodation"] = relationship("Accommodation")
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_user_id])


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


class Package(TimestampMixin, Base):
    __tablename__ = "packages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    pricing_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="per_stay")
    price_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    hotel: Mapped["Hotel"] = relationship("Hotel")
    accommodations: Mapped[list["PackageAccommodation"]] = relationship(
        "PackageAccommodation", back_populates="package", cascade="all, delete-orphan"
    )
    inclusions: Mapped[list["PackageInclusion"]] = relationship(
        "PackageInclusion", back_populates="package", cascade="all, delete-orphan"
    )


class PackageAccommodation(Base):
    __tablename__ = "package_accommodations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("packages.id", ondelete="CASCADE"), nullable=False
    )
    accommodation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    package: Mapped["Package"] = relationship("Package", back_populates="accommodations")
    accommodation: Mapped["Accommodation"] = relationship("Accommodation")

    __table_args__ = (
        UniqueConstraint("package_id", "accommodation_id", name="uq_package_accommodation"),
    )


class PackageInclusion(Base):
    __tablename__ = "package_inclusions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    package_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("packages.id", ondelete="CASCADE"), nullable=False
    )
    inclusion_type: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    package: Mapped["Package"] = relationship("Package", back_populates="inclusions")

    __table_args__ = (
        UniqueConstraint("package_id", "inclusion_type", name="uq_package_inclusion"),
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
    """Container for one or more rooms sharing a single stay window.

    Per-room accommodation, occupancy, offering, and pricing data live on
    ``BookingRoom``; this row holds the stay-level fields plus aggregates
    (``total_amount``, ``num_guests``) summed across its rooms.
    """
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    guest_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guests.id"), nullable=False)
    booking_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_out_date: Mapped[date] = mapped_column(Date, nullable=False)
    num_guests: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    billable_items_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    tax_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    status: Mapped[BookingStatus] = mapped_column(
        SQLEnum(BookingStatus, name="bookingstatus", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False, server_default="pending_payment",
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    booking_source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    payment_method_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("payment_methods.id", ondelete="SET NULL"), nullable=True
    )
    payment_method_name_snapshot: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    deposit_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")

    hotel: Mapped["Hotel"] = relationship("Hotel")
    guest: Mapped["Guest"] = relationship("Guest", back_populates="bookings")
    payment_method: Mapped[Optional["PaymentMethod"]] = relationship("PaymentMethod")
    rooms: Mapped[list["BookingRoom"]] = relationship(
        "BookingRoom", back_populates="booking",
        cascade="all, delete-orphan", order_by="BookingRoom.display_order",
    )
    payments: Mapped[list["PaymentRecord"]] = relationship("PaymentRecord", back_populates="booking")
    status_history: Mapped[list["BookingStatusHistory"]] = relationship(
        "BookingStatusHistory", back_populates="booking",
        cascade="all, delete-orphan", order_by="BookingStatusHistory.created_at",
    )
    taxes: Mapped[list["BookingTax"]] = relationship(
        "BookingTax", back_populates="booking",
        cascade="all, delete-orphan", order_by="BookingTax.display_order",
    )
    billable_items: Mapped[list["BookingBillableItem"]] = relationship(
        "BookingBillableItem", back_populates="booking",
        cascade="all, delete-orphan", order_by="BookingBillableItem.display_order",
    )
    charges: Mapped[list["BookingCharge"]] = relationship(
        "BookingCharge", back_populates="booking", foreign_keys="BookingCharge.booking_id",
        cascade="all, delete-orphan", order_by="BookingCharge.display_order",
    )


class BookingRoom(TimestampMixin, Base):
    """One room within a booking (= one unit). Holds occupancy, offering
    selection + snapshots, and the immutable pricing breakdown for that room."""
    __tablename__ = "booking_rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    accommodation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accommodations.id"), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    num_adults: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    num_children: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    num_guests: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")

    rate_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("rate_plans.id", ondelete="SET NULL"), nullable=True
    )
    rate_plan_name_snapshot: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    promotion_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("promotions.id", ondelete="SET NULL"), nullable=True
    )
    promotion_name_snapshot: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    discount_type_snapshot: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    discount_value_snapshot: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    package_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("packages.id", ondelete="SET NULL"), nullable=True
    )
    package_name_snapshot: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    package_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")

    # Pricing breakdown snapshot (room-level)
    base_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    additional_adult_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    children_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    taxes_fees_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")

    booking: Mapped["Booking"] = relationship("Booking", back_populates="rooms")
    accommodation: Mapped["Accommodation"] = relationship("Accommodation", back_populates="booking_rooms")
    guests: Mapped[list["BookingRoomGuest"]] = relationship(
        "BookingRoomGuest", back_populates="room",
        cascade="all, delete-orphan", order_by="BookingRoomGuest.display_order",
    )
    nightly_rates: Mapped[list["BookingNightlyRate"]] = relationship(
        "BookingNightlyRate", back_populates="room",
        cascade="all, delete-orphan", order_by="BookingNightlyRate.date",
    )


class BookingRoomGuest(Base):
    """A single occupant of a room. ``full_name`` blank => use the primary guest."""
    __tablename__ = "booking_room_guests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_room_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("booking_rooms.id", ondelete="CASCADE"), nullable=False
    )
    occupant_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'adult' | 'child'
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    room: Mapped["BookingRoom"] = relationship("BookingRoom", back_populates="guests")


class PaymentRecord(Base):
    """A financial event on a booking (deposit, payment, refund). Summarizes the
    outcome of one or more immutable ``PaymentTransaction`` rows."""
    __tablename__ = "payment_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    booking_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    payment_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # legacy free-text label
    payment_method_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("payment_methods.id", ondelete="SET NULL"), nullable=True
    )
    payment_method_name_snapshot: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[PaymentRecordStatus] = mapped_column(
        SQLEnum(PaymentRecordStatus, name="paymentrecordstatus", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False, server_default="pending",
    )
    recorded_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    refunded_payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("payment_records.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hotel: Mapped["Hotel"] = relationship("Hotel")
    booking: Mapped[Optional["Booking"]] = relationship("Booking", back_populates="payments")
    payment_method: Mapped[Optional["PaymentMethod"]] = relationship("PaymentMethod")
    recorded_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[recorded_by_user_id])
    refunded_payment: Mapped[Optional["PaymentRecord"]] = relationship(
        "PaymentRecord", remote_side=[id], foreign_keys=[refunded_payment_id], back_populates="refunds"
    )
    refunds: Mapped[list["PaymentRecord"]] = relationship(
        "PaymentRecord", back_populates="refunded_payment", foreign_keys=[refunded_payment_id],
    )
    transactions: Mapped[list["PaymentTransaction"]] = relationship(
        "PaymentTransaction", back_populates="record",
        cascade="all, delete-orphan", order_by="PaymentTransaction.created_at",
    )


class BookingNightlyRate(Base):
    __tablename__ = "booking_nightly_rates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_room_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("booking_rooms.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    room_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    additional_adult_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    children_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    night_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    room: Mapped["BookingRoom"] = relationship("BookingRoom", back_populates="nightly_rates")

    __table_args__ = (
        UniqueConstraint("booking_room_id", "date", name="uq_booking_room_nightly_rate"),
    )


class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    booking: Mapped["Booking"] = relationship("Booking", back_populates="status_history")


class Tax(TimestampMixin, Base):
    """A configurable tax applied to bookings (VAT, service charge, fees, ...).

    ``rate`` holds a percentage value (e.g. 12.00) when ``tax_type`` is
    'percentage', or a peso amount when 'fixed_amount'. ``calculation_method``
    is 'inclusive' (extracted from the selling price) or 'exclusive' (added on
    top). ``application_scope`` controls how many times a fixed amount applies.
    """
    __tablename__ = "taxes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tax_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'percentage' | 'fixed_amount'
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    calculation_method: Mapped[str] = mapped_column(String(20), nullable=False)  # 'inclusive' | 'exclusive'
    application_scope: Mapped[str] = mapped_column(String(20), nullable=False)  # per_booking|per_night|per_guest|per_adult|per_child
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    hotel: Mapped["Hotel"] = relationship("Hotel")


class BookingTax(Base):
    """Immutable per-booking snapshot of one applied tax. Written at create
    time so later edits to the ``taxes`` config never alter historical bookings.
    ``is_included`` mirrors an 'inclusive' method: the amount is shown but not
    added to the booking total."""
    __tablename__ = "booking_taxes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    tax_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("taxes.id", ondelete="SET NULL"), nullable=True
    )
    name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_type_snapshot: Mapped[str] = mapped_column(String(20), nullable=False)
    rate_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    calculation_method_snapshot: Mapped[str] = mapped_column(String(20), nullable=False)
    application_scope_snapshot: Mapped[str] = mapped_column(String(20), nullable=False)
    calculated_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    is_included: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    booking: Mapped["Booking"] = relationship("Booking", back_populates="taxes")


class PaymentMethod(TimestampMixin, Base):
    """A configured way for guests to pay (bank transfer, pay at property, and
    future gateways). Bookings reference a method; per-type config lives here and
    on child tables so adding a provider needs no booking-model change."""
    __tablename__ = "payment_methods"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    method_type: Mapped[str] = mapped_column(String(30), nullable=False)  # 'bank_transfer' | 'pay_at_property'
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Pay-at-property deposit config
    deposit_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    deposit_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # 'fixed' | 'percentage'
    deposit_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    hotel: Mapped["Hotel"] = relationship("Hotel")
    bank_accounts: Mapped[list["PaymentMethodBankAccount"]] = relationship(
        "PaymentMethodBankAccount", back_populates="payment_method",
        cascade="all, delete-orphan", order_by="PaymentMethodBankAccount.display_order",
    )


class PaymentMethodBankAccount(Base):
    """One bank account under a bank-transfer payment method."""
    __tablename__ = "payment_method_bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_method_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payment_methods.id", ondelete="CASCADE"), nullable=False
    )
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_number: Mapped[str] = mapped_column(String(100), nullable=False)
    branch: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    swift_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    iban: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    qr_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    payment_method: Mapped["PaymentMethod"] = relationship("PaymentMethod", back_populates="bank_accounts")


class PaymentTransaction(Base):
    """Immutable processing/audit event under a payment record. Never edited or
    deleted; new payment events append new rows. Gateway integrations write only
    here (opaque ``gateway_response`` kept as text)."""
    __tablename__ = "payment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_record_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payment_records.id", ondelete="CASCADE"), nullable=False
    )
    transaction_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    external_transaction_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gateway_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    record: Mapped["PaymentRecord"] = relationship("PaymentRecord", back_populates="transactions")


class BillableItem(TimestampMixin, Base):
    """A guest-selectable charge (minibar, late checkout, spa, fees, ...) not
    part of the room rate. Booking-level, not per-room: pricing types key off
    booking-wide totals (nights, guest counts) or a user-entered quantity."""
    __tablename__ = "billable_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    pricing_type: Mapped[str] = mapped_column(String(30), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    is_taxable: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    applies_to_all_accommodations: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    applies_to_all_rate_plans: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    available_at_booking: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    available_at_checkin: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    available_at_stay: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    available_at_checkout: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    hotel: Mapped["Hotel"] = relationship("Hotel")
    accommodation_links: Mapped[list["BillableItemAccommodation"]] = relationship(
        "BillableItemAccommodation", back_populates="billable_item", cascade="all, delete-orphan"
    )
    rate_plan_links: Mapped[list["BillableItemRatePlan"]] = relationship(
        "BillableItemRatePlan", back_populates="billable_item", cascade="all, delete-orphan"
    )


class BillableItemAccommodation(Base):
    __tablename__ = "billable_item_accommodations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    billable_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("billable_items.id", ondelete="CASCADE"), nullable=False
    )
    accommodation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    billable_item: Mapped["BillableItem"] = relationship("BillableItem", back_populates="accommodation_links")
    accommodation: Mapped["Accommodation"] = relationship("Accommodation")

    __table_args__ = (
        UniqueConstraint("billable_item_id", "accommodation_id", name="uq_billable_item_accommodation"),
    )


class BillableItemRatePlan(Base):
    __tablename__ = "billable_item_rate_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    billable_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("billable_items.id", ondelete="CASCADE"), nullable=False
    )
    rate_plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rate_plans.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    billable_item: Mapped["BillableItem"] = relationship("BillableItem", back_populates="rate_plan_links")
    rate_plan: Mapped["RatePlan"] = relationship("RatePlan")

    __table_args__ = (
        UniqueConstraint("billable_item_id", "rate_plan_id", name="uq_billable_item_rate_plan"),
    )


class BookingBillableItem(Base):
    """Immutable per-booking snapshot of one billable item line. Written at
    create time (or when added post-confirmation) so later edits to the
    ``billable_items`` config never alter historical bookings."""
    __tablename__ = "booking_billable_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    billable_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("billable_items.id", ondelete="SET NULL"), nullable=True
    )
    name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    category_snapshot: Mapped[str] = mapped_column(String(50), nullable=False)
    pricing_type_snapshot: Mapped[str] = mapped_column(String(30), nullable=False)
    unit_price_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    is_taxable_snapshot: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    calculated_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    booking: Mapped["Booking"] = relationship("Booking", back_populates="billable_items")


class BookingCharge(Base):
    """Immutable ledger entry for one dollar amount on a booking (the Folio).
    Auto-generated at booking creation from room/tax/billable-item lines, or
    added manually; adjustments and refunds are new negative-amount rows
    linked back to the original via ``adjusts_charge_id`` -- the original
    charge is never edited or deleted."""
    __tablename__ = "booking_charges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    booking_room_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("booking_rooms.id", ondelete="SET NULL"), nullable=True
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0.00")
    charge_date: Mapped[date] = mapped_column(Date, nullable=False)
    source_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    adjusts_charge_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("booking_charges.id", ondelete="SET NULL"), nullable=True
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    booking: Mapped["Booking"] = relationship("Booking", back_populates="charges", foreign_keys=[booking_id])
    booking_room: Mapped[Optional["BookingRoom"]] = relationship("BookingRoom")
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_user_id])
    adjusts_charge: Mapped[Optional["BookingCharge"]] = relationship(
        "BookingCharge", remote_side=[id], foreign_keys=[adjusts_charge_id], back_populates="adjustments"
    )
    adjustments: Mapped[list["BookingCharge"]] = relationship(
        "BookingCharge", back_populates="adjusts_charge", foreign_keys=[adjusts_charge_id],
    )
