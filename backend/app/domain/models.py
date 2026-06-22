import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(128), default="default-user")
    field: Mapped[str] = mapped_column(String(256))
    total_sessions: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="created")
    evaluator_ids: Mapped[list] = mapped_column(JSON, default=list)
    profile_hints: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    customer_profile: Mapped["CustomerProfile | None"] = relationship(back_populates="program", uselist=False)
    customer_state: Mapped["CustomerState | None"] = relationship(back_populates="program", uselist=False)
    sessions: Mapped[list["HearingSession"]] = relationship(back_populates="program")
    overall_reviews: Mapped[list["OverallReview"]] = relationship(back_populates="program")


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("programs.id"), unique=True)
    industry: Mapped[str] = mapped_column(Text)
    company_size: Mapped[str] = mapped_column(Text)
    role_title: Mapped[str] = mapped_column(Text)
    surface_need: Mapped[str] = mapped_column(Text)
    true_challenge: Mapped[str] = mapped_column(Text)
    personality_type: Mapped[str] = mapped_column(Text)
    initial_awareness: Mapped[int] = mapped_column(Integer, default=20)

    program: Mapped["Program"] = relationship(back_populates="customer_profile")


class CustomerState(Base):
    __tablename__ = "customer_states"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("programs.id"), unique=True)
    awareness_level: Mapped[int] = mapped_column(Integer, default=20)
    rapport_level: Mapped[int] = mapped_column(Integer, default=30)
    disclosed_info: Mapped[list] = mapped_column(JSON, default=list)
    session_summaries: Mapped[list] = mapped_column(JSON, default=list)

    program: Mapped["Program"] = relationship(back_populates="customer_state")


class HearingSession(Base):
    __tablename__ = "hearing_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("programs.id"))
    session_number: Mapped[int] = mapped_column(Integer)
    goal: Mapped[str] = mapped_column(Text)
    time_limit_minutes: Mapped[int] = mapped_column(Integer)
    title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="not_started")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    formatted_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    recording_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    review_token: Mapped[str] = mapped_column(String(64), default=lambda: uuid.uuid4().hex)
    conversation_log: Mapped[list] = mapped_column(JSON, default=list)

    program: Mapped["Program"] = relationship(back_populates="sessions")
    evaluations: Mapped[list["Evaluation"]] = relationship(back_populates="session")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hearing_sessions.id"))
    evaluator_id: Mapped[str] = mapped_column(String(128))
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["HearingSession"] = relationship(back_populates="evaluations")


class OverallReview(Base):
    __tablename__ = "overall_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("programs.id"))
    evaluator_id: Mapped[str] = mapped_column(String(128))
    content: Mapped[str] = mapped_column(Text, default="")
    review_token: Mapped[str] = mapped_column(String(64), default=lambda: uuid.uuid4().hex)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    program: Mapped["Program"] = relationship(back_populates="overall_reviews")
