"""Booking Charges ledger (the Folio).

Every dollar amount on a booking -- room components, taxes, billable items,
manual fees, adjustments, refunds -- is one immutable ``BookingCharge`` row.
Adjustments/refunds are brand-new negative-amount rows linked back to the
charge they reduce via ``adjusts_charge_id``; the original row is never
edited. ``booking.total_amount`` is always the sum of these rows.

This ledger is additive to (not a replacement of) ``BookingRoom``/``BookingTax``/
``BookingBillableItem``, which keep powering their own detail displays --
the rows generated here are built from the same already-computed amounts.
"""
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property_portal import BookingCharge, BookingRoom, BookingTax, BookingBillableItem
from app.services.pricing import money, ZERO

VALID_CATEGORIES = {
    "accommodation", "rate_plan", "package", "billable_item", "extra_adult",
    "child_charge", "tax", "promotion", "discount", "adjustment", "refund",
    "damage_fee", "miscellaneous",
}

# What the manual "add charge" endpoint accepts. Spec examples (Lost Key,
# Cleaning Fee, Other operational fee) are free-text `description` values
# under one of these two buckets, not separate category slugs.
MANUAL_CATEGORIES = {"damage_fee", "miscellaneous"}

ADJUST_CATEGORIES = {"adjustment", "refund"}


def room_charge_rows(room: BookingRoom, accommodation_name: str) -> list[dict]:
    common = {"booking_room_id": room.id, "source_type": "booking_room", "source_id": room.id}
    rows = [{
        **common, "category": "accommodation", "description": accommodation_name,
        "quantity": 1, "unit_price": room.base_amount, "amount": room.base_amount,
    }]
    if room.additional_adult_amount != ZERO:
        rows.append({
            **common, "category": "extra_adult", "description": "Extra Adult Charge",
            "quantity": 1, "unit_price": room.additional_adult_amount, "amount": room.additional_adult_amount,
        })
    if room.children_amount != ZERO:
        rows.append({
            **common, "category": "child_charge", "description": "Child Charge",
            "quantity": 1, "unit_price": room.children_amount, "amount": room.children_amount,
        })
    if room.package_amount != ZERO:
        rows.append({
            **common, "category": "package", "description": room.package_name_snapshot or "Package",
            "quantity": 1, "unit_price": room.package_amount, "amount": room.package_amount,
        })
    if room.discount_amount != ZERO:
        desc = f"Promotion: {room.promotion_name_snapshot}" if room.promotion_name_snapshot else "Discount"
        rows.append({
            **common, "category": "discount", "description": desc,
            "quantity": 1, "unit_price": money(-room.discount_amount), "amount": money(-room.discount_amount),
        })
    return rows


def tax_charge_row(tax: BookingTax) -> dict:
    # Inclusive taxes are already baked into the room subtotal (shown, never
    # added) -- the ledger records the computed value but contributes 0 to
    # the total, mirroring `added_tax_total()` in `services/taxes.py`.
    amount = ZERO if tax.is_included else tax.calculated_amount
    return {
        "category": "tax", "description": tax.name_snapshot,
        "quantity": 1, "unit_price": tax.calculated_amount, "amount": amount,
        "source_type": "tax", "source_id": tax.id,
    }


def billable_item_charge_row(item: BookingBillableItem) -> dict:
    return {
        "category": "billable_item", "description": item.name_snapshot,
        "quantity": item.quantity, "unit_price": item.unit_price_snapshot, "amount": item.calculated_amount,
        "source_type": "billable_item", "source_id": item.id,
    }


def charges_total(charges: list[BookingCharge]) -> Decimal:
    return money(sum((Decimal(c.amount) for c in charges), Decimal("0")))


async def adjust_charge(
    db: AsyncSession,
    user_id: uuid.UUID,
    original: BookingCharge,
    amount: Optional[Decimal],
    category: str,
    description: Optional[str],
    notes: Optional[str],
    display_order: int = 0,
) -> BookingCharge:
    if category not in ADJUST_CATEGORIES:
        raise HTTPException(status_code=422, detail="Category must be 'adjustment' or 'refund'.")
    if Decimal(original.amount) <= ZERO:
        raise HTTPException(status_code=422, detail="Only a positive charge can be adjusted or refunded.")

    already_reduced_raw = (await db.execute(
        select(func.coalesce(func.sum(BookingCharge.amount), 0)).where(
            BookingCharge.adjusts_charge_id == original.id,
        )
    )).scalar() or 0
    already_reduced = money(-Decimal(str(already_reduced_raw)))
    remaining = money(Decimal(original.amount) - already_reduced)
    if remaining <= ZERO:
        raise HTTPException(status_code=422, detail="This charge has already been fully adjusted or refunded.")

    reduce_by = money(amount) if amount is not None else remaining
    if reduce_by <= ZERO:
        raise HTTPException(status_code=422, detail="Adjustment amount must be greater than zero.")
    if reduce_by > remaining:
        raise HTTPException(status_code=422, detail="Adjustment amount cannot exceed the remaining charge amount.")

    label = "Refund" if category == "refund" else "Adjustment"
    charge = BookingCharge(
        booking_id=original.booking_id,
        booking_room_id=original.booking_room_id,
        category=category,
        description=description or f"{label}: {original.description}",
        quantity=1,
        unit_price=money(-reduce_by),
        amount=money(-reduce_by),
        charge_date=date.today(),
        source_type="booking_charge",
        source_id=original.id,
        adjusts_charge_id=original.id,
        created_by_user_id=user_id,
        notes=notes,
        display_order=display_order,
    )
    db.add(charge)
    await db.flush()
    return charge
