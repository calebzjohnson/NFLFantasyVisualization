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


@pytest.fixture
def sample_schedule() -> pd.DataFrame:
    """Small stand-in for schedules.get_season_schedule(season): week 1 games
    are complete (have scores), week 2 games haven't been played yet (NaN
    scores) - mirrors nflverse's real shape mid-season. The LA game's `temp`
    is NaN (a dome game), like real weather data for indoor stadiums.
    """
    rows = [
        dict(game_id="2026_01_DAL_NYG", season=2026, game_type="REG", week=1,
             away_team="DAL", home_team="NYG", away_score=20.0, home_score=28.0, temp=72.0),
        dict(game_id="2026_01_SF_LA", season=2026, game_type="REG", week=1,
             away_team="SF", home_team="LA", away_score=27.0, home_score=7.0, temp=np.nan),
        dict(game_id="2026_02_DET_BUF", season=2026, game_type="REG", week=2,
             away_team="DET", home_team="BUF", away_score=np.nan, home_score=np.nan, temp=65.0),
    ]
    return pd.DataFrame(rows)
