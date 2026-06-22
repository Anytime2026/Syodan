"""widen customer_profiles free-text columns to TEXT

Revision ID: 002
Revises: 001
Create Date: 2026-06-19

理由: LLM(Bedrock)が生成する顧客プロファイル(真の課題・性格など)は
128文字を超える詳細な日本語になるため、本番DBに残っていた VARCHAR(128)
列で StringDataRightTruncationError が発生し /api/programs が500になっていた。
LLM自由記述を受ける列は長さ制限を外す(TEXT)。
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TEXT_COLUMNS = [
    "industry",
    "company_size",
    "role_title",
    "surface_need",
    "true_challenge",
    "personality_type",
]


def upgrade() -> None:
    for column in _TEXT_COLUMNS:
        op.alter_column(
            "customer_profiles",
            column,
            type_=sa.Text(),
            existing_nullable=False,
        )


def downgrade() -> None:
    op.alter_column("customer_profiles", "industry", type_=sa.String(128), existing_nullable=False)
    op.alter_column("customer_profiles", "company_size", type_=sa.String(64), existing_nullable=False)
    op.alter_column("customer_profiles", "role_title", type_=sa.String(128), existing_nullable=False)
    op.alter_column("customer_profiles", "surface_need", type_=sa.Text(), existing_nullable=False)
    op.alter_column("customer_profiles", "true_challenge", type_=sa.Text(), existing_nullable=False)
    op.alter_column("customer_profiles", "personality_type", type_=sa.String(128), existing_nullable=False)
