from typing import Any, cast

import nflreadpy as nfl

from app.data import pbp as pbp_data

REGULAR_SEASON = "REG"
SCRIMMAGE_PLAYS = {"pass", "run"}


def get_current_team_efficiency() -> list[dict[str, Any]]:
    """Offensive and defensive EPA per play for every team in the current
    season, computed directly from play-by-play data (not garbage-time
    filtered or opponent-adjusted - a plain mean of EPA on every pass/run
    play, which is what "EPA per play" commonly refers to without further
    qualification).
    """
    season = nfl.get_current_season()
    plays = pbp_data.get_season_pbp(season)
    if plays.empty:
        season -= 1
        plays = pbp_data.get_season_pbp(season)

    clean = plays[
        (plays["season_type"] == REGULAR_SEASON)
        & plays["play_type"].isin(SCRIMMAGE_PLAYS)
        & plays["epa"].notna()
    ]

    offense = clean.groupby("posteam")["epa"].agg(
        offensive_epa_per_play="mean", offensive_plays="count"
    )
    defense = clean.groupby("defteam")["epa"].agg(
        defensive_epa_per_play="mean", defensive_plays="count"
    )

    combined = offense.join(defense, how="outer").reset_index(names="team")
    records = combined.astype(object).where(combined.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)
