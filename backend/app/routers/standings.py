from typing import Any

from fastapi import APIRouter

from app.services import standings

router = APIRouter(tags=["standings"])


@router.get("/standings")
def get_standings() -> list[dict[str, Any]]:
    return standings.get_current_standings()
