"""platform admin portal

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-21

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- Enum types. Each is used in exactly one table, so create_table/add_column
    # creates the PG type exactly once. Do NOT pre-create with op.execute (that
    # double-creates and raises DuplicateObject).
    hotelstatus             = sa.Enum("active", "suspended", "deactivated", name="hotelstatus")
    subscriptionstatus      = sa.Enum("trial", "active", "past_due", "suspended", "cancelled", name="subscriptionstatus")
    billingcycle            = sa.Enum("monthly", "annual", name="billingcycle")
    periodtype              = sa.Enum("monthly", "annual", name="periodtype")
    commissionstmtstatus    = sa.Enum("draft", "finalized", name="commissionstatementstatus")
    invoicetype             = sa.Enum("subscription", "commission", "combined", "one_time", name="invoicetype")
    invoicestatus           = sa.Enum("draft", "sent", "paid", "overdue", "cancelled", "void", name="invoicestatus")

    # -- hotels: add status column
    # op.add_column does NOT auto-create enum types (only create_table does).
    # Create hotelstatus explicitly, then reference it with create_type=False.
    op.execute(sa.text("CREATE TYPE hotelstatus AS ENUM ('active', 'suspended', 'deactivated')"))
    op.add_column("hotels", sa.Column(
        "status",
        postgresql.ENUM("active", "suspended", "deactivated", name="hotelstatus", create_type=False),
        nullable=False,
        server_default="active",
    ))

    # -- platform_admins
    op.create_table(
        "platform_admins",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # -- admin_refresh_tokens
    op.create_table(
        "admin_refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(512), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["admin_id"], ["platform_admins.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )

    # -- subscription_plans
    op.create_table(
        "subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("monthly_fee", sa.Numeric(10, 2), nullable=False),
        sa.Column("annual_fee", sa.Numeric(10, 2), nullable=False),
        sa.Column("commission_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("trial_period_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_users", sa.Integer(), nullable=True),
        sa.Column("max_properties", sa.Integer(), nullable=True),
        sa.Column("features", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # -- property_subscriptions
    op.create_table(
        "property_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", subscriptionstatus, nullable=False),
        sa.Column("billing_cycle", billingcycle, nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("trial_end_date", sa.Date(), nullable=True),
        sa.Column("next_billing_date", sa.Date(), nullable=False),
        sa.Column("grace_period_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("auto_suspend", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plan_id"], ["subscription_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hotel_id", name="uq_property_subscription_hotel"),
    )

    # -- commission_statements (WITHOUT invoice_id to break circular FK)
    op.create_table(
        "commission_statements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_type", periodtype, nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("total_booking_revenue", sa.Numeric(12, 2), nullable=False),
        sa.Column("eligible_booking_revenue", sa.Numeric(12, 2), nullable=False),
        sa.Column("commission_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("total_commission_due", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", commissionstmtstatus, nullable=False, server_default="draft"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["platform_admins.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # -- invoices
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_number", sa.String(50), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", invoicetype, nullable=False),
        sa.Column("status", invoicestatus, nullable=False, server_default="draft"),
        sa.Column("billing_period_start", sa.Date(), nullable=False),
        sa.Column("billing_period_end", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("subscription_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("commission_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("commission_statement_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["platform_admins.id"]),
        sa.ForeignKeyConstraint(["commission_statement_id"], ["commission_statements.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_number"),
    )

    # -- add invoice_id back to commission_statements (closes circular FK)
    op.add_column("commission_statements", sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_commission_statement_invoice_id",
        "commission_statements", "invoices",
        ["invoice_id"], ["id"],
    )

    # -- payments
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("proof_of_payment_url", sa.String(1000), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["recorded_by"], ["platform_admins.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # -- commission_adjustments
    op.create_table(
        "commission_adjustments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("statement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["statement_id"], ["commission_statements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approved_by"], ["platform_admins.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # -- audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.String(255), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("before_state", postgresql.JSONB(), nullable=True),
        sa.Column("after_state", postgresql.JSONB(), nullable=True),
        sa.Column("extra", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["admin_id"], ["platform_admins.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_hotel_id", "audit_logs", ["hotel_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("commission_adjustments")
    op.drop_table("payments")
    op.drop_constraint("fk_commission_statement_invoice_id", "commission_statements", type_="foreignkey")
    op.drop_column("commission_statements", "invoice_id")
    op.drop_table("invoices")
    op.drop_table("commission_statements")
    op.drop_table("property_subscriptions")
    op.drop_table("subscription_plans")
    op.drop_table("admin_refresh_tokens")
    op.drop_table("platform_admins")
    op.drop_column("hotels", "status")
    op.execute("DROP TYPE IF EXISTS hotelstatus")
    op.execute("DROP TYPE IF EXISTS subscriptionstatus")
    op.execute("DROP TYPE IF EXISTS billingcycle")
    op.execute("DROP TYPE IF EXISTS periodtype")
    op.execute("DROP TYPE IF EXISTS commissionstatementstatus")
    op.execute("DROP TYPE IF EXISTS invoicetype")
    op.execute("DROP TYPE IF EXISTS invoicestatus")
