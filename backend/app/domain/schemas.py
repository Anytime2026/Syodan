from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProgramCreate(BaseModel):
    field: str = Field(min_length=1, max_length=256)
    total_sessions: int = Field(ge=1, le=20)
    evaluator_ids: list[str] = Field(default_factory=list)
    user_id: str = "default-user"
    personality_type: str | None = None
    sub_field: str | None = None
    it_knowledge_level: str | None = None


class CustomerProfileResponse(BaseModel):
    industry: str
    company_size: str
    role_title: str
    surface_need: str
    personality_type: str
    initial_awareness: int
    true_challenge: str | None = None

    model_config = {"from_attributes": True}


class CustomerStateResponse(BaseModel):
    awareness_level: int
    rapport_level: int
    disclosed_info: list[str]
    session_summaries: list[dict]

    model_config = {"from_attributes": True}


class ProgramResponse(BaseModel):
    id: UUID
    field: str
    total_sessions: int
    status: str
    created_at: datetime
    reveal_challenge: bool
    customer_profile: CustomerProfileResponse | None = None
    customer_state: CustomerStateResponse | None = None
    completed_sessions: int = 0
    sessions: list["SessionListItem"] = Field(default_factory=list)
    overall_reviews: list["OverallReviewResponse"] = Field(default_factory=list)


class SessionCreate(BaseModel):
    goal: str = Field(min_length=1)
    time_limit_minutes: int = Field(ge=1, le=180)


class SessionResponse(BaseModel):
    id: UUID
    program_id: UUID
    session_number: int
    goal: str
    time_limit_minutes: int
    title: str | None
    status: str
    started_at: datetime | None
    ended_at: datetime | None
    transcript: str | None = None
    reveal_challenge: bool = False
    evaluations: list["EvaluationResponse"] = Field(default_factory=list)


class SessionListItem(BaseModel):
    id: UUID
    session_number: int
    title: str | None
    status: str
    started_at: datetime | None
    ended_at: datetime | None


class EvaluationResponse(BaseModel):
    id: UUID
    evaluator_id: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewPageResponse(BaseModel):
    session_id: UUID
    program_field: str
    session_number: int
    goal: str
    true_challenge: str
    formatted_transcript: str | None
    recording_url: str | None
    evaluations: list[EvaluationResponse]


class EvaluationArtifactRequest(BaseModel):
    session_id: UUID | None = None
    program_id: UUID | None = None
    formatted_transcript: str
    artifact_type: str = "session"


class OverallReviewResponse(BaseModel):
    id: UUID
    evaluator_id: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProgramDetailWithReviews(BaseModel):
    id: UUID
    status: str
    reveal_challenge: bool
    true_challenge: str | None
    overall_reviews: list[OverallReviewResponse]
    sessions: list[SessionListItem]
