"""booking management: snapshot columns, nightly rates, status history

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add 'pending' to the bookingstatus enum (additive) ────────────────
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'pending'")

    # ── 2. New columns on bookings ───────────────────────────────────────────
    op.add_column("bookings", sa.Column("booking_source", sa.String(50), nullable=True))
    op.add_column("bookings", sa.Column("num_adults", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("bookings", sa.Column("num_children", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("bookings", sa.Column("rate_plan_id", sa.UUID(), nullable=True))
    op.add_column("bookings", sa.Column("rate_plan_name_snapshot", sa.String(255), nullable=True))
    op.add_column("bookings", sa.Column("package_id", sa.UUID(), nullable=True))
    op.add_column("bookings", sa.Column("package_name_snapshot", sa.String(255), nullable=True))
    op.add_column("bookings", sa.Column("package_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))

    # Pricing breakdown snapshot (stay-level summary)
    op.add_column("bookings", sa.Column("base_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("additional_adult_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("children_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("taxes_fees_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("subtotal_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))

    op.create_foreign_key(
        "fk_bookings_rate_plan_id", "bookings", "rate_plans",
        ["rate_plan_id"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_bookings_package_id", "bookings", "packages",
        ["package_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("ix_bookings_hotel_status", "bookings", ["hotel_id", "status"])
    op.create_index("ix_bookings_hotel_check_in", "bookings", ["hotel_id", "check_in_date"])

    # ── 3. booking_nightly_rates (immutable nightly snapshot) ────────────────
    op.create_table(
        "booking_nightly_rates",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", sa.UUID(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("room_rate", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("additional_adult_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("children_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("night_total", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("booking_id", "date", name="uq_booking_nightly_rate"),
    )
    op.create_index("ix_booking_nightly_rates_booking_id", "booking_nightly_rates", ["booking_id"])

    # ── 4. booking_status_history (timeline) ─────────────────────────────────
    op.create_table(
        "booking_status_history",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", sa.UUID(), nullable=False),
        sa.Column("from_status", sa.String(50), nullable=True),
        sa.Column("to_status", sa.String(50), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by_user_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_booking_status_history_booking_id", "booking_status_history", ["booking_id"])


def downgrade() -> None:
    op.drop_index("ix_booking_status_history_booking_id", table_name="booking_status_history")
    op.drop_table("booking_status_history")
    op.drop_index("ix_booking_nightly_rates_booking_id", table_name="booking_nightly_rates")
    op.drop_table("booking_nightly_rates")

    op.drop_index("ix_bookings_hotel_check_in", table_name="bookings")
    op.drop_index("ix_bookings_hotel_status", table_name="bookings")
    op.drop_constraint("fk_bookings_package_id", "bookings", type_="foreignkey")
    op.drop_constraint("fk_bookings_rate_plan_id", "bookings", type_="foreignkey")
    for col in (
        "subtotal_amount", "taxes_fees_amount", "discount_amount", "children_amount",
        "additional_adult_amount", "base_amount", "package_amount", "package_name_snapshot",
        "package_id", "rate_plan_name_snapshot", "rate_plan_id", "num_children", "num_adults",
        "booking_source",
    ):
        op.drop_column("bookings", col)
    # Note: enum value 'pending' is left in place (Postgres cannot drop enum values).
