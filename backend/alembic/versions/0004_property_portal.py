"""property portal models

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text(
        "CREATE TYPE accommodationtype AS ENUM "
        "('room','suite','villa','dormitory','cabin','apartment','cottage','tent')"
    ))
    op.execute(sa.text(
        "CREATE TYPE bookingstatus AS ENUM "
        "('pending_payment','confirmed','checked_in','checked_out','cancelled','refunded','no_show')"
    ))
    op.execute(sa.text(
        "CREATE TYPE guestpaymentstatus AS ENUM "
        "('pending','paid','failed','refunded')"
    ))

    op.create_table(
        "accommodations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "accommodation_type",
            postgresql.ENUM(
                "room", "suite", "villa", "dormitory", "cabin", "apartment", "cottage", "tent",
                name="accommodationtype", create_type=False,
            ),
            nullable=False,
            server_default="room",
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("max_occupancy", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("base_rate", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("weekend_rate", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("check_in_time", sa.String(10), nullable=True),
        sa.Column("check_out_time", sa.String(10), nullable=True),
        sa.Column("amenities", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accommodations_hotel_id", "accommodations", ["hotel_id"])

    op.create_table(
        "guests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("mobile_number", sa.String(50), nullable=True),
        sa.Column("nationality", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_guests_hotel_id", "guests", ["hotel_id"])

    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("accommodation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("guest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("booking_number", sa.String(50), nullable=False),
        sa.Column("check_in_date", sa.Date(), nullable=False),
        sa.Column("check_out_date", sa.Date(), nullable=False),
        sa.Column("num_guests", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending_payment", "confirmed", "checked_in", "checked_out",
                "cancelled", "refunded", "no_show",
                name="bookingstatus", create_type=False,
            ),
            nullable=False,
            server_default="pending_payment",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["accommodation_id"], ["accommodations.id"]),
        sa.ForeignKeyConstraint(["guest_id"], ["guests.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("booking_number"),
    )
    op.create_index("ix_bookings_hotel_id", "bookings", ["hotel_id"])
    op.create_index("ix_bookings_check_in_date", "bookings", ["check_in_date"])
    op.create_index("ix_bookings_check_out_date", "bookings", ["check_out_date"])

    op.create_table(
        "guest_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("method", sa.String(50), nullable=True),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending", "paid", "failed", "refunded",
                name="guestpaymentstatus", create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_guest_payments_hotel_id", "guest_payments", ["hotel_id"])


def downgrade() -> None:
    op.drop_index("ix_guest_payments_hotel_id", "guest_payments")
    op.drop_table("guest_payments")
    op.drop_index("ix_bookings_check_out_date", "bookings")
    op.drop_index("ix_bookings_check_in_date", "bookings")
    op.drop_index("ix_bookings_hotel_id", "bookings")
    op.drop_table("bookings")
    op.drop_index("ix_guests_hotel_id", "guests")
    op.drop_table("guests")
    op.drop_index("ix_accommodations_hotel_id", "accommodations")
    op.drop_table("accommodations")
    op.execute(sa.text("DROP TYPE IF EXISTS guestpaymentstatus"))
    op.execute(sa.text("DROP TYPE IF EXISTS bookingstatus"))
    op.execute(sa.text("DROP TYPE IF EXISTS accommodationtype"))
