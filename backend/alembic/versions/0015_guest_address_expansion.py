"""expand guest address fields and add country FK

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("guests", "address")

    op.add_column("guests", sa.Column("address_line_1", sa.Text(), nullable=True))
    op.add_column("guests", sa.Column("address_line_2", sa.Text(), nullable=True))
    op.add_column("guests", sa.Column("city", sa.String(150), nullable=True))
    op.add_column("guests", sa.Column("state_province", sa.String(150), nullable=True))
    op.add_column("guests", sa.Column("postal_code", sa.String(20), nullable=True))
    op.add_column("guests", sa.Column("country_id", sa.UUID(), nullable=True))

    op.create_foreign_key(
        "fk_guests_country_id",
        "guests", "reference_countries",
        ["country_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_guests_country_id", "guests", type_="foreignkey")
    op.drop_column("guests", "country_id")
    op.drop_column("guests", "postal_code")
    op.drop_column("guests", "state_province")
    op.drop_column("guests", "city")
    op.drop_column("guests", "address_line_2")
    op.drop_column("guests", "address_line_1")

    op.add_column("guests", sa.Column("address", sa.Text(), nullable=True))
