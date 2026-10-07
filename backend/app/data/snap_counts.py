from typing import cast

import nflreadpy as nfl
import pandas as pd

from app.cache import single_flight
from app.data import players


@single_flight
def get_season_snap_counts(season: int) -> pd.DataFrame:
    """Returns one row per player per game played, with offensive/defensive/
    special-teams snap counts and percentages. Sourced from Pro Football
    Reference, keyed by `pfr_player_id` - not the `gsis_id` used everywhere
    else in this app, so callers need `get_pfr_to_gsis_map()` to join it
    to anything else.
    """
    snaps = nfl.load_snap_counts(seasons=[season])
    return cast(pd.DataFrame, snaps.to_pandas())


def get_pfr_to_gsis_map() -> "pd.Series[str]":
    """pfr_id -> gsis_id, for joining PFR-keyed data (like snap counts) onto
    the gsis_id used everywhere else in this app.

    From nflverse's player registry rather than the ffverse ID crosswalk
    (load_ff_playerids) - that one only tracks fantasy-relevant players, so
    it has no offensive linemen at all.
    """
    roster = players.get_players()
    return cast(
        "pd.Series[str]",
        roster.dropna(subset=["pfr_id", "gsis_id"])
        .drop_duplicates(subset=["pfr_id"], keep="first")
        .set_index("pfr_id")["gsis_id"],
    )
