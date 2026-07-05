"""Billable item pricing engine.

Billable items are booking-level charges (minibar, late checkout, spa, fees,
...) not part of the room rate. Like taxes, a line's amount is computed once
against the whole booking -- never per room -- since pricing types key off
booking-wide totals (nights, guest counts) or a user-entered quantity.

Per-item amount:
    fixed_amount:          unit_price * quantity   (quantity user-entered, default 1)
    per_night:              unit_price * nights
    per_guest:              unit_price * num_guests
    per_adult:               unit_price * num_adults
    per_child:               unit_price * num_children
    per_quantity:           unit_price * quantity   (quantity user-entered, default 1)
    percentage_of_booking:  unit_price% of the room subtotal (quantity fixed at 1)
"""
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, exists, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.property_portal import BillableItem, BillableItemAccommodation, BillableItemRatePlan
from app.services.pricing import money, ZERO

VALID_CATEGORIES = {
    "food_beverage", "transportation", "accommodation_services", "wellness",
    "housekeeping", "equipment_rental", "fees_penalties", "miscellaneous",
}

VALID_PRICING_TYPES = {
    "fixed_amount", "per_night", "per_guest", "per_adult", "per_child",
    "per_quantity", "percentage_of_booking",
}

# Pricing types where the guest/property chooses the quantity; all others
# derive their multiplier from the booking itself.
QUANTITY_INPUT_TYPES = {"fixed_amount", "per_quantity"}


@dataclass
class BillableItemLine:
    billable_item_id: Optional[uuid.UUID]
    name: str
    category: str
    pricing_type: str
    unit_price: Decimal
    quantity: int
    is_taxable: bool
    amount: Decimal


def compute_billable_item_line(
    item: BillableItem,
    quantity_input: Optional[int],
    nights: int,
    num_guests: int,
    num_adults: int,
    num_children: int,
    room_subtotal: Decimal,
) -> BillableItemLine:
    unit_price = Decimal(item.unit_price)

    if item.pricing_type == "percentage_of_booking":
        quantity = 1
        amount = room_subtotal * unit_price / Decimal("100")
    else:
        quantity = {
            "per_night": nights,
            "per_guest": num_guests,
            "per_adult": num_adults,
            "per_child": num_children,
        }.get(item.pricing_type, max(1, quantity_input or 1))  # fixed_amount / per_quantity
        amount = unit_price * quantity

    return BillableItemLine(
        billable_item_id=item.id,
        name=item.name,
        category=item.category,
        pricing_type=item.pricing_type,
        unit_price=unit_price,
        quantity=quantity,
        is_taxable=item.is_taxable,
        amount=money(amount if amount > ZERO else ZERO),
    )


async def load_eligible_items(
    db: AsyncSession,
    hotel_id: uuid.UUID,
    accommodation_ids: set[uuid.UUID],
    rate_plan_ids: set[uuid.UUID],
    require_stage: Optional[str] = None,
) -> list[BillableItem]:
    """Active items eligible for a booking using the given accommodations/rate
    plans. Eligible if the item applies to all accommodations/rate plans, or is
    explicitly linked to at least one of the ones in use (OR across a multi-room
    booking). ``require_stage`` optionally filters by an availability-stage column
    (e.g. 'booking' for the New Booking wizard); the Booking Detail page's
    post-confirmation add flow passes ``None`` to skip stage filtering.
    """
    where = [
        BillableItem.hotel_id == hotel_id,
        BillableItem.is_active.is_(True),
        BillableItem.deleted_at.is_(None),
    ]

    acc_match = BillableItem.applies_to_all_accommodations.is_(True)
    if accommodation_ids:
        acc_match = or_(acc_match, exists(
            select(BillableItemAccommodation.id).where(
                BillableItemAccommodation.billable_item_id == BillableItem.id,
                BillableItemAccommodation.accommodation_id.in_(accommodation_ids),
            )
        ))
    where.append(acc_match)

    rp_match = BillableItem.applies_to_all_rate_plans.is_(True)
    if rate_plan_ids:
        rp_match = or_(rp_match, exists(
            select(BillableItemRatePlan.id).where(
                BillableItemRatePlan.billable_item_id == BillableItem.id,
                BillableItemRatePlan.rate_plan_id.in_(rate_plan_ids),
            )
        ))
    where.append(rp_match)

    if require_stage == "booking":
        where.append(BillableItem.available_at_booking.is_(True))
    elif require_stage == "checkin":
        where.append(BillableItem.available_at_checkin.is_(True))
    elif require_stage == "stay":
        where.append(BillableItem.available_at_stay.is_(True))
    elif require_stage == "checkout":
        where.append(BillableItem.available_at_checkout.is_(True))

    return list((await db.execute(
        select(BillableItem)
        .options(selectinload(BillableItem.accommodation_links), selectinload(BillableItem.rate_plan_links))
        .where(*where)
        .order_by(BillableItem.display_order, BillableItem.name)
    )).scalars().all())


def taxable_total(lines: list[BillableItemLine]) -> Decimal:
    return money(sum((l.amount for l in lines if l.is_taxable), ZERO))


def grand_total_of(lines: list[BillableItemLine]) -> Decimal:
    return money(sum((l.amount for l in lines), ZERO))
