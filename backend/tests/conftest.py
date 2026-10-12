import numpy as np
import pandas as pd
import pytest

from app.cache import clear_caches
from app.rate_limit import limiter
from app.services.extended_stats import PFR_COLUMNS


@pytest.fixture(autouse=True)
def fresh_caches_and_limits() -> None:
    """Tests stub the data loaders differently for the same endpoint, so no
    memoized result or rate-limit count may carry over between tests.
    """
    clear_caches()
    limiter.reset()


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
        dict(gsis_id="Q1", display_name="Q One", position="QB", position_group="QB",
             latest_team="DAL",
             jersey_number="9", height=74.0, weight=225.0, birth_date="1998-05-02",
             college_name="Ohio State", status="ACT", draft_year=2020.0, draft_round=1.0,
             draft_pick=10.0, draft_team="DAL", headshot="https://example.com/q1.png"),
        dict(gsis_id="W1", display_name="W One", position="WR", position_group="WR",
             latest_team="DAL",
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
    different player entirely (to test filtering by player_id and by
    position_group) on the opposing team, NYG. Week 2's `pacr` is NaN,
    mirroring a real game where the rate stat doesn't apply. Pairs with
    sample_week_schedule, where every week here is complete.
    """
    rows = [
        dict(player_id="Q1", player_display_name="Q One", position="QB", position_group="QB",
             team="DAL", week=3, season_type="REG", passing_yards=250, pacr=1.2),
        dict(player_id="Q1", player_display_name="Q One", position="QB", position_group="QB",
             team="DAL", week=1, season_type="REG", passing_yards=300, pacr=1.5),
        dict(player_id="Q1", player_display_name="Q One", position="QB", position_group="QB",
             team="DAL", week=2, season_type="REG", passing_yards=180, pacr=np.nan),
        dict(player_id="Q1", player_display_name="Q One", position="QB", position_group="QB",
             team="DAL", week=19, season_type="POST", passing_yards=400, pacr=2.0),
        dict(player_id="W1", player_display_name="W One", position="WR", position_group="WR",
             team="NYG", week=1, season_type="REG", passing_yards=0, pacr=np.nan),
        dict(player_id="W1", player_display_name="W One", position="WR", position_group="WR",
             team="NYG", week=3, season_type="REG", passing_yards=0, pacr=np.nan),
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def sample_week_schedule() -> pd.DataFrame:
    """Schedule matching sample_week_stats: DAL at NYG in weeks 1-3, so both
    teams have stats in the newest week (3) and it counts as complete.
    """
    return pd.DataFrame(
        [dict(game_type="REG", week=w, away_team="DAL", home_team="NYG") for w in (1, 2, 3)]
    )


@pytest.fixture
def sample_schedule() -> pd.DataFrame:
    """Small stand-in for schedules.get_season_schedule(season): week 1 games
    are complete (have scores), week 2 games haven't been played yet (NaN
    scores) - mirrors nflverse's real shape mid-season. Like real schedule
    rows, each also carries betting lines, weather (the LA dome game's `temp`
    is NaN), and starting QBs, which /scores must not pass through.
    `gameday` values let week 1's last game land on a Monday (2026-09-14)
    and week 2's on the following Monday (2026-09-21), for testing the
    Tuesday/Wednesday default-week cutover.
    """
    rows = [
        dict(game_id="2026_01_DAL_NYG", season=2026, game_type="REG", week=1,
             away_team="DAL", home_team="NYG", away_score=20.0, home_score=28.0, temp=72.0,
             gameday="2026-09-13", weekday="Sunday", gametime="20:20"),
        dict(game_id="2026_01_SF_LA", season=2026, game_type="REG", week=1,
             away_team="SF", home_team="LA", away_score=27.0, home_score=7.0, temp=np.nan,
             gameday="2026-09-14", weekday="Monday", gametime="20:15"),
        dict(game_id="2026_02_DET_BUF", season=2026, game_type="REG", week=2,
             away_team="DET", home_team="BUF", away_score=np.nan, home_score=np.nan, temp=65.0,
             gameday="2026-09-21", weekday="Monday", gametime="20:15"),
    ]
    return pd.DataFrame(rows).assign(
        spread_line=3.5, away_moneyline=150, home_moneyline=-170, total_line=47.5,
        under_odds=-110, over_odds=-110, wind=8.0, roof="outdoors",
        away_qb_name="Away QB", home_qb_name="Home QB", referee="Ref",
    )


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
            "game_id", "week", "team", "opponent_team", "passing_tds", "rushing_tds",
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


@pytest.fixture
def depth_chart_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stubs the three loaders behind /teams/{team}/depth-chart for DAL, which
    runs a 4-3. Two snapshots exist so the newest-`dt` filter is exercised: the
    older one lists a since-departed backup QB who must not appear.

    Statuses are set up to pin every rule: Q2 is on reserve *and* carries a
    Questionable designation (reserve must win), W1 is Questionable only, T1 is
    on reserve while still listed 2nd at tight end (ranks stay faithful), and X9
    is on the report having dropped off the chart entirely. P1 (R04) and S1
    (R40) are the two reserve codes that resolve to something more specific
    than "Reserve". T1 was reported hurt in week 2 before going on reserve, so
    his cause comes from the lookback rather than the current week.
    """
    charts = pd.DataFrame(
        [
            dict(dt="2026-10-01", team="DAL", pos_grp="3WR 1TE", pos_slot=9, pos_abb="QB",
                 pos_name="Quarterback", pos_rank=2, gsis_id="QGone", player_name="Q Gone"),
            dict(dt="2026-10-02", team="DAL", pos_grp="3WR 1TE", pos_slot=9, pos_abb="QB",
                 pos_name="Quarterback", pos_rank=1, gsis_id="Q1", player_name="Q One"),
            dict(dt="2026-10-02", team="DAL", pos_grp="3WR 1TE", pos_slot=9, pos_abb="QB",
                 pos_name="Quarterback", pos_rank=2, gsis_id="Q2", player_name="Q Two"),
            dict(dt="2026-10-02", team="DAL", pos_grp="3WR 1TE", pos_slot=1, pos_abb="WR",
                 pos_name="Wide Receiver", pos_rank=1, gsis_id="W1", player_name="W One"),
            dict(dt="2026-10-02", team="DAL", pos_grp="3WR 1TE", pos_slot=10, pos_abb="TE",
                 pos_name="Tight End", pos_rank=2, gsis_id="T1", player_name="T One"),
            dict(dt="2026-10-02", team="DAL", pos_grp="Base 4-3 D", pos_slot=1, pos_abb="LDE",
                 pos_name="Left Defensive End", pos_rank=1, gsis_id="D1", player_name="D One"),
            dict(dt="2026-10-02", team="DAL", pos_grp="Special Teams", pos_slot=1, pos_abb="PK",
                 pos_name="Place Kicker", pos_rank=1, gsis_id="K1", player_name="K One"),
            dict(dt="2026-10-02", team="NYG", pos_grp="3WR 1TE", pos_slot=9, pos_abb="QB",
                 pos_name="Quarterback", pos_rank=1, gsis_id="Q9", player_name="Q Nine"),
        ]
    )
    rosters = pd.DataFrame(
        [
            dict(gsis_id="Q1", team="DAL", status="ACT", full_name="Q One", position="QB",
                 status_description_abbr="A01"),
            dict(gsis_id="Q2", team="DAL", status="RES", full_name="Q Two", position="QB",
                 status_description_abbr="R01"),
            dict(gsis_id="T1", team="DAL", status="RES", full_name="T One", position="TE",
                 status_description_abbr="R48"),
            dict(gsis_id="W1", team="DAL", status="ACT", full_name="W One", position="WR",
                 status_description_abbr="A01"),
            dict(gsis_id="P1", team="DAL", status="RES", full_name="P One", position="DT",
                 status_description_abbr="R04"),
            dict(gsis_id="S1", team="DAL", status="RES", full_name="S One", position="LB",
                 status_description_abbr="R40"),
            dict(gsis_id="E1", team="DAL", status="EXE", full_name="E One", position="RB",
                 status_description_abbr="E02"),
            dict(gsis_id="N1", team="DAL", status="INA", full_name="N One", position="WR",
                 status_description_abbr="A01"),
        ]
    )
    injuries = pd.DataFrame(
        [
            dict(gsis_id="W1", team="DAL", week=2, report_status="Out",
                 report_primary_injury="Hamstring", practice_status="Did Not Participate",
                 full_name="W One", position="WR"),
            dict(gsis_id="W1", team="DAL", week=3, report_status="Questionable",
                 report_primary_injury="Knee", practice_status="Limited Participation",
                 full_name="W One", position="WR"),
            dict(gsis_id="Q2", team="DAL", week=3, report_status="Questionable",
                 report_primary_injury="Shoulder", practice_status=None,
                 full_name="Q Two", position="QB"),
            dict(gsis_id="D1", team="DAL", week=3, report_status=None,
                 report_primary_injury=None, practice_status="Full Participation",
                 full_name="D One", position="DE"),
            dict(gsis_id="X9", team="DAL", week=3, report_status="Out",
                 report_primary_injury="Ankle", practice_status="Did Not Participate",
                 full_name="X Nine", position="CB"),
            dict(gsis_id="T1", team="DAL", week=2, report_status="Out",
                 report_primary_injury="Achilles", practice_status="Did Not Participate",
                 full_name="T One", position="TE"),
        ]
    )
    monkeypatch.setattr("app.services.depth_chart.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.depth_charts.get_latest_depth_chart",
                        lambda season: charts[charts["dt"] == charts["dt"].max()])
    monkeypatch.setattr("app.data.rosters.get_season_rosters", lambda season: rosters)
    monkeypatch.setattr("app.data.injuries.get_season_injuries", lambda season: injuries)


@pytest.fixture
def week_snaps(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stubs the snap-count sources /players/weekly now merges for every
    position group: Q1 (PFR id "QOne") plays every snap of DAL's weeks 1-2
    but only a quarter of week 3's - an injury exit.
    """
    snaps = pd.DataFrame(
        [
            dict(pfr_player_id="QOne", week=week, team="DAL", opponent="NYG",
                 offense_snaps=snaps, offense_pct=snaps / 60)
            for week, snaps in ((1, 60), (2, 60), (3, 15))
        ]
    ).assign(game_type="REG", defense_snaps=0, defense_pct=0.0, st_snaps=0)
    monkeypatch.setattr("app.data.snap_counts.get_season_snap_counts", lambda season: snaps)
    monkeypatch.setattr(
        "app.data.snap_counts.get_pfr_to_gsis_map", lambda: pd.Series({"QOne": "Q1"})
    )
    monkeypatch.setattr(
        "app.data.pfr_defense.get_season_pfr_defense",
        lambda season: pd.DataFrame(columns=["pfr_player_id", "game_type", "week", *PFR_COLUMNS]),
    )
