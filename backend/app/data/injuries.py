from typing import cast

import nflreadpy as nfl
import pandas as pd

from app.cache import single_flight


@single_flight
def get_season_injuries(season: int) -> pd.DataFrame:
    """Returns one row per player per week's injury report, keyed by `gsis_id`:
    the game designation (`report_status` - Out / Doubtful / Questionable) plus
    practice participation and the injury itself.

    Only players with a designation carry a `report_status`; the rest appear
    with practice detail alone. Players on reserve are mostly absent, so a
    team's full availability picture also needs rosters.get_season_rosters().

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls for the same season don't re-hit the network.
    """
    return cast(pd.DataFrame, nfl.load_injuries(seasons=[season]).to_pandas())
