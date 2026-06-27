"""expand guests table with first/last name, dob, address

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add first_name / last_name as nullable first so we can backfill
    op.add_column("guests", sa.Column("first_name", sa.String(150), nullable=True))
    op.add_column("guests", sa.Column("last_name", sa.String(150), nullable=True))

    # Backfill from full_name: first word -> first_name, remainder -> last_name
    op.execute(sa.text("""
        UPDATE guests SET
            first_name = CASE
                WHEN position(' ' IN full_name) > 0 THEN split_part(full_name, ' ', 1)
                ELSE full_name
            END,
            last_name = CASE
                WHEN position(' ' IN full_name) > 0
                    THEN trim(substring(full_name FROM position(' ' IN full_name) + 1))
                ELSE ''
            END
    """))

    op.alter_column("guests", "first_name", nullable=False)
    op.alter_column("guests", "last_name", nullable=False)
    op.drop_column("guests", "full_name")

    op.add_column("guests", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("guests", sa.Column("address", sa.Text(), nullable=True))

    op.create_index("ix_guests_email", "guests", ["email"])
    op.create_index("ix_guests_mobile_number", "guests", ["mobile_number"])


def downgrade() -> None:
    op.drop_index("ix_guests_mobile_number", table_name="guests")
    op.drop_index("ix_guests_email", table_name="guests")

    op.drop_column("guests", "address")
    op.drop_column("guests", "date_of_birth")

    op.add_column("guests", sa.Column("full_name", sa.String(255), nullable=True))
    op.execute(sa.text(
        "UPDATE guests SET full_name = trim(concat(first_name, ' ', last_name))"
    ))
    op.alter_column("guests", "full_name", nullable=False)

    op.drop_column("guests", "last_name")
    op.drop_column("guests", "first_name")
