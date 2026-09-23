from typing import Literal, cast

import nflreadpy as nfl
import pandas as pd

StatType = Literal["passing", "rushing", "receiving"]


def get_season_nextgen_stats(season: int, stat_type: StatType) -> pd.DataFrame:
    """Returns one row per player: season-to-date Next Gen Stats totals.

    Week 0 in nflverse's Next Gen Stats data is the season-to-date row (its
    counting stats equal the sum of that player's individual weeks - verified
    against the weekly rows directly, since this isn't documented in the data
    dictionary), so no manual aggregation across weeks is needed.
    """
    data = nfl.load_nextgen_stats(seasons=[season], stat_type=stat_type)
    season_totals = data.filter(data["week"] == 0)
    return cast(pd.DataFrame, season_totals.to_pandas())
