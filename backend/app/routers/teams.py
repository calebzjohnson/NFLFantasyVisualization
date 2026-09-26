from typing import Any

from fastapi import APIRouter, HTTPException

from app.services import team_efficiency, team_radar, teams

router = APIRouter(tags=["teams"])


@router.get("/teams")
def get_teams() -> list[dict[str, Any]]:
    return teams.get_current_teams()


@router.get("/teams/efficiency")
def get_team_efficiency() -> list[dict[str, Any]]:
    return team_efficiency.get_current_team_efficiency()


@router.get("/teams/weekly")
def get_team_game_stats() -> list[dict[str, Any]]:
    return teams.get_team_game_stats()


@router.get("/teams/radar-pool")
def get_teams_radar_pool() -> dict[str, Any]:
    return team_radar.get_team_radar_pool()


@router.get("/teams/{team}/radar")
def get_team_radar(team: str) -> dict[str, Any]:
    try:
        return team_radar.get_team_radar(team)
    except team_radar.TeamNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
