"""property expansion

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-22

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- propertytype enum (used in add_column, must be pre-created)
    op.execute(sa.text(
        "CREATE TYPE propertytype AS ENUM "
        "('hotel','resort','apartment','hostel','villa','bed_and_breakfast','guest_house')"
    ))

    # -- hotels: new columns
    op.add_column("hotels", sa.Column("business_name", sa.String(255), nullable=True))
    op.add_column("hotels", sa.Column(
        "property_type",
        postgresql.ENUM("hotel", "resort", "apartment", "hostel", "villa",
                        "bed_and_breakfast", "guest_house",
                        name="propertytype", create_type=False),
        nullable=False,
        server_default="hotel",
    ))
    op.add_column("hotels", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("hotels", sa.Column("contact_person", sa.String(255), nullable=True))
    op.add_column("hotels", sa.Column("mobile_number", sa.String(50), nullable=True))
    op.add_column("hotels", sa.Column("telephone_number", sa.String(50), nullable=True))
    op.add_column("hotels", sa.Column("province", sa.String(100), nullable=True))
    op.add_column("hotels", sa.Column("address_line_1", sa.String(255), nullable=True))
    op.add_column("hotels", sa.Column("address_line_2", sa.String(255), nullable=True))
    op.add_column("hotels", sa.Column("postal_code", sa.String(20), nullable=True))
    op.add_column("hotels", sa.Column("latitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("hotels", sa.Column("longitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("hotels", sa.Column("default_currency", sa.String(3), nullable=False, server_default="PHP"))
    op.add_column("hotels", sa.Column("timezone", sa.String(50), nullable=False, server_default="Asia/Manila"))
    op.add_column("hotels", sa.Column("language", sa.String(10), nullable=False, server_default="en"))
    op.add_column("hotels", sa.Column("banner_image_url", sa.String(1000), nullable=True))
    op.add_column("hotels", sa.Column("logo_url", sa.String(1000), nullable=True))

    # -- users: new columns
    op.add_column("users", sa.Column("first_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("mobile_number", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("username", sa.String(100), nullable=True))
    op.create_unique_constraint("uq_users_username", "users", ["username"])

    # -- property_photos
    op.create_table(
        "property_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("caption", sa.String(255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_property_photos_hotel_id", "property_photos", ["hotel_id"])


def downgrade() -> None:
    op.drop_index("ix_property_photos_hotel_id", "property_photos")
    op.drop_table("property_photos")
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_column("users", "username")
    op.drop_column("users", "mobile_number")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
    op.drop_column("hotels", "logo_url")
    op.drop_column("hotels", "banner_image_url")
    op.drop_column("hotels", "language")
    op.drop_column("hotels", "timezone")
    op.drop_column("hotels", "default_currency")
    op.drop_column("hotels", "longitude")
    op.drop_column("hotels", "latitude")
    op.drop_column("hotels", "postal_code")
    op.drop_column("hotels", "address_line_2")
    op.drop_column("hotels", "address_line_1")
    op.drop_column("hotels", "province")
    op.drop_column("hotels", "telephone_number")
    op.drop_column("hotels", "mobile_number")
    op.drop_column("hotels", "contact_person")
    op.drop_column("hotels", "description")
    op.drop_column("hotels", "property_type")
    op.drop_column("hotels", "business_name")
    op.execute(sa.text("DROP TYPE IF EXISTS propertytype"))
