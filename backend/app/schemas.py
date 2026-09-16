from pydantic import BaseModel


class LeaderRow(BaseModel):
    rank: int
    player: str
    team: str
    value: float


class LeaderCategory(BaseModel):
    position: str
    metric: str
    unit: str
    rows: list[LeaderRow]
