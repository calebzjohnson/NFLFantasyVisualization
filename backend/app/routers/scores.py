from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query

from app.services import scores

router = APIRouter(tags=["scores"])


@router.get("/scores")
def get_scores(
    week: int | None = Query(None, ge=1, description="Defaults to the current fantasy week"),
) -> list[dict[str, Any]]:
    # Resolved here, not in the service, so the default week is part of the
    # cache key and rolls over on Wednesday instead of when the entry expires.
    today = datetime.now(scores.EASTERN).date()
    return scores.get_week_scores(week=week, today=today)
