from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_season_schedule(season: int) -> pd.DataFrame:
    """Returns one row per game for the given season, from nflverse.

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls for the same season don't re-hit the network.
    """
    schedule = nfl.load_schedules(seasons=[season])
    return cast(pd.DataFrame, schedule.to_pandas())
