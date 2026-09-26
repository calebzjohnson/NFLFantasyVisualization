import numpy as np
import pandas as pd
import pytest

from app.services.team_radar import (
    TEAM_RADAR_AXES,
    TeamNotFoundError,
    get_team_radar,
    get_team_radar_pool,
)


@pytest.fixture
def sample_team_radar_pbp() -> pd.DataFrame:
    """Two teams (A, B) with enough plays/drives to exercise every axis.

    Offense: A passes twice (1.0, -0.5 -> mean 0.25) and rushes once (0.5).
    B passes twice against A (0.2, 0.4 -> mean 0.3, so A's def_pass_epa
    should be -0.3) and rushes once against A (-1.0, so A's def_rush_epa
    should be 1.0).

    Special teams: A has a punt (-0.4) and a field goal (1.2) -> summed to
    0.8. The field goal is deliberately NOT flagged by a special_teams_play
    column (there isn't one in this fixture at all) - play_type alone must
    be enough to capture it, since nflverse's own flag misses field goals.

    Red zone drives for A: drive 1 reaches the red zone (yardline_100=15)
    and scores (fixed_drive_result="Touchdown"); drive 2 reaches the red
    zone (yardline_100=10) but doesn't score ("Field goal"); drive 3 never
    gets inside the 20 (yardline_100=45) even though it also scores - it
    must be excluded from the red zone rate entirely, not counted as a
    non-scoring red zone drive. So A's off_redzone_td_pct = 1/2 = 50%.

    A postseason play and a null-EPA play are included to confirm both are
    excluded from every mean/sum.
    """
    rows = [
        # A's offense
        dict(game_id="G1", season_type="REG", play_type="pass", pass_=1, rush=0, epa=1.0,
             posteam="A", defteam="B", fixed_drive=1.0, yardline_100=60.0,
             fixed_drive_result="Touchdown"),
        dict(game_id="G1", season_type="REG", play_type="pass", pass_=1, rush=0, epa=-0.5,
             posteam="A", defteam="B", fixed_drive=1.0, yardline_100=15.0,
             fixed_drive_result="Touchdown"),
        dict(game_id="G1", season_type="REG", play_type="run", pass_=0, rush=1, epa=0.5,
             posteam="A", defteam="B", fixed_drive=2.0, yardline_100=10.0,
             fixed_drive_result="Field goal"),
        dict(game_id="G1", season_type="REG", play_type="run", pass_=0, rush=1, epa=0.9,
             posteam="A", defteam="B", fixed_drive=3.0, yardline_100=45.0,
             fixed_drive_result="Touchdown"),
        # A's special teams
        dict(game_id="G1", season_type="REG", play_type="punt", pass_=0, rush=0, epa=-0.4,
             posteam="A", defteam="B", fixed_drive=np.nan, yardline_100=np.nan,
             fixed_drive_result=np.nan),
        dict(game_id="G1", season_type="REG", play_type="field_goal", pass_=0, rush=0, epa=1.2,
             posteam="A", defteam="B", fixed_drive=np.nan, yardline_100=np.nan,
             fixed_drive_result=np.nan),
        # B's offense (also A's defense)
        dict(game_id="G1", season_type="REG", play_type="pass", pass_=1, rush=0, epa=0.2,
             posteam="B", defteam="A", fixed_drive=4.0, yardline_100=70.0,
             fixed_drive_result="Punt"),
        dict(game_id="G1", season_type="REG", play_type="pass", pass_=1, rush=0, epa=0.4,
             posteam="B", defteam="A", fixed_drive=4.0, yardline_100=55.0,
             fixed_drive_result="Punt"),
        dict(game_id="G1", season_type="REG", play_type="run", pass_=0, rush=1, epa=-1.0,
             posteam="B", defteam="A", fixed_drive=5.0, yardline_100=50.0,
             fixed_drive_result="Opp touchdown"),
        # Excluded: postseason and null-EPA plays
        dict(game_id="G2", season_type="POST", play_type="pass", pass_=1, rush=0, epa=9.0,
             posteam="A", defteam="B", fixed_drive=1.0, yardline_100=50.0,
             fixed_drive_result="Touchdown"),
        dict(game_id="G1", season_type="REG", play_type="pass", pass_=1, rush=0, epa=np.nan,
             posteam="A", defteam="B", fixed_drive=6.0, yardline_100=50.0,
             fixed_drive_result="Turnover"),
    ]
    df = pd.DataFrame(rows).rename(columns={"pass_": "pass"})
    return df


def test_get_team_radar_computes_all_six_axes(
    monkeypatch: pytest.MonkeyPatch, sample_team_radar_pbp: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.team_radar.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_team_radar_pbp)

    result = get_team_radar("A")
    values = {axis["key"]: axis["value"] for axis in result["axes"]}

    assert values["off_pass_epa"] == pytest.approx(0.25)
    assert values["off_rush_epa"] == pytest.approx(0.7)
    assert values["off_redzone_td_pct"] == pytest.approx(50.0)
    assert values["def_pass_epa"] == pytest.approx(-0.3)
    assert values["def_rush_epa"] == pytest.approx(1.0)
    assert values["special_teams_epa"] == pytest.approx(0.8)

    keys = [axis["key"] for axis in result["axes"]]
    assert keys == [key for key, _ in TEAM_RADAR_AXES]


def test_get_team_radar_percentile_reflects_inverted_defense(
    monkeypatch: pytest.MonkeyPatch, sample_team_radar_pbp: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.team_radar.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_team_radar_pbp)

    # A's raw def_pass_epa is -0.3 (allows B's pass offense to average 0.3
    # EPA/play, negated); B's is -0.25 (allows A's 0.25 EPA/play, negated).
    # -0.25 > -0.3, so B has the better pass defense here and should rank
    # above A - if the inversion were missing or backwards, A (the team that
    # actually allows *more* EPA per pass play) would wrongly outrank B.
    a_percentiles = {axis["key"]: axis["percentile"] for axis in get_team_radar("A")["axes"]}
    b_percentiles = {axis["key"]: axis["percentile"] for axis in get_team_radar("B")["axes"]}

    assert a_percentiles["def_pass_epa"] == pytest.approx(50.0)
    assert b_percentiles["def_pass_epa"] == pytest.approx(100.0)


def test_get_team_radar_raises_for_unknown_team(
    monkeypatch: pytest.MonkeyPatch, sample_team_radar_pbp: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.team_radar.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_team_radar_pbp)

    with pytest.raises(TeamNotFoundError):
        get_team_radar("ZZ")


def test_get_team_radar_pool_includes_every_team(
    monkeypatch: pytest.MonkeyPatch, sample_team_radar_pbp: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.team_radar.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_team_radar_pbp)

    pool = get_team_radar_pool()

    teams = {t["team"] for t in pool["teams"]}
    assert teams == {"A", "B"}
    assert [axis["key"] for axis in pool["axes"]] == [key for key, _ in TEAM_RADAR_AXES]
