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


@pytest.fixture
def sample_teams() -> pd.DataFrame:
    """Small stand-in for teams.get_teams(): two divisions' worth of teams."""
    rows = [
        dict(team_abbr="BUF", team_conf="AFC", team_division="AFC East"),
        dict(team_abbr="MIA", team_conf="AFC", team_division="AFC East"),
        dict(team_abbr="NE", team_conf="AFC", team_division="AFC East"),
        dict(team_abbr="NYJ", team_conf="AFC", team_division="AFC East"),
        dict(team_abbr="DAL", team_conf="NFC", team_division="NFC East"),
        dict(team_abbr="NYG", team_conf="NFC", team_division="NFC East"),
        dict(team_abbr="PHI", team_conf="NFC", team_division="NFC East"),
        dict(team_abbr="WAS", team_conf="NFC", team_division="NFC East"),
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def sample_standings_schedule() -> pd.DataFrame:
    """Small stand-in for schedules.get_season_schedule(season), covering:
    a normal win/loss (BUF beats MIA), a tie (NE/NYJ), a team with two games
    to test aggregation (BUF also beats NE), and a second division (NFC
    East) to test division grouping.
    """
    rows = [
        dict(game_type="REG", week=1, away_team="MIA", home_team="BUF",
             away_score=10.0, home_score=24.0),
        dict(game_type="REG", week=1, away_team="NYJ", home_team="NE",
             away_score=17.0, home_score=17.0),
        dict(game_type="REG", week=2, away_team="NE", home_team="BUF",
             away_score=15.0, home_score=20.0),
        dict(game_type="REG", week=1, away_team="NYG", home_team="DAL",
             away_score=20.0, home_score=28.0),
        dict(game_type="REG", week=1, away_team="WAS", home_team="PHI",
             away_score=10.0, home_score=30.0),
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def sample_weekly_team_stats() -> pd.DataFrame:
    """Small stand-in for team_stats.get_weekly_team_stats(season). Empty is
    fine for scenarios that never reach the net-touchdowns tiebreaker step;
    it still needs the right columns so net_touchdowns() doesn't KeyError.
    """
    return pd.DataFrame(
        columns=[
            "game_id", "team", "opponent_team", "passing_tds", "rushing_tds",
            "special_teams_tds", "def_tds", "fumble_recovery_tds", "pt_return_tds",
        ]
    )
