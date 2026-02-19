import random
from typing import List, Optional

from core.database import Question, get_db, utc_now
from models.schemas import QuestionCreate, QuestionResponse


def create_question(data: QuestionCreate) -> QuestionResponse:
    with get_db() as db:
        row = Question(
            company=data.company.strip(),
            role=data.role.strip(),
            difficulty=data.difficulty.strip(),
            question=data.question.strip(),
            created_at=utc_now(),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return QuestionResponse(
            id=row.id,
            company=row.company,
            role=row.role,
            difficulty=row.difficulty,
            question=row.question,
        )


def get_all_questions() -> List[QuestionResponse]:
    with get_db() as db:
        rows = db.query(Question).order_by(Question.id.desc()).all()
        return [
            QuestionResponse(
                id=row.id,
                company=row.company,
                role=row.role,
                difficulty=row.difficulty,
                question=row.question,
            )
            for row in rows
        ]


def get_questions(role: str, difficulty: str) -> List[QuestionResponse]:
    # DB-first strategy gives consistent baseline questions and allows admin control.
    with get_db() as db:
        rows = (
            db.query(Question)
            .filter(Question.role.ilike(role.strip()))
            .filter(Question.difficulty.ilike(difficulty.strip()))
            .order_by(Question.id.asc())
            .all()
        )
        return [
            QuestionResponse(
                id=row.id,
                company=row.company,
                role=row.role,
                difficulty=row.difficulty,
                question=row.question,
            )
            for row in rows
        ]


def get_company_questions(
    role: str,
    difficulty: str,
    *,
    limit: Optional[int] = None,
    shuffle: bool = True,
) -> List[QuestionResponse]:
    """
    Fetch interviewer-curated company questions from database.

    Why this exists:
    - Company mode needs deterministic, standardized questions.
    - Hybrid mode starts with DB questions before AI adaptability kicks in.
    """
    questions = get_questions(role=role, difficulty=difficulty)
    if shuffle and len(questions) > 1:
        random.shuffle(questions)
    if limit is not None:
        return questions[:limit]
    return questions


def update_question(question_id: int, data: QuestionCreate) -> Optional[QuestionResponse]:
    with get_db() as db:
        row = db.query(Question).filter(Question.id == question_id).first()
        if not row:
            return None
        row.company = data.company.strip()
        row.role = data.role.strip()
        row.difficulty = data.difficulty.strip()
        row.question = data.question.strip()
        db.commit()
        db.refresh(row)
        return QuestionResponse(
            id=row.id,
            company=row.company,
            role=row.role,
            difficulty=row.difficulty,
            question=row.question,
        )


def delete_question(question_id: int) -> bool:
    with get_db() as db:
        row = db.query(Question).filter(Question.id == question_id).first()
        if not row:
            return False
        db.delete(row)
        db.commit()
        return True

