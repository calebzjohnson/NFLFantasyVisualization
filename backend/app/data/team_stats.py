from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_weekly_team_stats(season: int) -> pd.DataFrame:
    """Returns one row per team per game for the given season, from nflverse.

    Used for net-touchdowns tiebreaker calculations: each team's row has its
    own touchdown totals for that game, and self-joining on game_id against
    the opponent's row gives touchdowns allowed in that same game.

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls for the same season don't re-hit the network.
    """
    team_stats = nfl.load_team_stats(seasons=[season], summary_level="week")
    return cast(pd.DataFrame, team_stats.to_pandas())
