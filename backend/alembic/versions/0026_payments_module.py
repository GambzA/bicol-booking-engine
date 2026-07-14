"""add payment_number, recorded_by_user_id, refunded_payment_id to payment_records

Revision ID: 0026
Revises: 0025
Create Date: 2026-07-06

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payment_records", sa.Column("payment_number", sa.String(30), nullable=True))
    op.add_column("payment_records", sa.Column("recorded_by_user_id", sa.UUID(), nullable=True))
    op.add_column("payment_records", sa.Column("refunded_payment_id", sa.UUID(), nullable=True))

    # Backfill any pre-existing rows with a unique placeholder number before enforcing NOT NULL + unique.
    op.execute("UPDATE payment_records SET payment_number = 'PAY-BACKFILL-' || substr(id::text, 1, 8) WHERE payment_number IS NULL")

    op.alter_column("payment_records", "payment_number", nullable=False)
    op.create_unique_constraint("uq_payment_records_payment_number", "payment_records", ["payment_number"])
    op.create_foreign_key(
        "fk_payment_records_recorded_by_user_id", "payment_records", "users",
        ["recorded_by_user_id"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_payment_records_refunded_payment_id", "payment_records", "payment_records",
        ["refunded_payment_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("ix_payment_records_booking_id", "payment_records", ["booking_id"])


def downgrade() -> None:
    op.drop_index("ix_payment_records_booking_id", table_name="payment_records")
    op.drop_constraint("fk_payment_records_refunded_payment_id", "payment_records", type_="foreignkey")
    op.drop_constraint("fk_payment_records_recorded_by_user_id", "payment_records", type_="foreignkey")
    op.drop_constraint("uq_payment_records_payment_number", "payment_records", type_="unique")
    op.drop_column("payment_records", "refunded_payment_id")
    op.drop_column("payment_records", "recorded_by_user_id")
    op.drop_column("payment_records", "payment_number")
