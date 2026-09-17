from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services import players

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
