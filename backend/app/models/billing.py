import enum
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, Numeric, Enum as SQLEnum, Date, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.hotel import Hotel
    from app.models.platform_admin import PlatformAdmin


class InvoiceType(str, enum.Enum):
    SUBSCRIPTION = "subscription"
    COMMISSION = "commission"
    COMBINED = "combined"
    ONE_TIME = "one_time"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    VOID = "void"


class PeriodType(str, enum.Enum):
    MONTHLY = "monthly"
    ANNUAL = "annual"


class CommissionStatementStatus(str, enum.Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[InvoiceType] = mapped_column(SQLEnum(InvoiceType), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(SQLEnum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False)
    billing_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    billing_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    subscription_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("platform_admins.id"), nullable=False)
    commission_statement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("commission_statements.id", use_alter=True, name="fk_invoice_commission_statement"),
        nullable=True,
    )

    hotel: Mapped["Hotel"] = relationship("Hotel")
    creator: Mapped["PlatformAdmin"] = relationship("PlatformAdmin", foreign_keys=[created_by])
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="invoice")
    commission_statement: Mapped[Optional["CommissionStatement"]] = relationship(
        "CommissionStatement", foreign_keys=[commission_statement_id], back_populates="invoice"
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    proof_of_payment_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("platform_admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    hotel: Mapped["Hotel"] = relationship("Hotel")
    invoice: Mapped[Optional["Invoice"]] = relationship("Invoice", back_populates="payments")
    recorder: Mapped["PlatformAdmin"] = relationship("PlatformAdmin")


class CommissionStatement(Base):
    __tablename__ = "commission_statements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    period_type: Mapped[PeriodType] = mapped_column(SQLEnum(PeriodType), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    total_booking_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    eligible_booking_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    commission_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    total_commission_due: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[CommissionStatementStatus] = mapped_column(
        SQLEnum(CommissionStatementStatus), default=CommissionStatementStatus.DRAFT, nullable=False
    )
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("platform_admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    hotel: Mapped["Hotel"] = relationship("Hotel")
    invoice: Mapped[Optional["Invoice"]] = relationship(
        "Invoice", foreign_keys=[invoice_id], back_populates="commission_statement"
    )
    creator: Mapped["PlatformAdmin"] = relationship("PlatformAdmin")
    adjustments: Mapped[list["CommissionAdjustment"]] = relationship("CommissionAdjustment", back_populates="statement")


class CommissionAdjustment(Base):
    __tablename__ = "commission_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    statement_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("commission_statements.id", ondelete="CASCADE"), nullable=False)
    hotel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    approved_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("platform_admins.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    statement: Mapped["CommissionStatement"] = relationship("CommissionStatement", back_populates="adjustments")
    approver: Mapped["PlatformAdmin"] = relationship("PlatformAdmin")
