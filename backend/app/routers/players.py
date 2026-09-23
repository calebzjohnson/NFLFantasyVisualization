from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services import players, radar

router = APIRouter(tags=["players"])


@router.get("/players")
def get_players(
    sort: str | None = Query(
        None, description="Field to sort by; prefix with - for descending, e.g. -passing_yards"
    ),
    limit: int | None = Query(None, gt=0),
    fields: str | None = Query(None, description="Comma-separated column names to include"),
    position_group: str | None = Query(None),
) -> list[dict[str, Any]]:
    field_list = fields.split(",") if fields else None
    try:
        return players.get_current_player_stats(
            sort=sort, limit=limit, fields=field_list, position_group=position_group
        )
    except players.InvalidQueryError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/players/weekly")
def get_weekly_players(
    fields: str | None = Query(None, description="Comma-separated column names to include"),
    position_group: str | None = Query(None),
) -> list[dict[str, Any]]:
    field_list = fields.split(",") if fields else None
    try:
        return players.get_weekly_player_stats(position_group=position_group, fields=field_list)
    except players.InvalidQueryError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/players/{player_id}/games")
def get_player_games(player_id: str) -> list[dict[str, Any]]:
    try:
        return players.get_player_game_log(player_id)
    except players.PlayerNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/players/{player_id}/bio")
def get_player_bio(player_id: str) -> dict[str, Any]:
    try:
        return players.get_player_bio(player_id)
    except players.PlayerNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/players/{player_id}/usage")
def get_player_usage(player_id: str) -> dict[str, Any]:
    try:
        return players.get_player_usage_share(player_id)
    except players.PlayerNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/players/{player_id}/radar")
def get_player_radar(player_id: str) -> dict[str, Any]:
    try:
        return radar.get_player_radar(player_id)
    except players.PlayerNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/players/radar-pool")
def get_players_radar_pool(position: str = Query(...)) -> dict[str, Any]:
    try:
        return radar.get_position_radar_pool(position)
    except radar.InvalidPositionError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
