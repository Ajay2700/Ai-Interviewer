from typing import List, Literal

from pydantic import BaseModel, Field


class Evaluation(BaseModel):
    score: int = Field(..., ge=0, le=10)
    confidence: int = Field(..., ge=0, le=100)
    strengths: List[str]
    weaknesses: List[str]
    improvements: List[str]
    verdict: str
    feedback: str


class QuestionResponse(BaseModel):
    id: int
    company: str
    role: str
    difficulty: str
    question: str


class InterviewQuestionResponse(BaseModel):
    role: str
    difficulty: str
    question: str
    source: str
    interview_id: str


class AnswerResponse(BaseModel):
    transcript: str
    evaluation: Evaluation


class QuestionCreate(BaseModel):
    company: str = Field(default="General", min_length=2)
    role: str = Field(..., min_length=2)
    difficulty: str = Field(..., pattern="^(easy|medium|hard)$")
    question: str = Field(..., min_length=5)


class InterviewStartResponse(BaseModel):
    session_id: str
    user_id: str
    question: str
    mode: Literal["company", "ai", "hybrid"]
    source: str
    question_index: int
    db_questions_count: int = 0


class InterviewNextRequest(BaseModel):
    user_id: str = Field(..., min_length=2)
    session_id: str = Field(..., min_length=2)
    mode: Literal["company", "ai", "hybrid"]
    role: str = Field(..., min_length=2)
    difficulty: str = Field(..., pattern="^(easy|medium|hard)$")
    previous_question: str
    user_answer: str
    question_index: int = Field(..., ge=0)


class InterviewNextResponse(BaseModel):
    session_id: str
    user_id: str
    question: str
    mode: Literal["company", "ai", "hybrid"]
    source: str
    question_index: int


class ProctoringEvent(BaseModel):
    timestamp: str
    type: str
    message: str
    counted: bool = False
    metadata: dict = Field(default_factory=dict)


class ProctoringLogRequest(BaseModel):
    candidate_id: str = Field(..., min_length=2)
    session_id: str = Field(..., min_length=2)
    role: str = Field(..., min_length=2)
    difficulty: str = Field(..., pattern="^(easy|medium|hard)$")
    mode: Literal["company", "ai", "hybrid"]
    status: str = Field(..., min_length=2)
    violations: int = Field(..., ge=0)
    terminated: bool = False
    events: List[ProctoringEvent] = Field(default_factory=list)


class ProctoringLogResponse(BaseModel):
    ok: bool = True
    log_file: str
    events_stored: int


class AdminOtpRequest(BaseModel):
    email: str = Field(..., min_length=5)


class AdminOtpVerifyRequest(BaseModel):
    email: str = Field(..., min_length=5)
    code: str = Field(..., min_length=4, max_length=10)


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int


class AdminSmtpTestRequest(BaseModel):
    email: str = Field(..., min_length=5)


class AdminSmtpTestResponse(BaseModel):
    ok: bool = True
    message: str


class UsageSummaryResponse(BaseModel):
    user_id: str
    plan: str
    total_tokens_used: int
    daily_tokens_used: int
    daily_questions_used: int
    questions_attempted: int
    daily_tokens_limit: int
    daily_questions_limit: int
    questions_left_today: int
    tokens_left_today: int

