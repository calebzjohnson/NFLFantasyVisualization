from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_weekly_data(season: int) -> pd.DataFrame:
    """Returns one row per player per week for the given season, from nflverse.

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls for the same season don't re-hit the network.
    """
    weekly_data = nfl.load_player_stats(seasons=[season], summary_level="week")
    return cast(pd.DataFrame, weekly_data.to_pandas())
