"""add billable_items + accommodation/rate-plan links + booking snapshot table

Revision ID: 0025
Revises: 0024
Create Date: 2026-07-06

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "billable_items",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hotel_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("pricing_type", sa.String(30), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("is_taxable", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("applies_to_all_accommodations", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("applies_to_all_rate_plans", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("available_at_booking", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("available_at_checkin", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("available_at_stay", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("available_at_checkout", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_billable_items_hotel_id", "billable_items", ["hotel_id"])

    op.create_table(
        "billable_item_accommodations",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("billable_item_id", sa.UUID(), nullable=False),
        sa.Column("accommodation_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["billable_item_id"], ["billable_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["accommodation_id"], ["accommodations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("billable_item_id", "accommodation_id", name="uq_billable_item_accommodation"),
    )

    op.create_table(
        "billable_item_rate_plans",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("billable_item_id", sa.UUID(), nullable=False),
        sa.Column("rate_plan_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["billable_item_id"], ["billable_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rate_plan_id"], ["rate_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("billable_item_id", "rate_plan_id", name="uq_billable_item_rate_plan"),
    )

    op.create_table(
        "booking_billable_items",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", sa.UUID(), nullable=False),
        sa.Column("billable_item_id", sa.UUID(), nullable=True),
        sa.Column("name_snapshot", sa.String(255), nullable=False),
        sa.Column("category_snapshot", sa.String(50), nullable=False),
        sa.Column("pricing_type_snapshot", sa.String(30), nullable=False),
        sa.Column("unit_price_snapshot", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_taxable_snapshot", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("calculated_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["billable_item_id"], ["billable_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_booking_billable_items_booking_id", "booking_billable_items", ["booking_id"])

    # Booking aggregate: sum of all billable item line amounts (taxable + non-taxable).
    op.add_column("bookings", sa.Column("billable_items_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"))


def downgrade() -> None:
    op.drop_column("bookings", "billable_items_amount")

    op.drop_index("ix_booking_billable_items_booking_id", table_name="booking_billable_items")
    op.drop_table("booking_billable_items")

    op.drop_table("billable_item_rate_plans")
    op.drop_table("billable_item_accommodations")

    op.drop_index("ix_billable_items_hotel_id", table_name="billable_items")
    op.drop_table("billable_items")
