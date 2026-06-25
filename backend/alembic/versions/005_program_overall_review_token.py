"""add programs.overall_review_token

Revision ID: 005
Revises: 004
Create Date: 2026-06-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004m"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "programs",
        sa.Column("overall_review_token", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("programs", "overall_review_token")
