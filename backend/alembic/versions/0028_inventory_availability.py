"""inventory adjustments (accommodation-level, date-based); drop per-unit availability + unit_prefix

Revision ID: 0028
Revises: 0027
Create Date: 2026-07-06

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inventory_adjustments",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hotel_id", sa.UUID(), nullable=False),
        sa.Column("accommodation_id", sa.UUID(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("adjustment_value", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["accommodation_id"], ["accommodations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_inventory_adjustments_acc_dates", "inventory_adjustments",
        ["accommodation_id", "start_date", "end_date"],
    )

    op.drop_table("accommodation_unit_availability")
    op.drop_column("accommodations", "unit_prefix")


def downgrade() -> None:
    op.add_column("accommodations", sa.Column("unit_prefix", sa.Integer(), nullable=True))
    op.create_table(
        "accommodation_unit_availability",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("accommodation_id", sa.UUID(), nullable=False),
        sa.Column("unit_number", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["accommodation_id"], ["accommodations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("accommodation_id", "unit_number", "date", name="uq_unit_availability"),
    )

    op.drop_index("ix_inventory_adjustments_acc_dates", table_name="inventory_adjustments")
    op.drop_table("inventory_adjustments")
