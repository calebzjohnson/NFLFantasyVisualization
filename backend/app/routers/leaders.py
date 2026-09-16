from fastapi import APIRouter

from app.schemas import LeaderCategory
from app.services import leaders

router = APIRouter(tags=["leaders"])


@router.get("/leaders", response_model=list[LeaderCategory])
def get_leaders() -> list[LeaderCategory]:
    return leaders.get_current_leaders()
