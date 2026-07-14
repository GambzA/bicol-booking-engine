"""add booking_charges ledger table

Revision ID: 0027
Revises: 0026
Create Date: 2026-07-06

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "booking_charges",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", sa.UUID(), nullable=False),
        sa.Column("booking_room_id", sa.UUID(), nullable=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("charge_date", sa.Date(), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=True),
        sa.Column("source_id", sa.UUID(), nullable=True),
        sa.Column("adjusts_charge_id", sa.UUID(), nullable=True),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["booking_room_id"], ["booking_rooms.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["adjusts_charge_id"], ["booking_charges.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_booking_charges_booking_id", "booking_charges", ["booking_id"])
    op.create_index("ix_booking_charges_category", "booking_charges", ["category"])


def downgrade() -> None:
    op.drop_index("ix_booking_charges_category", table_name="booking_charges")
    op.drop_index("ix_booking_charges_booking_id", table_name="booking_charges")
    op.drop_table("booking_charges")
