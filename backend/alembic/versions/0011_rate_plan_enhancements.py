"""add pricing_method, display_order, inclusions to rate plans

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rate_plans",
        sa.Column("pricing_method", sa.String(50), nullable=False, server_default="fixed_price"),
    )
    op.add_column(
        "rate_plans",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )

    op.alter_column("rate_plan_accommodations", "rate", new_column_name="pricing_value")

    op.create_table(
        "rate_plan_inclusions",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rate_plan_id", sa.UUID(), nullable=False),
        sa.Column("inclusion_type", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["rate_plan_id"], ["rate_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rate_plan_id", "inclusion_type", name="uq_rate_plan_inclusion"),
    )
    op.create_index(
        "ix_rate_plan_inclusions_plan_id", "rate_plan_inclusions", ["rate_plan_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_rate_plan_inclusions_plan_id", table_name="rate_plan_inclusions")
    op.drop_table("rate_plan_inclusions")
    op.alter_column("rate_plan_accommodations", "pricing_value", new_column_name="rate")
    op.drop_column("rate_plans", "display_order")
    op.drop_column("rate_plans", "pricing_method")
