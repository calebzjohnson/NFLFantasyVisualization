from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_season_stats(season: int) -> pd.DataFrame:
    """Returns one row per player: season-to-date totals for the given season.

    Uses nflverse's own season aggregation (summary_level="reg"), not a naive
    sum across weekly rows, so rate/efficiency stats (completion %, EPA, CPOE,
    etc.) are correctly computed rather than nonsensically summed.

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls for the same season don't re-hit the network.
    """
    season_data = nfl.load_player_stats(seasons=[season], summary_level="reg")
    return cast(pd.DataFrame, season_data.to_pandas())
