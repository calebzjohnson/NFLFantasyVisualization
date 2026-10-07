from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.rate_limit import heavy_limit
from app.services import scoring_composition, team_efficiency, team_radar, teams

router = APIRouter(tags=["teams"])


@router.get("/teams")
def get_teams() -> list[dict[str, Any]]:
    return teams.get_current_teams()


@router.get("/teams/efficiency")
@heavy_limit
def get_team_efficiency(request: Request) -> list[dict[str, Any]]:
    return team_efficiency.get_current_team_efficiency()


@router.get("/teams/weekly")
def get_team_game_stats() -> list[dict[str, Any]]:
    return teams.get_team_game_stats()


@router.get("/teams/radar-pool")
@heavy_limit
def get_teams_radar_pool(request: Request) -> dict[str, Any]:
    return team_radar.get_team_radar_pool()


@router.get("/teams/{team}/scoring")
def get_team_scoring_composition(team: str) -> dict[str, Any]:
    try:
        return scoring_composition.get_team_scoring_composition(team)
    except scoring_composition.TeamNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
