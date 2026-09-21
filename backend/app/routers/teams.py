from typing import Any

from fastapi import APIRouter

from app.services import team_efficiency, teams

router = APIRouter(tags=["teams"])


@router.get("/teams")
def get_teams() -> list[dict[str, Any]]:
    return teams.get_current_teams()


@router.get("/teams/efficiency")
def get_team_efficiency() -> list[dict[str, Any]]:
    return team_efficiency.get_current_team_efficiency()
