"""accommodation unit availability table

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accommodation_unit_availability",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("accommodation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unit_number", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("is_available", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["accommodation_id"], ["accommodations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "accommodation_id", "unit_number", "date", name="uq_unit_availability"
        ),
    )
    op.create_index(
        "ix_unit_avail_acc_date",
        "accommodation_unit_availability",
        ["accommodation_id", "date"],
    )


def downgrade() -> None:
    op.drop_index("ix_unit_avail_acc_date", table_name="accommodation_unit_availability")
    op.drop_table("accommodation_unit_availability")
