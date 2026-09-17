from typing import Any, cast

import nflreadpy as nfl

from app.data import player_stats


def get_current_player_stats() -> list[dict[str, Any]]:
    season = nfl.get_current_season()
    stats = player_stats.get_season_stats(season)
    if stats.empty:
        stats = player_stats.get_season_stats(season - 1)

    # NaN isn't valid JSON; convert missing values (e.g. a WR's passer rating)
    # to None so they serialize as null instead of breaking the response.
    records = stats.astype(object).where(stats.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)
