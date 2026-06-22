"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "programs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), nullable=False),
        sa.Column("field", sa.String(64), nullable=False),
        sa.Column("total_sessions", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("evaluator_ids", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table(
        "customer_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("programs.id"), unique=True),
        sa.Column("industry", sa.String(128), nullable=False),
        sa.Column("company_size", sa.String(64), nullable=False),
        sa.Column("role_title", sa.String(128), nullable=False),
        sa.Column("surface_need", sa.Text(), nullable=False),
        sa.Column("true_challenge", sa.Text(), nullable=False),
        sa.Column("personality_type", sa.String(128), nullable=False),
        sa.Column("initial_awareness", sa.Integer(), nullable=False),
    )
    op.create_table(
        "customer_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("programs.id"), unique=True),
        sa.Column("awareness_level", sa.Integer(), nullable=False),
        sa.Column("rapport_level", sa.Integer(), nullable=False),
        sa.Column("disclosed_info", postgresql.JSONB(), nullable=False),
        sa.Column("session_summaries", postgresql.JSONB(), nullable=False),
    )
    op.create_table(
        "hearing_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("programs.id")),
        sa.Column("session_number", sa.Integer(), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("time_limit_minutes", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(256), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("formatted_transcript", sa.Text(), nullable=True),
        sa.Column("recording_s3_key", sa.String(512), nullable=True),
        sa.Column("review_token", sa.String(64), nullable=False),
        sa.Column("conversation_log", postgresql.JSONB(), nullable=False),
    )
    op.create_table(
        "evaluations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hearing_sessions.id")),
        sa.Column("evaluator_id", sa.String(128), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table(
        "overall_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("programs.id")),
        sa.Column("evaluator_id", sa.String(128), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("review_token", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("overall_reviews")
    op.drop_table("evaluations")
    op.drop_table("hearing_sessions")
    op.drop_table("customer_states")
    op.drop_table("customer_profiles")
    op.drop_table("programs")
