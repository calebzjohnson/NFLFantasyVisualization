from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.rate_limit import heavy_limit
from app.services import matchups

router = APIRouter(tags=["matchups"])


@router.get("/matchups/{game_id}")
@heavy_limit
def get_matchup(request: Request, game_id: str) -> dict[str, Any]:
    try:
        return matchups.get_matchup(game_id)
    except matchups.GameNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
