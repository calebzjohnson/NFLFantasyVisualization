from typing import Any

from fastapi import APIRouter, Query

from app.services import scores

router = APIRouter(tags=["scores"])


@router.get("/scores")
def get_scores(
    week: int | None = Query(None, ge=1, description="Defaults to the current fantasy week"),
) -> list[dict[str, Any]]:
    return scores.get_week_scores(week=week)
