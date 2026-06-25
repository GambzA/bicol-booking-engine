"""accommodation expansion: num_units, max_adults, max_children, images

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("accommodations", sa.Column("num_units", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("accommodations", sa.Column("max_adults", sa.Integer(), nullable=True))
    op.add_column("accommodations", sa.Column("max_children", sa.Integer(), nullable=True))
    op.add_column("accommodations", sa.Column("images", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("accommodations", "images")
    op.drop_column("accommodations", "max_children")
    op.drop_column("accommodations", "max_adults")
    op.drop_column("accommodations", "num_units")
