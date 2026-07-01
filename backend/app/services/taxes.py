"""Booking tax engine.

Taxes are a reservation-level concern: they are computed once over the whole
booking after every room has been priced and summed (the per-room pricing lives
in ``services/pricing.py``). Each active tax is evaluated independently against
the same base -- the net booking subtotal ``S`` (sum of room totals, i.e. after
promotion discounts and including packages). There is no tax-on-tax.

Per-tax amount:
    percentage, exclusive (added):    S * rate/100
    percentage, inclusive (in price): S - S / (1 + rate/100)   (extracted, not added)
    fixed, exclusive:                 rate * scope_count
    fixed, inclusive:                 rate * scope_count        (shown, not added)

scope_count = {per_booking:1, per_night:nights, per_guest:num_guests,
               per_adult:num_adults, per_child:num_children}
"""
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property_portal import Tax
from app.services.pricing import money, ZERO

MAX_TAX_PERCENTAGE = Decimal("100")

VALID_TAX_TYPES = {"percentage", "fixed_amount"}
VALID_CALC_METHODS = {"inclusive", "exclusive"}
VALID_SCOPES = {"per_booking", "per_night", "per_guest", "per_adult", "per_child"}


@dataclass
class TaxLine:
    tax_id: Optional[uuid.UUID]
    name: str
    tax_type: str
    rate: Decimal
    calculation_method: str
    application_scope: str
    amount: Decimal
    is_included: bool


def scope_count(scope: str, nights: int, num_guests: int, num_adults: int, num_children: int) -> int:
    return {
        "per_booking": 1,
        "per_night": nights,
        "per_guest": num_guests,
        "per_adult": num_adults,
        "per_child": num_children,
    }.get(scope, 1)


def compute_tax_line(
    tax: Tax,
    subtotal: Decimal,
    nights: int,
    num_guests: int,
    num_adults: int,
    num_children: int,
) -> TaxLine:
    rate = Decimal(tax.rate)
    is_included = tax.calculation_method == "inclusive"

    if tax.tax_type == "percentage":
        if is_included:
            # Extract the tax already baked into the selling price.
            amount = subtotal - (subtotal / (Decimal("1") + rate / Decimal("100")))
        else:
            amount = subtotal * rate / Decimal("100")
    else:  # fixed_amount
        amount = rate * scope_count(tax.application_scope, nights, num_guests, num_adults, num_children)

    return TaxLine(
        tax_id=tax.id,
        name=tax.name,
        tax_type=tax.tax_type,
        rate=rate,
        calculation_method=tax.calculation_method,
        application_scope=tax.application_scope,
        amount=money(amount if amount > ZERO else ZERO),
        is_included=is_included,
    )


async def load_active_taxes(db: AsyncSession, hotel_id: uuid.UUID) -> list[Tax]:
    return list((await db.execute(
        select(Tax).where(
            Tax.hotel_id == hotel_id,
            Tax.is_active.is_(True),
            Tax.deleted_at.is_(None),
        ).order_by(Tax.display_order, Tax.name)
    )).scalars().all())


def compute_taxes(
    taxes: list[Tax],
    subtotal: Decimal,
    nights: int,
    num_guests: int,
    num_adults: int,
    num_children: int,
) -> list[TaxLine]:
    return [
        compute_tax_line(t, subtotal, nights, num_guests, num_adults, num_children)
        for t in taxes
    ]


def added_tax_total(lines: list[TaxLine]) -> Decimal:
    """Sum of taxes added on top of the subtotal (inclusive taxes are already
    part of the price and excluded here)."""
    return money(sum((l.amount for l in lines if not l.is_included), ZERO))
