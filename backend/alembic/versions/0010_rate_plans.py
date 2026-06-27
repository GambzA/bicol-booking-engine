"""add rate_plans and rate_plan_accommodations tables

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rate_plans",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hotel_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rate_plans_hotel_id", "rate_plans", ["hotel_id"])

    op.create_table(
        "rate_plan_accommodations",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rate_plan_id", sa.UUID(), nullable=False),
        sa.Column("accommodation_id", sa.UUID(), nullable=False),
        sa.Column("rate", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["rate_plan_id"], ["rate_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["accommodation_id"], ["accommodations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rate_plan_id", "accommodation_id", name="uq_rate_plan_accommodation"),
    )


def downgrade() -> None:
    op.drop_table("rate_plan_accommodations")
    op.drop_index("ix_rate_plans_hotel_id", table_name="rate_plans")
    op.drop_table("rate_plans")
