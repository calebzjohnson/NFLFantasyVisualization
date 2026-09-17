from typing import Any, cast

import nflreadpy as nfl

from app.data import schedules


def get_last_completed_week_scores() -> list[dict[str, Any]]:
    season = nfl.get_current_season()
    played = schedules.get_played_games(season)
    if played.empty:
        season -= 1
        played = schedules.get_played_games(season)

    last_week = played["week"].max()
    games = played[played["week"] == last_week]

    records = games.astype(object).where(games.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)
