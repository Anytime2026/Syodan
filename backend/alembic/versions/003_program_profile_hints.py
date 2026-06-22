"""add programs.profile_hints and widen field column

Revision ID: 003
Revises: 002
Create Date: 2026-06-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("programs", sa.Column("profile_hints", sa.JSON(), nullable=True))
    op.alter_column(
        "programs",
        "field",
        type_=sa.String(256),
        existing_type=sa.String(64),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "programs",
        "field",
        type_=sa.String(64),
        existing_type=sa.String(256),
        existing_nullable=False,
    )
    op.drop_column("programs", "profile_hints")
