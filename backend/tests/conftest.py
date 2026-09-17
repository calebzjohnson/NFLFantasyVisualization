import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def sample_season_stats() -> pd.DataFrame:
    """Small stand-in for player_stats.get_season_stats(season): one row per
    player, season totals. W One's `pacr` is NaN, mirroring nflverse's real
    shape for a rate stat that doesn't apply to a player (a WR who never
    attempted a pass), rather than a placeholder like 0.
    """
    rows = [
        dict(player_id="Q1", player_display_name="Q One", position="QB", team="DAL",
             completions=200, attempts=300, passing_yards=2500, pacr=1.5),
        dict(player_id="W1", player_display_name="W One", position="WR", team="DAL",
             completions=0, attempts=0, passing_yards=0, pacr=np.nan),
    ]
    return pd.DataFrame(rows)
