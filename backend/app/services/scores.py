from typing import Any, cast

import nflreadpy as nfl
import pandas as pd

from app.data import schedules

REGULAR_SEASON = "REG"


def get_last_completed_week_scores() -> list[dict[str, Any]]:
    season = nfl.get_current_season()
    played = _played_games(season)
    if played.empty:
        season -= 1
        played = _played_games(season)

    last_week = played["week"].max()
    games = played[played["week"] == last_week]

    records = games.astype(object).where(games.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)


def _played_games(season: int) -> pd.DataFrame:
    schedule = schedules.get_season_schedule(season)
    return schedule[(schedule["game_type"] == REGULAR_SEASON) & schedule["home_score"].notna()]
