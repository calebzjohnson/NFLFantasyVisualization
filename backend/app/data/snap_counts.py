from typing import cast

import nflreadpy as nfl
import pandas as pd


def get_season_snap_counts(season: int) -> pd.DataFrame:
    """Returns one row per player per game played, with offensive/defensive/
    special-teams snap counts and percentages. Sourced from Pro Football
    Reference, keyed by `pfr_player_id` - not the `gsis_id` used everywhere
    else in this app, so callers need `get_player_id_crosswalk()` to join it
    to anything else.
    """
    snaps = nfl.load_snap_counts(seasons=[season])
    return cast(pd.DataFrame, snaps.to_pandas())


def get_player_id_crosswalk() -> pd.DataFrame:
    """Maps player identifiers across data providers (gsis_id, pfr_id, ...).
    Not season-scoped - this is a standing identity table, not a stats table.
    """
    ids = nfl.load_ff_playerids()
    return cast(pd.DataFrame, ids.to_pandas())
