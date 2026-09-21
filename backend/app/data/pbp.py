from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_season_pbp(season: int) -> pd.DataFrame:
    """Returns one row per play for the given season, from nflverse.

    This is a much larger dataset than the other wrappers here (tens of
    thousands of rows, ~370 columns for a full season) - nflreadpy caches it
    in memory (24h by default) so repeated calls don't re-fetch, but the
    first fetch/cache of a season is noticeably heavier than e.g. weekly
    player or team stats.
    """
    pbp = nfl.load_pbp(seasons=[season])
    return cast(pd.DataFrame, pbp.to_pandas())
