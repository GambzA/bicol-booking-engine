"""payment methods + bank accounts + transactions; rename guest_payments -> payment_records

Revision ID: 0024
Revises: 0023
Create Date: 2026-07-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Payment method config + bank accounts.
    op.create_table(
        "payment_methods",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hotel_id", sa.UUID(), nullable=False),
        sa.Column("method_type", sa.String(30), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("deposit_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deposit_type", sa.String(20), nullable=True),
        sa.Column("deposit_value", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_methods_hotel_id", "payment_methods", ["hotel_id"])

    op.create_table(
        "payment_method_bank_accounts",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("payment_method_id", sa.UUID(), nullable=False),
        sa.Column("account_name", sa.String(255), nullable=False),
        sa.Column("bank_name", sa.String(255), nullable=False),
        sa.Column("account_number", sa.String(100), nullable=False),
        sa.Column("branch", sa.String(255), nullable=True),
        sa.Column("swift_code", sa.String(50), nullable=True),
        sa.Column("iban", sa.String(50), nullable=True),
        sa.Column("qr_image_url", sa.String(500), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["payment_method_id"], ["payment_methods.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pm_bank_accounts_method_id", "payment_method_bank_accounts", ["payment_method_id"])

    # 2. Rename the payment status enum type and add the new values (additive).
    op.execute("ALTER TYPE guestpaymentstatus RENAME TO paymentrecordstatus")
    op.execute("ALTER TYPE paymentrecordstatus ADD VALUE IF NOT EXISTS 'partially_paid'")
    op.execute("ALTER TYPE paymentrecordstatus ADD VALUE IF NOT EXISTS 'cancelled'")

    # 3. Rename guest_payments -> payment_records and extend with the method link.
    op.rename_table("guest_payments", "payment_records")
    op.add_column("payment_records", sa.Column("payment_method_id", sa.UUID(), nullable=True))
    op.add_column("payment_records", sa.Column("payment_method_name_snapshot", sa.String(255), nullable=True))
    op.create_foreign_key(
        "fk_payment_records_payment_method_id", "payment_records",
        "payment_methods", ["payment_method_id"], ["id"], ondelete="SET NULL",
    )

    # 4. Immutable transaction ledger under each payment record.
    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("payment_record_id", sa.UUID(), nullable=False),
        sa.Column("transaction_type", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("external_transaction_id", sa.String(255), nullable=True),
        sa.Column("gateway_response", sa.Text(), nullable=True),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["payment_record_id"], ["payment_records.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_transactions_record_id", "payment_transactions", ["payment_record_id"])

    # 5. Booking -> selected payment method + deposit snapshot.
    op.add_column("bookings", sa.Column("payment_method_id", sa.UUID(), nullable=True))
    op.add_column("bookings", sa.Column("payment_method_name_snapshot", sa.String(255), nullable=True))
    op.add_column("bookings", sa.Column("deposit_required", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("bookings", sa.Column("deposit_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"))
    op.create_foreign_key(
        "fk_bookings_payment_method_id", "bookings",
        "payment_methods", ["payment_method_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_bookings_payment_method_id", "bookings", type_="foreignkey")
    op.drop_column("bookings", "deposit_amount")
    op.drop_column("bookings", "deposit_required")
    op.drop_column("bookings", "payment_method_name_snapshot")
    op.drop_column("bookings", "payment_method_id")

    op.drop_index("ix_payment_transactions_record_id", table_name="payment_transactions")
    op.drop_table("payment_transactions")

    op.drop_constraint("fk_payment_records_payment_method_id", "payment_records", type_="foreignkey")
    op.drop_column("payment_records", "payment_method_name_snapshot")
    op.drop_column("payment_records", "payment_method_id")
    op.rename_table("payment_records", "guest_payments")
    # enum: rename back (new values remain in the type; harmless)
    op.execute("ALTER TYPE paymentrecordstatus RENAME TO guestpaymentstatus")

    op.drop_index("ix_pm_bank_accounts_method_id", table_name="payment_method_bank_accounts")
    op.drop_table("payment_method_bank_accounts")
    op.drop_index("ix_payment_methods_hotel_id", table_name="payment_methods")
    op.drop_table("payment_methods")
