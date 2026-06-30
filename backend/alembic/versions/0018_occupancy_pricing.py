"""add occupancy pricing columns and child policies table

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. New columns on accommodations ─────────────────────────────────────
    op.add_column("accommodations", sa.Column(
        "base_occupancy", sa.Integer(), nullable=False, server_default="1"
    ))
    op.add_column("accommodations", sa.Column(
        "additional_adult_fee", sa.Numeric(10, 2), nullable=False, server_default="0.00"
    ))
    op.add_column("accommodations", sa.Column(
        "additional_adult_requires_extra_bed", sa.Boolean(), nullable=False, server_default="false"
    ))
    op.add_column("accommodations", sa.Column(
        "extra_bed_fee", sa.Numeric(10, 2), nullable=True
    ))

    # ── 2. accommodation_child_policies table ─────────────────────────────────
    op.create_table(
        "accommodation_child_policies",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("accommodation_id", sa.UUID(), nullable=False),
        sa.Column("min_age", sa.Integer(), nullable=False),
        sa.Column("max_age", sa.Integer(), nullable=False),
        sa.Column("charge_type", sa.String(50), nullable=False),
        sa.Column("charge_value", sa.Numeric(10, 2), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["accommodation_id"], ["accommodations.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_child_policies_accommodation_id",
        "accommodation_child_policies",
        ["accommodation_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_child_policies_accommodation_id", table_name="accommodation_child_policies")
    op.drop_table("accommodation_child_policies")
    op.drop_column("accommodations", "extra_bed_fee")
    op.drop_column("accommodations", "additional_adult_requires_extra_bed")
    op.drop_column("accommodations", "additional_adult_fee")
    op.drop_column("accommodations", "base_occupancy")
