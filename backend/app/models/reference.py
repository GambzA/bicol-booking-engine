import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Boolean, Numeric, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

_SCHEMA = "references"


class ReferenceCountry(Base):
    __tablename__ = "countries"
    __table_args__ = (
        UniqueConstraint("iso2_code", name="uq_ref_countries_iso2"),
        {"schema": _SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    iso2_code: Mapped[str] = mapped_column(String(2), nullable=False)
    iso3_code: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    numeric_code: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    country_name: Mapped[str] = mapped_column(String(255), nullable=False)
    official_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    phone_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    currency_code: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    currency_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    continent: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    states_provinces: Mapped[list["ReferenceStateProvince"]] = relationship(
        "ReferenceStateProvince", back_populates="country"
    )


class ReferenceStateProvince(Base):
    __tablename__ = "states_provinces"
    __table_args__ = (
        UniqueConstraint("country_id", "state_name", name="uq_ref_states_country_name"),
        {"schema": _SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("references.countries.id", ondelete="CASCADE"), nullable=False
    )
    state_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    state_name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    country: Mapped["ReferenceCountry"] = relationship("ReferenceCountry", back_populates="states_provinces")


class ReferenceCity(Base):
    __tablename__ = "cities"
    __table_args__ = {"schema": _SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("references.countries.id", ondelete="CASCADE"), nullable=False
    )
    state_province_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("references.states_provinces.id", ondelete="SET NULL"), nullable=True
    )
    city_name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code_pattern: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    country: Mapped["ReferenceCountry"] = relationship("ReferenceCountry")
    state_province: Mapped[Optional["ReferenceStateProvince"]] = relationship("ReferenceStateProvince")
