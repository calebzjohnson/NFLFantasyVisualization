from typing import Any

from fastapi import APIRouter

from app.services import scores

router = APIRouter(tags=["scores"])


@router.get("/scores")
def get_scores() -> list[dict[str, Any]]:
    return scores.get_last_completed_week_scores()
