from typing import cast

import nflreadpy as nfl
import pandas as pd

from app.cache import single_flight


@single_flight
def get_season_rosters(season: int) -> pd.DataFrame:
    """Returns one row per player per team for the season, keyed by `gsis_id`.
    Read here for `status`, whose "RES" (reserve/injured) value is the only
    signal that a player listed on a depth chart is out indefinitely - the
    weekly injury report covers barely a tenth of them.

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls for the same season don't re-hit the network.
    """
    return cast(pd.DataFrame, nfl.load_rosters(seasons=[season]).to_pandas())
