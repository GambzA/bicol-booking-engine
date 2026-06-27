"""add promotions tables and booking promotion snapshot

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "promotions",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hotel_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("discount_type", sa.String(50), nullable=False),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("stay_start_date", sa.Date(), nullable=True),
        sa.Column("stay_end_date", sa.Date(), nullable=True),
        sa.Column("booking_start_date", sa.Date(), nullable=True),
        sa.Column("booking_end_date", sa.Date(), nullable=True),
        sa.Column("promo_code", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_promotions_hotel_id", "promotions", ["hotel_id"])
    op.create_index(
        "uq_promotion_promo_code",
        "promotions",
        ["hotel_id", "promo_code"],
        unique=True,
        postgresql_where=sa.text("promo_code IS NOT NULL AND deleted_at IS NULL"),
    )

    op.create_table(
        "promotion_accommodations",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("promotion_id", sa.UUID(), nullable=False),
        sa.Column("accommodation_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["promotion_id"], ["promotions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["accommodation_id"], ["accommodations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("promotion_id", "accommodation_id", name="uq_promotion_accommodation"),
    )

    op.create_table(
        "promotion_rate_plans",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("promotion_id", sa.UUID(), nullable=False),
        sa.Column("rate_plan_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["promotion_id"], ["promotions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rate_plan_id"], ["rate_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("promotion_id", "rate_plan_id", name="uq_promotion_rate_plan"),
    )

    # Booking promotion snapshot columns
    op.add_column("bookings", sa.Column("promotion_id", sa.UUID(), nullable=True))
    op.add_column("bookings", sa.Column("promotion_name_snapshot", sa.String(255), nullable=True))
    op.add_column("bookings", sa.Column("discount_type_snapshot", sa.String(50), nullable=True))
    op.add_column("bookings", sa.Column("discount_value_snapshot", sa.Numeric(10, 2), nullable=True))
    op.create_foreign_key(
        "fk_bookings_promotion_id",
        "bookings", "promotions",
        ["promotion_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_bookings_promotion_id", "bookings", type_="foreignkey")
    op.drop_column("bookings", "discount_value_snapshot")
    op.drop_column("bookings", "discount_type_snapshot")
    op.drop_column("bookings", "promotion_name_snapshot")
    op.drop_column("bookings", "promotion_id")

    op.drop_table("promotion_rate_plans")
    op.drop_table("promotion_accommodations")
    op.drop_index("uq_promotion_promo_code", table_name="promotions")
    op.drop_index("ix_promotions_hotel_id", table_name="promotions")
    op.drop_table("promotions")
