from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_season_pfr_defense(season: int) -> pd.DataFrame:
    """Returns one row per defender per game: Pro Football Reference's
    advanced defensive stats (pressures, missed tackles, coverage allowed).
    Keyed by `pfr_player_id`, like snap counts - join through
    snap_counts.get_pfr_to_gsis_map().

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls for the same season don't re-hit the network.
    """
    pfr = nfl.load_pfr_advstats(seasons=[season], stat_type="def", summary_level="week")
    return cast(pd.DataFrame, pfr.to_pandas())
