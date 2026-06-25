"""ensure programs.materials_text and materials_filename exist

Revision ID: 007
Revises: 006
Create Date: 2026-06-25

004m may have been stamped without adding columns (silent try/except).
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE programs ADD COLUMN IF NOT EXISTS materials_text TEXT")
    op.execute(
        "ALTER TABLE programs ADD COLUMN IF NOT EXISTS materials_filename VARCHAR(256)"
    )


def downgrade() -> None:
    op.drop_column("programs", "materials_filename")
    op.drop_column("programs", "materials_text")
