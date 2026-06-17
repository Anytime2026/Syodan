from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from ai_agent import LLMSalesRoleplayAgent

app = FastAPI(title="営業ヒアリングロープレAI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict[str, LLMSalesRoleplayAgent] = {}


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: List[Message]
    industry: str


class ChatResponse(BaseModel):
    message: str
    phase: str
    phase_label: str


class ResetRequest(BaseModel):
    session_id: str


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if request.session_id not in sessions:
        sessions[request.session_id] = LLMSalesRoleplayAgent(industry=request.industry)

    agent = sessions[request.session_id]
    result = await agent.get_response(
        request.message,
        [m.model_dump() for m in request.history],
    )
    return ChatResponse(**result)


@app.post("/api/reset")
async def reset(request: ResetRequest):
    sessions.pop(request.session_id, None)
    return {"status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
