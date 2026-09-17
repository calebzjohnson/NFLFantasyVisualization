from typing import Any

from fastapi import APIRouter

from app.services import teams

router = APIRouter(tags=["teams"])


@router.get("/teams")
def get_teams() -> list[dict[str, Any]]:
    return teams.get_current_teams()
