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
        dict(player_id="Q1", player_display_name="Q One", position="QB", position_group="QB",
             team="DAL", completions=200, attempts=300, passing_yards=2500, pacr=1.5),
        dict(player_id="W1", player_display_name="W One", position="WR", position_group="WR",
             team="DAL", completions=0, attempts=0, passing_yards=0, pacr=np.nan),
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def sample_players_roster() -> pd.DataFrame:
    """Small stand-in for players.get_players(): one drafted player with a
    mapped status code, and one undrafted player with an unmapped status code
    (to test the fallback to the raw code) and NaN draft fields.
    """
    rows = [
        dict(gsis_id="Q1", display_name="Q One", position="QB", latest_team="DAL",
             jersey_number="9", height=74.0, weight=225.0, birth_date="1998-05-02",
             college_name="Ohio State", status="ACT", draft_year=2020.0, draft_round=1.0,
             draft_pick=10.0, draft_team="DAL", headshot="https://example.com/q1.png"),
        dict(gsis_id="W1", display_name="W One", position="WR", latest_team="DAL",
             jersey_number="80", height=72.0, weight=195.0, birth_date="1999-08-14",
             college_name="Alabama", status="XYZ", draft_year=np.nan, draft_round=np.nan,
             draft_pick=np.nan, draft_team=np.nan, headshot="https://example.com/w1.png"),
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def sample_week_stats() -> pd.DataFrame:
    """Small stand-in for player_stats.get_week_stats(season): one row per
    player per game. Q1 has three REG games (out of order, to test sorting)
    plus one POST game (to test regular-season filtering), and W1 is a
    different player entirely (to test filtering by player_id). Week 2's
    `pacr` is NaN, mirroring a real game where the rate stat doesn't apply.
    """
    rows = [
        dict(player_id="Q1", player_display_name="Q One", position="QB", week=3,
             season_type="REG", passing_yards=250, pacr=1.2),
        dict(player_id="Q1", player_display_name="Q One", position="QB", week=1,
             season_type="REG", passing_yards=300, pacr=1.5),
        dict(player_id="Q1", player_display_name="Q One", position="QB", week=2,
             season_type="REG", passing_yards=180, pacr=np.nan),
        dict(player_id="Q1", player_display_name="Q One", position="QB", week=19,
             season_type="POST", passing_yards=400, pacr=2.0),
        dict(player_id="W1", player_display_name="W One", position="WR", week=1,
             season_type="REG", passing_yards=0, pacr=np.nan),
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def sample_schedule() -> pd.DataFrame:
    """Small stand-in for schedules.get_season_schedule(season): week 1 games
    are complete (have scores), week 2 games haven't been played yet (NaN
    scores) - mirrors nflverse's real shape mid-season. The LA game's `temp`
    is NaN (a dome game), like real weather data for indoor stadiums.
    `gameday` values let week 1's last game land on a Monday (2026-09-14)
    and week 2's on the following Monday (2026-09-21), for testing the
    Tuesday/Wednesday default-week cutover.
    """
    rows = [
        dict(game_id="2026_01_DAL_NYG", season=2026, game_type="REG", week=1,
             away_team="DAL", home_team="NYG", away_score=20.0, home_score=28.0, temp=72.0,
             gameday="2026-09-13"),
        dict(game_id="2026_01_SF_LA", season=2026, game_type="REG", week=1,
             away_team="SF", home_team="LA", away_score=27.0, home_score=7.0, temp=np.nan,
             gameday="2026-09-14"),
        dict(game_id="2026_02_DET_BUF", season=2026, game_type="REG", week=2,
             away_team="DET", home_team="BUF", away_score=np.nan, home_score=np.nan, temp=65.0,
             gameday="2026-09-21"),
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def sample_teams() -> pd.DataFrame:
    """Small stand-in for teams.get_teams(): two divisions' worth of teams,
    plus a retired franchise code (OAK) that never appears in
    sample_standings_schedule - mirrors how get_teams() includes historical
    codes indistinguishable from current ones except by schedule presence.
    """
    rows = [
        dict(team_abbr="BUF", team_name="Buffalo Bills", team_conf="AFC",
             team_division="AFC East"),
        dict(team_abbr="MIA", team_name="Miami Dolphins", team_conf="AFC",
             team_division="AFC East"),
        dict(team_abbr="NE", team_name="New England Patriots", team_conf="AFC",
             team_division="AFC East"),
        dict(team_abbr="NYJ", team_name="New York Jets", team_conf="AFC",
             team_division="AFC East"),
        dict(team_abbr="DAL", team_name="Dallas Cowboys", team_conf="NFC",
             team_division="NFC East"),
        dict(team_abbr="NYG", team_name="New York Giants", team_conf="NFC",
             team_division="NFC East"),
        dict(team_abbr="PHI", team_name="Philadelphia Eagles", team_conf="NFC",
             team_division="NFC East"),
        dict(team_abbr="WAS", team_name="Washington Commanders", team_conf="NFC",
             team_division="NFC East"),
        dict(team_abbr="OAK", team_name="Oakland Raiders", team_conf="AFC",
             team_division="AFC West"),
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


@pytest.fixture
def sample_pbp() -> pd.DataFrame:
    """Small stand-in for pbp.get_season_pbp(season). A's two offensive
    plays (1.0, -0.5) average to 0.25; B's two plays against A (0.2, 0.4)
    average to 0.3 - so A's defensive number should also be 0.3, and B's
    offensive number 0.3 / defensive number 0.25, symmetrically. A punt (not
    pass/run), a postseason play, and a null-EPA play (e.g. a no-play/penalty)
    are included specifically to confirm they're excluded.
    """
    rows = [
        dict(season_type="REG", play_type="pass", epa=1.0, posteam="A", defteam="B"),
        dict(season_type="REG", play_type="run", epa=-0.5, posteam="A", defteam="B"),
        dict(season_type="REG", play_type="pass", epa=0.2, posteam="B", defteam="A"),
        dict(season_type="REG", play_type="pass", epa=0.4, posteam="B", defteam="A"),
        dict(season_type="REG", play_type="punt", epa=-2.0, posteam="B", defteam="A"),
        dict(season_type="POST", play_type="pass", epa=5.0, posteam="A", defteam="B"),
        dict(season_type="REG", play_type="pass", epa=np.nan, posteam="A", defteam="B"),
    ]
    return pd.DataFrame(rows)
