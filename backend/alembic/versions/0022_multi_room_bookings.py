"""multi-room bookings: booking_rooms, booking_room_guests; repoint nightly rates

Promotes bookings to a container. Per-room accommodation, occupancy, offering,
and pricing data move to booking_rooms; occupant names move to
booking_room_guests; booking_nightly_rates repoints from booking_id to
booking_room_id. Existing single-room bookings are migrated into one room each.

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. booking_rooms ─────────────────────────────────────────────────────
    op.create_table(
        "booking_rooms",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", sa.UUID(), nullable=False),
        sa.Column("accommodation_id", sa.UUID(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("num_adults", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("num_children", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("num_guests", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("rate_plan_id", sa.UUID(), nullable=True),
        sa.Column("rate_plan_name_snapshot", sa.String(255), nullable=True),
        sa.Column("promotion_id", sa.UUID(), nullable=True),
        sa.Column("promotion_name_snapshot", sa.String(255), nullable=True),
        sa.Column("discount_type_snapshot", sa.String(50), nullable=True),
        sa.Column("discount_value_snapshot", sa.Numeric(10, 2), nullable=True),
        sa.Column("package_id", sa.UUID(), nullable=True),
        sa.Column("package_name_snapshot", sa.String(255), nullable=True),
        sa.Column("package_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("base_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("additional_adult_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("children_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("taxes_fees_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("subtotal_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["accommodation_id"], ["accommodations.id"]),
        sa.ForeignKeyConstraint(["rate_plan_id"], ["rate_plans.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["promotion_id"], ["promotions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_booking_rooms_booking_id", "booking_rooms", ["booking_id"])
    op.create_index("ix_booking_rooms_accommodation_id", "booking_rooms", ["accommodation_id"])

    # ── 2. booking_room_guests ───────────────────────────────────────────────
    op.create_table(
        "booking_room_guests",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_room_id", sa.UUID(), nullable=False),
        sa.Column("occupant_type", sa.String(10), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["booking_room_id"], ["booking_rooms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_booking_room_guests_room_id", "booking_room_guests", ["booking_room_id"])

    # ── 3. Migrate existing bookings into one room each ───────────────────────
    op.execute(
        """
        INSERT INTO booking_rooms (
            id, booking_id, accommodation_id, display_order,
            num_adults, num_children, num_guests,
            rate_plan_id, rate_plan_name_snapshot,
            promotion_id, promotion_name_snapshot, discount_type_snapshot, discount_value_snapshot,
            package_id, package_name_snapshot, package_amount,
            base_amount, additional_adult_amount, children_amount,
            discount_amount, taxes_fees_amount, subtotal_amount, total_amount,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(), b.id, b.accommodation_id, 0,
            b.num_adults, b.num_children, b.num_guests,
            b.rate_plan_id, b.rate_plan_name_snapshot,
            b.promotion_id, b.promotion_name_snapshot, b.discount_type_snapshot, b.discount_value_snapshot,
            b.package_id, b.package_name_snapshot, b.package_amount,
            b.base_amount, b.additional_adult_amount, b.children_amount,
            b.discount_amount, b.taxes_fees_amount, b.subtotal_amount, b.total_amount,
            now(), now()
        FROM bookings b
        """
    )

    # Blank occupant rows for migrated rooms (names/ages unknown for legacy data).
    op.execute(
        """
        INSERT INTO booking_room_guests (id, booking_room_id, occupant_type, full_name, age, display_order)
        SELECT gen_random_uuid(), r.id, 'adult', NULL, NULL, gs.n - 1
        FROM booking_rooms r
        JOIN generate_series(1, GREATEST(r.num_adults, 0)) AS gs(n) ON TRUE
        """
    )
    op.execute(
        """
        INSERT INTO booking_room_guests (id, booking_room_id, occupant_type, full_name, age, display_order)
        SELECT gen_random_uuid(), r.id, 'child', NULL, NULL, r.num_adults + gs.n - 1
        FROM booking_rooms r
        JOIN generate_series(1, GREATEST(r.num_children, 0)) AS gs(n) ON TRUE
        """
    )

    # ── 4. Repoint booking_nightly_rates: booking_id -> booking_room_id ───────
    op.add_column("booking_nightly_rates", sa.Column("booking_room_id", sa.UUID(), nullable=True))
    op.execute(
        """
        UPDATE booking_nightly_rates n
        SET booking_room_id = r.id
        FROM booking_rooms r
        WHERE r.booking_id = n.booking_id
        """
    )
    op.drop_constraint("uq_booking_nightly_rate", "booking_nightly_rates", type_="unique")
    op.drop_index("ix_booking_nightly_rates_booking_id", table_name="booking_nightly_rates")
    op.drop_column("booking_nightly_rates", "booking_id")  # drops its FK automatically
    op.alter_column("booking_nightly_rates", "booking_room_id", nullable=False)
    op.create_foreign_key(
        "fk_booking_nightly_rates_room_id", "booking_nightly_rates", "booking_rooms",
        ["booking_room_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_booking_nightly_rates_room_id", "booking_nightly_rates", ["booking_room_id"])
    op.create_unique_constraint(
        "uq_booking_room_nightly_rate", "booking_nightly_rates", ["booking_room_id", "date"]
    )

    # ── 5. Drop per-room columns from bookings (FKs cascade automatically) ────
    for col in (
        "accommodation_id",
        "num_adults", "num_children",
        "rate_plan_id", "rate_plan_name_snapshot",
        "promotion_id", "promotion_name_snapshot", "discount_type_snapshot", "discount_value_snapshot",
        "package_id", "package_name_snapshot", "package_amount",
        "base_amount", "additional_adult_amount", "children_amount",
        "discount_amount", "taxes_fees_amount", "subtotal_amount",
    ):
        op.drop_column("bookings", col)


def downgrade() -> None:
    # Recreate per-room columns on bookings (nullable during backfill).
    op.add_column("bookings", sa.Column("accommodation_id", sa.UUID(), nullable=True))
    op.add_column("bookings", sa.Column("num_adults", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("bookings", sa.Column("num_children", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("bookings", sa.Column("rate_plan_id", sa.UUID(), nullable=True))
    op.add_column("bookings", sa.Column("rate_plan_name_snapshot", sa.String(255), nullable=True))
    op.add_column("bookings", sa.Column("promotion_id", sa.UUID(), nullable=True))
    op.add_column("bookings", sa.Column("promotion_name_snapshot", sa.String(255), nullable=True))
    op.add_column("bookings", sa.Column("discount_type_snapshot", sa.String(50), nullable=True))
    op.add_column("bookings", sa.Column("discount_value_snapshot", sa.Numeric(10, 2), nullable=True))
    op.add_column("bookings", sa.Column("package_id", sa.UUID(), nullable=True))
    op.add_column("bookings", sa.Column("package_name_snapshot", sa.String(255), nullable=True))
    op.add_column("bookings", sa.Column("package_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("base_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("additional_adult_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("children_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("taxes_fees_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("subtotal_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))

    # Backfill from the first room of each booking.
    op.execute(
        """
        UPDATE bookings b
        SET accommodation_id = r.accommodation_id,
            num_adults = r.num_adults,
            num_children = r.num_children,
            rate_plan_id = r.rate_plan_id,
            rate_plan_name_snapshot = r.rate_plan_name_snapshot,
            promotion_id = r.promotion_id,
            promotion_name_snapshot = r.promotion_name_snapshot,
            discount_type_snapshot = r.discount_type_snapshot,
            discount_value_snapshot = r.discount_value_snapshot,
            package_id = r.package_id,
            package_name_snapshot = r.package_name_snapshot,
            package_amount = r.package_amount,
            base_amount = r.base_amount,
            additional_adult_amount = r.additional_adult_amount,
            children_amount = r.children_amount,
            discount_amount = r.discount_amount,
            taxes_fees_amount = r.taxes_fees_amount,
            subtotal_amount = r.subtotal_amount
        FROM booking_rooms r
        WHERE r.booking_id = b.id AND r.display_order = 0
        """
    )
    op.create_foreign_key("fk_bookings_rate_plan_id", "bookings", "rate_plans", ["rate_plan_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_bookings_package_id", "bookings", "packages", ["package_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_bookings_accommodation_id", "bookings", "accommodations", ["accommodation_id"], ["id"])

    # Repoint nightly rates back to booking_id.
    op.add_column("booking_nightly_rates", sa.Column("booking_id", sa.UUID(), nullable=True))
    op.execute(
        """
        UPDATE booking_nightly_rates n
        SET booking_id = r.booking_id
        FROM booking_rooms r
        WHERE r.id = n.booking_room_id
        """
    )
    op.drop_constraint("uq_booking_room_nightly_rate", "booking_nightly_rates", type_="unique")
    op.drop_index("ix_booking_nightly_rates_room_id", table_name="booking_nightly_rates")
    op.drop_column("booking_nightly_rates", "booking_room_id")  # drops its FK automatically
    op.alter_column("booking_nightly_rates", "booking_id", nullable=False)
    op.create_foreign_key(
        "fk_booking_nightly_rates_booking_id", "booking_nightly_rates", "bookings",
        ["booking_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_booking_nightly_rates_booking_id", "booking_nightly_rates", ["booking_id"])
    op.create_unique_constraint("uq_booking_nightly_rate", "booking_nightly_rates", ["booking_id", "date"])

    op.drop_index("ix_booking_room_guests_room_id", table_name="booking_room_guests")
    op.drop_table("booking_room_guests")
    op.drop_index("ix_booking_rooms_accommodation_id", table_name="booking_rooms")
    op.drop_index("ix_booking_rooms_booking_id", table_name="booking_rooms")
    op.drop_table("booking_rooms")
