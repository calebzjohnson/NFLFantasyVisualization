from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_teams() -> pd.DataFrame:
    """Returns nflverse's team registry (abbreviation, conference, division).

    Includes historical/relocated franchise codes (e.g. OAK, SD, STL)
    alongside current ones; callers should join against a season's actual
    data rather than assuming every row here is a currently active team.
    """
    teams = nfl.load_teams()
    return cast(pd.DataFrame, teams.to_pandas())
