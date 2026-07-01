"""add taxes + booking_taxes tables; booking subtotal/tax aggregate columns

Revision ID: 0023
Revises: 0022
Create Date: 2026-07-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "taxes",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hotel_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tax_type", sa.String(20), nullable=False),
        sa.Column("rate", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("calculation_method", sa.String(20), nullable=False),
        sa.Column("application_scope", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_taxes_hotel_id", "taxes", ["hotel_id"])

    op.create_table(
        "booking_taxes",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", sa.UUID(), nullable=False),
        sa.Column("tax_id", sa.UUID(), nullable=True),
        sa.Column("name_snapshot", sa.String(255), nullable=False),
        sa.Column("tax_type_snapshot", sa.String(20), nullable=False),
        sa.Column("rate_snapshot", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("calculation_method_snapshot", sa.String(20), nullable=False),
        sa.Column("application_scope_snapshot", sa.String(20), nullable=False),
        sa.Column("calculated_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("is_included", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tax_id"], ["taxes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_booking_taxes_booking_id", "booking_taxes", ["booking_id"])

    # Booking aggregates: net pre-tax subtotal + added-tax total. Grand total
    # (bookings.total_amount) becomes tax-inclusive going forward.
    op.add_column("bookings", sa.Column("subtotal_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"))
    op.add_column("bookings", sa.Column("tax_total", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"))
    # Existing bookings carried no tax, so their subtotal equals the stored total.
    op.execute("UPDATE bookings SET subtotal_amount = total_amount")


def downgrade() -> None:
    op.drop_column("bookings", "tax_total")
    op.drop_column("bookings", "subtotal_amount")
    op.drop_index("ix_booking_taxes_booking_id", table_name="booking_taxes")
    op.drop_table("booking_taxes")
    op.drop_index("ix_taxes_hotel_id", table_name="taxes")
    op.drop_table("taxes")
