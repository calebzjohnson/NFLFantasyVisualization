import pandas as pd
import pytest

from app.services.teams import ALLOWED_COLUMNS, OWN_COLUMNS, get_current_teams, get_team_game_stats


def test_get_current_teams_excludes_historical_codes(
    monkeypatch: pytest.MonkeyPatch,
    sample_teams: pd.DataFrame,
    sample_standings_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.teams.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )

    teams = get_current_teams()

    codes = {t["team_abbr"] for t in teams}
    assert "OAK" not in codes  # in the registry, but never plays in this fixture's schedule
    assert codes == {"BUF", "MIA", "NE", "NYJ", "DAL", "NYG", "PHI", "WAS"}


def test_get_current_teams_includes_full_names(
    monkeypatch: pytest.MonkeyPatch,
    sample_teams: pd.DataFrame,
    sample_standings_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.teams.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )

    teams = get_current_teams()
    buf = next(t for t in teams if t["team_abbr"] == "BUF")

    assert buf["team_name"] == "Buffalo Bills"


def test_get_current_teams_falls_back_when_schedule_not_published_yet(
    monkeypatch: pytest.MonkeyPatch,
    sample_teams: pd.DataFrame,
    sample_standings_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.teams.nfl.get_current_season", lambda: 2027)

    def fake_get_season_schedule(season: int) -> pd.DataFrame:
        if season == 2027:
            return pd.DataFrame(columns=sample_standings_schedule.columns)
        return sample_standings_schedule

    monkeypatch.setattr("app.data.schedules.get_season_schedule", fake_get_season_schedule)
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)

    teams = get_current_teams()

    assert {t["team_abbr"] for t in teams} == {
        "BUF",
        "MIA",
        "NE",
        "NYJ",
        "DAL",
        "NYG",
        "PHI",
        "WAS",
    }


def test_get_team_game_stats_pairs_each_team_with_its_opponent_and_score(
    monkeypatch: pytest.MonkeyPatch, sample_standings_schedule: pd.DataFrame
) -> None:
    def row(team: str, opponent: str, season_type: str, passing_yards: int) -> dict[str, object]:
        base = {column: 0 for column in {*OWN_COLUMNS, *ALLOWED_COLUMNS}}
        return {
            **base,
            "game_id": f"{season_type}_{team}_{opponent}",
            "week": 1,
            "team": team,
            "opponent_team": opponent,
            "season_type": season_type,
            "passing_yards": passing_yards,
        }

    # MIA at BUF, 10-24 in sample_standings_schedule; the POST row must be dropped.
    stats = pd.DataFrame(
        [
            {**row("BUF", "MIA", "REG", 300), "game_id": "g1"},
            {**row("MIA", "BUF", "REG", 150), "game_id": "g1"},
            row("BUF", "MIA", "POST", 999),
        ]
    )
    monkeypatch.setattr("app.services.teams.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.team_stats.get_weekly_team_stats", lambda season: stats)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )

    games = {g["team"]: g for g in get_team_game_stats()}

    assert set(games) == {"BUF", "MIA"}
    assert games["BUF"]["passing_yards"] == 300
    assert games["BUF"]["passing_yards_allowed"] == 150
    assert games["BUF"]["points_for"] == 24
    assert games["BUF"]["points_against"] == 10
    assert games["MIA"]["passing_yards_allowed"] == 300
