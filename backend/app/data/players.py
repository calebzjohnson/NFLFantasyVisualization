from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_players() -> pd.DataFrame:
    """Returns nflverse's player registry: one row per player, with bio/roster
    fields (height, weight, birth date, college, draft info, status) rather
    than stats.

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls don't re-hit the network.
    """
    players = nfl.load_players()
    return cast(pd.DataFrame, players.to_pandas())
