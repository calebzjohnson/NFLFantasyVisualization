from typing import Any

from fastapi import APIRouter

from app.services import players

router = APIRouter(tags=["players"])


@router.get("/players")
def get_players() -> list[dict[str, Any]]:
    return players.get_current_player_stats()
