"""amenities column: text -> jsonb

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text(
        "ALTER TABLE accommodations ALTER COLUMN amenities TYPE jsonb "
        "USING CASE WHEN amenities IS NULL THEN NULL ELSE amenities::jsonb END"
    ))


def downgrade() -> None:
    op.execute(sa.text(
        "ALTER TABLE accommodations ALTER COLUMN amenities TYPE text "
        "USING amenities::text"
    ))
